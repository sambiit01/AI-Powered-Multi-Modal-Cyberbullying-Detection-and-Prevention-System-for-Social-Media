'use server';
/**
 * @fileOverview Detects cyberbullying from text-based content using AI with relationship context and few-shot examples.
 *
 * - detectCyberbullyingFromText - A function that analyzes text for cyberbullying.
 * - DetectCyberbullyingFromTextInput - The input type for the detectCyberbullyingFromText function.
 * - DetectCyberbullyingFromTextOutput - The return type for the detectCyberbullyingFromText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectCyberbullyingFromTextInputSchema = z.object({
  text: z.string().describe('The text content to analyze for cyberbullying.'),
  relationshipType: z.string().describe('The type of relationship between sender and receiver.'),
  historyType: z.string().describe('The history of interaction between users.'),
  examples: z.array(z.any()).describe('Few-shot examples of similar interactions.'),
});
export type DetectCyberbullyingFromTextInput = z.infer<
  typeof DetectCyberbullyingFromTextInputSchema
>;

const DetectCyberbullyingFromTextOutputSchema = z.object({
  isCyberbullying: z
    .boolean()
    .describe('Whether the text content contains cyberbullying.'),
  reasoning: z
    .string()
    .describe('The reasoning why the text content is classified as cyberbullying or not.'),
  confidenceScore: z
    .number()
    .describe('A score indicating the confidence level of the detection (0-1).'),
});
export type DetectCyberbullyingFromTextOutput = z.infer<
  typeof DetectCyberbullyingFromTextOutputSchema
>;

export async function detectCyberbullyingFromText(
  input: DetectCyberbullyingFromTextInput
): Promise<DetectCyberbullyingFromTextOutput> {
  console.log('[SERVER: detectCyberbullyingFromText] >>> STARTING CONTEXTUAL ANALYSIS');
  return detectCyberbullyingFromTextFlow(input);
}

const detectCyberbullyingPrompt = ai.definePrompt({
  name: 'detectCyberbullyingPrompt',
  input: {
    schema: DetectCyberbullyingFromTextInputSchema,
  },
  output: {schema: DetectCyberbullyingFromTextOutputSchema},
  prompt: `You are an AI assistant specialized in detecting cyberbullying.
  
  Evaluate the provided text within the context of the relationship between the sender and receiver.
  
  ### CONTEXT:
  - Relationship Status: {{{relationshipType}}}
  - History of Interaction: {{{historyType}}}
  
  ### REFERENCE EXAMPLES (Similar Contexts):
  {{#if examples}}
  {{#each examples}}
  - Example Text: "{{{this.text}}}"
    Relationship: {{{this.relationship}}}
    Label: {{{this.label}}}
  {{/each}}
  {{else}}
  No specific reference examples found.
  {{/if}}

  ### TEXT TO ANALYZE:
  "{{{text}}}"

  ### GUIDELINES:
  1. Use a HIGHER hostility threshold for established "Friends" or "Close" relationships. Allow for casual banter, sarcasm, and mutual teasing unless it is clearly harmful, non-consensual, or escalates to severe harassment.
  2. Use a STRICTER threshold for "Strangers" or "Acquaintances". Aggressive, unsolicited, or insulting language here is more likely to be bullying.
  3. Look for signs of persistent harassment, physical threats, or systemic hate speech.
  
  Return a JSON response with isCyberbullying (boolean), reasoning (string), and confidenceScore (0-1).
  `,
});

const detectCyberbullyingFromTextFlow = ai.defineFlow(
  {
    name: 'detectCyberbullyingFromTextFlow',
    inputSchema: DetectCyberbullyingFromTextInputSchema,
    outputSchema: DetectCyberbullyingFromTextOutputSchema,
  },
  async input => {
    const {output} = await detectCyberbullyingPrompt(input);
    return output!;
  }
);

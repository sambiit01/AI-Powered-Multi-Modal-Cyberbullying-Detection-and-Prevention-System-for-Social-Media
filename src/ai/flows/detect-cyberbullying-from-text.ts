
'use server';
/**
 * @fileOverview Detects cyberbullying from text-based content with relationship context, 
 * inferred behavioral metrics, few-shot examples, and admin thresholds.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectCyberbullyingFromTextInputSchema = z.object({
  text: z.string().describe('The text content to analyze.'),
  relationshipType: z.string().describe('The level of relationship (Stranger, Friend, etc.).'),
  historyType: z.string().describe('The interaction history sentiment (Friendly, Neutral).'),
  interactionFrequency: z.string().describe('How often they communicate.'),
  isBursting: z.boolean().describe('Whether the sender is flooding messages without response.'),
  examples: z.array(z.any()).describe('Few-shot examples matching the relationship context.'),
  sensitivityThreshold: z.number().describe('The required confidence score percentage (0-100).'),
});
export type DetectCyberbullyingFromTextInput = z.infer<
  typeof DetectCyberbullyingFromTextInputSchema
>;

const DetectCyberbullyingFromTextOutputSchema = z.object({
  isCyberbullying: z.boolean().describe('Whether the content is flagged.'),
  reasoning: z.string().describe('AI reasoning for the classification.'),
  confidenceScore: z.number().describe('The model confidence level (0-1).'),
});
export type DetectCyberbullyingFromTextOutput = z.infer<
  typeof DetectCyberbullyingFromTextOutputSchema
>;

export async function detectCyberbullying(
  input: DetectCyberbullyingFromTextInput
): Promise<DetectCyberbullyingFromTextOutput> {
  console.log('[SERVER: detectCyberbullying] >>> STARTING BEHAVIORAL ANALYSIS');
  console.log('[SERVER: detectCyberbullying] BURSTING MODE:', input.isBursting);
  
  const result = await detectCyberbullyingFromTextFlow(input);

  const thresholdAsDecimal = input.sensitivityThreshold / 100;
  if (result.isCyberbullying && result.confidenceScore < thresholdAsDecimal) {
    return {
      ...result,
      isCyberbullying: false,
      reasoning: `[Suppressed] ${result.reasoning} (Confidence ${Math.round(result.confidenceScore * 100)}% < ${input.sensitivityThreshold}%)`
    };
  }

  return result;
}

const detectCyberbullyingPrompt = ai.definePrompt({
  name: 'detectCyberbullyingPrompt',
  input: {
    schema: DetectCyberbullyingFromTextInputSchema,
  },
  output: {schema: DetectCyberbullyingFromTextOutputSchema},
  prompt: `You are an expert AI moderator specializing in cyberbullying detection.
  
  ### BEHAVIORAL CONTEXT:
  - Relationship Level: {{{relationshipType}}}
  - Sentiment History: {{{historyType}}}
  - Interaction Frequency: {{{interactionFrequency}}}
  - Bursting Mode: {{#if isBursting}}ACTIVE (Sender is flooding messages){{else}}Inactive{{/if}}
  
  ### REFERENCE EXAMPLES:
  {{#if examples}}
  {{#each examples}}
  - Text: "{{{this.text}}}" | Relationship: {{{this.relationship}}} | Label: {{{this.label}}}
  {{/each}}
  {{else}}
  No specific reference examples found.
  {{/if}}

  ### CONTENT TO ANALYZE:
  "{{{text}}}"

  ### STRICT MODERATION GUIDELINES:
  1. **Bursting Mode Warning**: If Bursting Mode is ACTIVE, the sender is sending many messages without a response. This is a high-risk indicator of harassment. Lower your tolerance significantly and be much stricter.
  2. **Stranger Threshold**: If relationship is 'Stranger', even mild insults should be flagged.
  3. **Friendship Context**: If relationship is 'Close Friend' and history is 'Friendly', allow for playful banter unless it involves genuine threats.

  Return JSON: { isCyberbullying, reasoning, confidenceScore }
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

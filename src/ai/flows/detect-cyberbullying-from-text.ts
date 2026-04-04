'use server';
/**
 * @fileOverview Detects cyberbullying from text-based content with relationship context, 
 * few-shot examples, and admin-defined sensitivity thresholds.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectCyberbullyingFromTextInputSchema = z.object({
  text: z.string().describe('The text content to analyze.'),
  relationshipType: z.string().describe('The type of relationship between users.'),
  historyType: z.string().describe('The interaction history description.'),
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

export async function detectCyberbullyingFromText(
  input: DetectCyberbullyingFromTextInput
): Promise<DetectCyberbullyingFromTextOutput> {
  console.log('[SERVER: detectCyberbullyingFromText] >>> STARTING CONTEXTUAL ANALYSIS');
  console.log('[SERVER: detectCyberbullyingFromText] THRESHOLD:', input.sensitivityThreshold, '%');
  
  const result = await detectCyberbullyingFromTextFlow(input);

  // SUPPRESSION LOGIC: Compare confidence score against sensitivity threshold
  const thresholdAsDecimal = input.sensitivityThreshold / 100;
  if (result.isCyberbullying && result.confidenceScore < thresholdAsDecimal) {
    console.log('[SERVER: detectCyberbullyingFromText] !!! THRESHOLD SUPPRESSION TRIGGERED');
    console.log(`[SERVER: detectCyberbullyingFromText] Confidence (${result.confidenceScore}) < Threshold (${thresholdAsDecimal}). Setting isCyberbullying to FALSE.`);
    
    return {
      ...result,
      isCyberbullying: false,
      reasoning: `[Filtered by Admin Threshold] ${result.reasoning} (AI was only ${Math.round(result.confidenceScore * 100)}% confident, which is below the ${input.sensitivityThreshold}% requirement).`
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
  prompt: `You are an AI assistant specialized in detecting cyberbullying.
  
  ### CONTEXT:
  - Relationship Status: {{{relationshipType}}}
  - History of Interaction: {{{historyType}}}
  
  ### REFERENCE EXAMPLES (Few-Shot Context):
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
  1. established "Friends": Higher tolerance for banter and teasing.
  2. "Strangers/Acquaintances": Stricter threshold for unsolicited insults.
  
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
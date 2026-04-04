'use server';
/**
 * @fileOverview Detects cyberbullying from text-based content using AI.
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
  historyType: z.string().describe('The history of interaction between sender and receiver.'),
});
export type DetectCyberbullyingFromTextInput = z.infer<
  typeof DetectCyberbullyingFromTextInputSchema
>;

const DetectCyberbullyingFromTextOutputSchema = z.object({
  isCyberbullying: z
    .boolean()
    .describe('Whether the text content contains cyberbullying.'),
  reason: z
    .string()
    .describe('The reason why the text content is classified as cyberbullying.'),
  confidenceScore: z
    .number()
    .describe('A score indicating the confidence level of the cyberbullying detection.'),
});
export type DetectCyberbullyingFromTextOutput = z.infer<
  typeof DetectCyberbullyingFromTextOutputSchema
>;

export async function detectCyberbullyingFromText(
  input: DetectCyberbullyingFromTextInput
): Promise<DetectCyberbullyingFromTextOutput> {
  console.log('\n\n==================================================');
  console.log('[SERVER: detectCyberbullyingFromText] >>> STARTING NEW ANALYSIS');
  console.log('[SERVER: detectCyberbullyingFromText] STEP 1: RECEIVED INPUT');
  console.log('==================================================\n');
  
  try {
    const result = await detectCyberbullyingFromTextFlow(input);
    
    console.log('\n--------------------------------------------------');
    console.log('[SERVER: detectCyberbullyingFromText] STEP 2: ANALYSIS COMPLETE');
    console.log('--------------------------------------------------\n');
    return result;
  } catch (error) {
    console.error('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('[SERVER: detectCyberbullyingFromText] !!! CRITICAL ERROR:', error);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
    throw error;
  }
}

const detectCyberbullyingPrompt = ai.definePrompt({
  name: 'detectCyberbullyingPrompt',
  input: {
    schema: DetectCyberbullyingFromTextInputSchema,
  },
  output: {schema: DetectCyberbullyingFromTextOutputSchema},
  prompt: `You are an AI assistant specialized in detecting cyberbullying.
  Analyze the following text considering the context of the relationship between the sender and receiver.
  
  Relationship Status: {{{relationshipType}}}
  History of Interaction: {{{historyType}}}
  
  Text: {{{text}}}

  GUIDELINES:
  1. If the relationship is "Friends" or "Close", allow for more casual language and banter unless it is clearly harmful.
  2. If the relationship is "Stranger", be stricter with aggressive or unsolicited language.
  3. Look for signs of harassment, threats, or hate speech.
  `,
});

const detectCyberbullyingFromTextFlow = ai.defineFlow(
  {
    name: 'detectCyberbullyingFromTextFlow',
    inputSchema: DetectCyberbullyingFromTextInputSchema,
    outputSchema: DetectCyberbullyingFromTextOutputSchema,
  },
  async input => {
    console.log('[SERVER: detectCyberbullyingFromTextFlow] SENDING TO GEMINI AI WITH CONTEXT...');
    const {output} = await detectCyberbullyingPrompt(input);
    return output!;
  }
);

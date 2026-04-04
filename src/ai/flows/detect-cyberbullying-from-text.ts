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
import {getOrCreateRelationship} from '@/lib/firebase';

const DetectCyberbullyingFromTextInputSchema = z.object({
  text: z.string().describe('The text content to analyze for cyberbullying.'),
  senderId: z.string().describe('The ID of the user sending the message.'),
  receiverId: z.string().describe('The ID of the user receiving the message.'),
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
  console.log('[SERVER: detectCyberbullyingFromText] STEP 1: RECEIVED INPUT:', input);
  console.log('==================================================\n');
  
  try {
    const result = await detectCyberbullyingFromTextFlow(input);
    
    console.log('\n--------------------------------------------------');
    console.log('[SERVER: detectCyberbullyingFromText] STEP 4: ANALYSIS COMPLETE');
    console.log('[SERVER: detectCyberbullyingFromText] FINAL OUTPUT:', JSON.stringify(result, null, 2));
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
    schema: z.object({
      text: z.string(),
      relationshipType: z.string(),
      historyType: z.string(),
    })
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

  Response in JSON:
  {
    "isCyberbullying": boolean,
    "reason": string,
    "confidenceScore": number
  }`,
});

const detectCyberbullyingFromTextFlow = ai.defineFlow(
  {
    name: 'detectCyberbullyingFromTextFlow',
    inputSchema: DetectCyberbullyingFromTextInputSchema,
    outputSchema: DetectCyberbullyingFromTextOutputSchema,
  },
  async input => {
    console.log('[SERVER: detectCyberbullyingFromTextFlow] STEP 2: FETCHING RELATIONSHIP CONTEXT...');
    const relationship = await getOrCreateRelationship(input.senderId, input.receiverId);
    
    console.log('[SERVER: detectCyberbullyingFromTextFlow] STEP 3: SENDING TO GEMINI AI WITH CONTEXT...');
    const {output} = await detectCyberbullyingPrompt({
      text: input.text,
      relationshipType: relationship.relationshipType as string,
      historyType: relationship.historyType as string,
    });
    
    console.log('[SERVER: detectCyberbullyingFromTextFlow] STEP 3.1: GEMINI AI RESPONDED SUCCESSFULLY.');
    return output!;
  }
);

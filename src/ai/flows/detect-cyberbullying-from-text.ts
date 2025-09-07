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
  return detectCyberbullyingFromTextFlow(input);
}

const detectCyberbullyingPrompt = ai.definePrompt({
  name: 'detectCyberbullyingPrompt',
  input: {schema: DetectCyberbullyingFromTextInputSchema},
  output: {schema: DetectCyberbullyingFromTextOutputSchema},
  prompt: `You are an AI assistant specialized in detecting cyberbullying in text content.
  Analyze the following text and determine if it constitutes cyberbullying.
  Provide a reason for your classification and a confidence score between 0 and 1.

  Text: {{{text}}}

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
    const {output} = await detectCyberbullyingPrompt(input);
    return output!;
  }
);

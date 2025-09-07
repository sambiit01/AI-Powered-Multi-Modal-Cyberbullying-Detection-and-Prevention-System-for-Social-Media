'use server';
/**
 * @fileOverview Detects cyberbullying from image captions using AI.
 *
 * - detectCyberbullyingFromImageCaption - A function that analyzes image captions to detect cyberbullying.
 * - DetectCyberbullyingFromImageCaptionInput - The input type for the detectCyberbullyingFromImageCaption function.
 * - DetectCyberbullyingFromImageCaptionOutput - The return type for the detectCyberbullyingFromImageCaption function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectCyberbullyingFromImageCaptionInputSchema = z.object({
  imageCaption: z.string().describe('The caption of the image to analyze for cyberbullying.'),
});
export type DetectCyberbullyingFromImageCaptionInput = z.infer<typeof DetectCyberbullyingFromImageCaptionInputSchema>;

const DetectCyberbullyingFromImageCaptionOutputSchema = z.object({
  isCyberbullying: z.boolean().describe('Whether the image caption contains cyberbullying content.'),
  reason: z.string().describe('The reason for the cyberbullying detection, if any.'),
  confidenceScore: z.number().describe('The confidence score of the cyberbullying detection (0-1).'),
});
export type DetectCyberbullyingFromImageCaptionOutput = z.infer<typeof DetectCyberbullyingFromImageCaptionOutputSchema>;

export async function detectCyberbullyingFromImageCaption(input: DetectCyberbullyingFromImageCaptionInput): Promise<DetectCyberbullyingFromImageCaptionOutput> {
  return detectCyberbullyingFromImageCaptionFlow(input);
}

const detectCyberbullyingFromImageCaptionPrompt = ai.definePrompt({
  name: 'detectCyberbullyingFromImageCaptionPrompt',
  input: {schema: DetectCyberbullyingFromImageCaptionInputSchema},
  output: {schema: DetectCyberbullyingFromImageCaptionOutputSchema},
  prompt: `Analyze the following image caption for cyberbullying content. Provide a confidence score between 0 and 1.

Image Caption: {{{imageCaption}}}

Is Cyberbullying: (true/false)
Reason: (Explain the reason for the detection, if any)
Confidence Score: (0-1)`, //Strict schema is requested, so use handlebars
});

const detectCyberbullyingFromImageCaptionFlow = ai.defineFlow(
  {
    name: 'detectCyberbullyingFromImageCaptionFlow',
    inputSchema: DetectCyberbullyingFromImageCaptionInputSchema,
    outputSchema: DetectCyberbullyingFromImageCaptionOutputSchema,
  },
  async input => {
    const {output} = await detectCyberbullyingFromImageCaptionPrompt(input);
    return output!;
  }
);

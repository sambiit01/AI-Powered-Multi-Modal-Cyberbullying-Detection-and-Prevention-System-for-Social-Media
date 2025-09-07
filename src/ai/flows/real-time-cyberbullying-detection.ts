'use server';
/**
 * @fileOverview Real-time cyberbullying detection flow.
 *
 * - realTimeCyberbullyingDetection - A function that monitors social media content in real-time to detect and flag cyberbullying incidents.
 * - RealTimeCyberbullyingDetectionInput - The input type for the realTimeCyberbullyingDetection function.
 * - RealTimeCyberbullyingDetectionOutput - The return type for the realTimeCyberbullyingDetection function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RealTimeCyberbullyingDetectionInputSchema = z.object({
  content: z.string().describe('The social media content to be analyzed.'),
  contentType: z.enum(['text', 'image', 'video']).describe('The type of content being analyzed.'),
  userBehaviorData: z.string().optional().describe('User behavior data to help detect cyberbullying.'),
  contextualInformation: z.string().optional().describe('Contextual information to assist in cyberbullying detection.'),
  temporalInformation: z.string().optional().describe('Temporal information related to the content.'),
});

export type RealTimeCyberbullyingDetectionInput = z.infer<typeof RealTimeCyberbullyingDetectionInputSchema>;

const RealTimeCyberbullyingDetectionOutputSchema = z.object({
  isCyberbullying: z.boolean().describe('Whether the content is cyberbullying or not.'),
  reason: z.string().describe('The reason for the cyberbullying detection.'),
  severity: z.string().optional().describe('Severity level of the cyberbullying.'),
  suggestedAction: z.string().optional().describe('Action suggested for cyberbullying incident.'),
});

export type RealTimeCyberbullyingDetectionOutput = z.infer<typeof RealTimeCyberbullyingDetectionOutputSchema>;

export async function realTimeCyberbullyingDetection(
  input: RealTimeCyberbullyingDetectionInput
): Promise<RealTimeCyberbullyingDetectionOutput> {
  return realTimeCyberbullyingDetectionFlow(input);
}

const detectCyberbullyingPrompt = ai.definePrompt({
  name: 'detectCyberbullyingPrompt',
  input: {schema: RealTimeCyberbullyingDetectionInputSchema},
  output: {schema: RealTimeCyberbullyingDetectionOutputSchema},
  prompt: `You are an AI expert in cyberbullying detection. Analyze the social media content and information provided to determine if it constitutes cyberbullying.

Content: {{{content}}}
Content Type: {{{contentType}}}

User Behavior Data: {{{userBehaviorData}}}
Contextual Information: {{{contextualInformation}}}
Temporal Information: {{{temporalInformation}}}

Based on the content, content type, user behavior data, contextual and temporal information, determine if the content constitutes cyberbullying. Provide a reason for your determination, and suggest an action to take if cyberbullying is detected.

Consider factors like threats, harassment, insults, and defamation.
Set isCyberbullying to true if cyberbullying is detected, otherwise false.
`,
});

const realTimeCyberbullyingDetectionFlow = ai.defineFlow(
  {
    name: 'realTimeCyberbullyingDetectionFlow',
    inputSchema: RealTimeCyberbullyingDetectionInputSchema,
    outputSchema: RealTimeCyberbullyingDetectionOutputSchema,
  },
  async input => {
    const {output} = await detectCyberbullyingPrompt(input);
    return output!;
  }
);

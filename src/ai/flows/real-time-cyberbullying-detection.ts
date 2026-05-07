'use server';
/**
 * @fileOverview Real-time cyberbullying detection flow with relationship and activity persistence.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db, updateRelationshipBehavior } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

const RealTimeCyberbullyingDetectionInputSchema = z.object({
  content: z.string().describe('The social media content to be analyzed.'),
  contentType: z.enum(['text', 'image', 'video']).describe('The type of content being analyzed.'),
  senderId: z.string().describe('The ID of the user sending the content.'),
  receiverId: z.string().describe('The ID of the user receiving the content.'),
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
  confidenceScore: z.number().describe('Confidence level of the detection.'),
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

Based on the content, content type, user behavior data, contextual and temporal information, determine if the content constitutes cyberbullying. 
Provide a reason for your determination, a confidenceScore between 0 and 1, and suggest an action to take if cyberbullying is detected.

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
    const result = output!;

    // Directional Toxicity Calculation
    const toxicityScore = result.isCyberbullying 
      ? result.confidenceScore 
      : Math.max(0.1, 1 - result.confidenceScore);

    // Persist behavior using toxicity score
    await updateRelationshipBehavior(input.senderId, input.receiverId, toxicityScore);

    // Log Activity
    await addDoc(collection(db, 'activities'), {
      type: 'Content',
      userId: input.senderId,
      receiverId: input.receiverId,
      details: input.content.substring(0, 50),
      status: result.isCyberbullying ? 'Flagged' : 'Safe',
      date: new Date().toISOString(),
      reasoning: result.reason,
      originalText: input.content,
      confidenceScore: result.confidenceScore,
      toxicityScore: toxicityScore
    });

    return result;
  }
);
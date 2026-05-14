
'use server';
/**
 * @fileOverview Real-time cyberbullying detection flow with Behavioral Process Logging.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db, updateRelationshipBehavior, getOrCreateRelationship } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

const RealTimeCyberbullyingDetectionInputSchema = z.object({
  content: z.string().describe('The social media content to be analyzed.'),
  contentType: z.enum(['text', 'image', 'video']).describe('The type of content being analyzed.'),
  senderId: z.string().describe('The ID of the user sending the content.'),
  receiverId: z.string().describe('The ID of the user receiving the content.'),
});

export type RealTimeCyberbullyingDetectionInput = z.infer<typeof RealTimeCyberbullyingDetectionInputSchema>;

const RealTimeCyberbullyingDetectionOutputSchema = z.object({
  isCyberbullying: z.boolean().describe('Whether the content is cyberbullying or not.'),
  reason: z.string().describe('The reason for the cyberbullying detection.'),
  confidenceScore: z.number().describe('Confidence level of the detection.'),
  toxicityScore: z.number().describe('Calculated toxicity level.'),
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
  output: {
    schema: z.object({
      isCyberbullying: z.boolean(),
      reason: z.string(),
      confidenceScore: z.number(),
    })
  },
  prompt: `You are an AI expert in cyberbullying detection. Analyze the content to determine if it constitutes cyberbullying.
Content: "{{{content}}}"
Type: {{{contentType}}}
Return JSON: { isCyberbullying, reason, confidenceScore }`,
});

const realTimeCyberbullyingDetectionFlow = ai.defineFlow(
  {
    name: 'realTimeCyberbullyingDetectionFlow',
    inputSchema: RealTimeCyberbullyingDetectionInputSchema,
    outputSchema: RealTimeCyberbullyingDetectionOutputSchema,
  },
  async input => {
    console.log(`\n[REALTIME] Auditing Interaction: ${input.senderId} -> ${input.receiverId}`);
    
    const {output} = await detectCyberbullyingPrompt(input);
    const result = output!;

    const toxicityScore = result.isCyberbullying 
      ? result.confidenceScore 
      : Math.max(0.1, 1 - result.confidenceScore);

    console.log(`[REALTIME] Toxicity Level: ${toxicityScore.toFixed(2)} (Climate Impact)`);

    await updateRelationshipBehavior(input.senderId, input.receiverId, toxicityScore);

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

    return { ...result, toxicityScore };
  }
);

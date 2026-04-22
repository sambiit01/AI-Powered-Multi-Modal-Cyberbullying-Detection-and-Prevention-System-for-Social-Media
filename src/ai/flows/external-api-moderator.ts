'use server';
/**
 * @fileOverview External API Moderator Wrapper for ShieldAI.
 * 
 * This flow serves as a public-facing wrapper for external developers.
 * It encapsulates behavioral context lookup and profile retrieval, returning
 * a simplified action-oriented response.
 * 
 * - externalModerator - The primary entry point for external moderation requests.
 * - ExternalModeratorInput - messageText, senderId, receiverId, profileId.
 * - ExternalModeratorOutput - { action: 'allow' | 'block', reasoning: string, behavioralAlerts: string[] }.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getOrCreateRelationship, getProfileSettings } from '@/lib/firebase';
import { detectCyberbullying } from './detect-cyberbullying-from-text';

const ExternalModeratorInputSchema = z.object({
  messageText: z.string().describe('The content to moderate.'),
  senderId: z.string().describe('The ID of the user sending the message.'),
  receiverId: z.string().describe('The ID of the user receiving the message.'),
  profileId: z.string().optional().describe('Optional moderation profile ID. Defaults to global settings if not provided.'),
});

export type ExternalModeratorInput = z.infer<typeof ExternalModeratorInputSchema>;

const ExternalModeratorOutputSchema = z.object({
  action: z.enum(['allow', 'block']).describe('The recommended moderation action.'),
  reasoning: z.string().describe('AI provided reasoning for the classification decision.'),
  behavioralAlerts: z.array(z.string()).describe('List of behavioral risk flags detected by the inference engine (e.g., Bursting, Negative History).'),
});

export type ExternalModeratorOutput = z.infer<typeof ExternalModeratorOutputSchema>;

/**
 * Orchestrates relationship bond calculation and content analysis.
 * This is the recommended function for external API integrations.
 */
export async function externalModerator(input: ExternalModeratorInput): Promise<ExternalModeratorOutput> {
  return externalModeratorFlow(input);
}

const externalModeratorFlow = ai.defineFlow(
  {
    name: 'externalModeratorFlow',
    inputSchema: ExternalModeratorInputSchema,
    outputSchema: ExternalModeratorOutputSchema,
  },
  async (input) => {
    console.log(`[EXTERNAL_API] Request received from Sender: ${input.senderId} to Receiver: ${input.receiverId}`);
    
    // 1. Fetch/Calculate Behavioral Context (The "Relationship Bond")
    // This function automatically calculates interaction counts, relationship levels, and bursting mode.
    const relData = await getOrCreateRelationship(input.senderId, input.receiverId);
    
    // 2. Fetch Moderation Profile Settings
    // Defaults to the global configuration if profileId is omitted.
    const settings = await getProfileSettings(input.profileId);
    
    // 3. Trigger Core Detection Engine
    // We call the core detectCyberbullying function which handles RAG retrieval and threshold suppression.
    const analysis = await detectCyberbullying({
      text: input.messageText,
      relationshipType: relData.relationshipType || 'Stranger',
      historyType: relData.historyType || 'Neutral',
      interactionFrequency: relData.interactionFrequency || 'Occasional',
      isBursting: !!relData.isBursting,
      profileId: settings.profileType || 'standard',
      sensitivityThreshold: settings.sensitivityThreshold,
      banterTolerance: settings.banterTolerance,
    });
    
    // 4. Derive Behavioral Alerts for the external response
    const alerts: string[] = [];
    if (relData.isBursting) {
      alerts.push('Bursting Mode: Sender is flooding messages without response.');
    }
    if (relData.relationshipType === 'Stranger') {
      alerts.push('Low Bond: Interaction between strangers.');
    }
    if (relData.rollingSentimentScore !== undefined && relData.rollingSentimentScore < 0.4) {
      alerts.push('Negative History: Historical relationship sentiment is poor.');
    }
    if (analysis.confidenceScore > 0.9) {
      alerts.push('High Confidence: The AI is highly certain of this classification.');
    }

    const action = analysis.isCyberbullying ? 'block' : 'allow';
    
    console.log(`[EXTERNAL_API] Decision for "${input.messageText.substring(0, 20)}...": ${action.toUpperCase()}`);
    
    return {
      action,
      reasoning: analysis.reasoning,
      behavioralAlerts: alerts,
    };
  }
);

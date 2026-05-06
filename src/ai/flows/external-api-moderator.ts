
'use server';
/**
 * @fileOverview External API Moderator Wrapper for ShieldAI.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getOrCreateRelationship, getProfileSettings, updateRelationshipBehavior, db } from '@/lib/firebase';
import { detectCyberbullying } from './detect-cyberbullying-from-text';
import { collection, query, where, limit, getDocs, addDoc } from 'firebase/firestore';

const ExternalModeratorInputSchema = z.object({
  messageText: z.string().describe('The content to moderate.'),
  senderId: z.string().describe('The ID of the user sending the message.'),
  receiverId: z.string().describe('The ID of the user receiving the message.'),
  profileId: z.string().optional().describe('Optional moderation profile ID.'),
});

export type ExternalModeratorInput = z.infer<typeof ExternalModeratorInputSchema>;

const ExternalModeratorOutputSchema = z.object({
  action: z.enum(['allow', 'block']).describe('The recommended moderation action.'),
  reasoning: z.string().describe('AI provided reasoning for the decision.'),
  behavioralAlerts: z.array(z.string()).describe('Behavioral risk flags.'),
});

export type ExternalModeratorOutput = z.infer<typeof ExternalModeratorOutputSchema>;

/**
 * Detects if the vibe is declining rapidly.
 */
async function analyzeSentimentDrift(senderId: string, receiverId: string, currentScore: number): Promise<boolean> {
  // If the rolling score is already low, it's a drift
  if (currentScore < 0.4) return true;

  try {
    const activitiesRef = collection(db, 'activities');
    const q = query(
      activitiesRef, 
      where('userId', '==', senderId),
      limit(10)
    );
    const snap = await getDocs(q);
    const recentFlags = snap.docs.filter(doc => doc.data().status === 'Flagged').length;
    return recentFlags >= 2;
  } catch (e) {
    return false;
  }
}

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
    // 1. Context Lookup
    const relData = await getOrCreateRelationship(input.senderId, input.receiverId);
    const settings = await getProfileSettings(input.profileId);
    
    // 2. Behavioral Checks
    const isDrifting = await analyzeSentimentDrift(input.senderId, input.receiverId, relData.rollingSentimentScore || 0.5);
    
    // 3. Core AI Analysis
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
    
    // 4. Persistence
    await updateRelationshipBehavior(input.senderId, input.receiverId, !analysis.isCyberbullying);

    // Also log the activity for drift tracking
    await addDoc(collection(db, 'activities'), {
      type: 'Content',
      userId: input.senderId,
      details: input.messageText.substring(0, 50),
      status: analysis.isCyberbullying ? 'Flagged' : 'Safe',
      date: new Date().toISOString(),
      reasoning: analysis.reasoning
    });

    // 5. Derive Alerts
    const alerts: string[] = [];
    if (relData.isBursting) alerts.push('BURST_DETECTED');
    if (isDrifting) alerts.push('NEGATIVE_DRIFT_DETECTED');

    const action = analysis.isCyberbullying ? 'block' : 'allow';
    
    return {
      action,
      reasoning: analysis.reasoning,
      behavioralAlerts: alerts,
    };
  }
);

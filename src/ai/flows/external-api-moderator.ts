'use server';
/**
 * @fileOverview External API Moderator for ShieldAI with Behavioral Intelligence.
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
  behavioralAlerts: z.array(z.string()).describe('Behavioral risk flags detected.'),
});

export type ExternalModeratorOutput = z.infer<typeof ExternalModeratorOutputSchema>;

/**
 * Detects if the sentiment vibe is declining rapidly based on recent history.
 */
async function analyzeSentimentDrift(senderId: string, rollingScore: number): Promise<boolean> {
  // If the rolling score is already in danger zone, drift is established
  if (rollingScore < 0.4) return true;

  try {
    const activitiesRef = collection(db, 'activities');
    const q = query(
      activitiesRef, 
      where('userId', '==', senderId),
      limit(10)
    );
    const snap = await getDocs(q);
    const recentFlags = snap.docs.filter(doc => doc.data().status === 'Flagged').length;
    // If 30% of recent messages were toxic, drift is detected
    return recentFlags >= 3;
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
    
    // 2. Perform AI Core Analysis
    const analysis = await detectCyberbullying({
      text: input.messageText,
      relationshipType: relData.relationshipType || 'Stranger',
      historyType: relData.historyType || 'Neutral',
      interactionFrequency: relData.interactionFrequency || 'Occasional',
      isBursting: !!relData.isBursting,
      profileId: input.profileId || 'standard',
      sensitivityThreshold: settings.sensitivityThreshold,
      banterTolerance: settings.banterTolerance,
    });
    
    // 3. Update Persistence
    await updateRelationshipBehavior(input.senderId, input.receiverId, !analysis.isCyberbullying);

    // 4. Log Activity
    await addDoc(collection(db, 'activities'), {
      type: 'Content',
      userId: input.senderId,
      details: input.messageText.substring(0, 50),
      status: analysis.isCyberbullying ? 'Flagged' : 'Safe',
      date: new Date().toISOString(),
      reasoning: analysis.reasoning,
      originalText: input.messageText,
      relType: relData.relationshipType,
      profileId: input.profileId || 'standard'
    });

    // 5. Derive Comprehensive Alerts
    const alerts: string[] = [];
    
    if (relData.isBursting) alerts.push('BURST_DETECTED');
    
    const isDrifting = await analyzeSentimentDrift(input.senderId, relData.rollingSentimentScore || 0.5);
    if (isDrifting) alerts.push('NEGATIVE_DRIFT_DETECTED');

    if (analysis.isCyberbullying && analysis.confidenceScore > 0.85 && relData.relationshipType === 'Stranger') {
      alerts.push('HIGH_CONFIDENCE_LOW_BOND');
    }

    if ((relData.rollingSentimentScore || 0.5) < 0.35) {
      alerts.push('NEGATIVE_HISTORY_DETECTED');
    }

    const action = analysis.isCyberbullying ? 'block' : 'allow';
    
    return {
      action,
      reasoning: analysis.reasoning,
      behavioralAlerts: alerts,
    };
  }
);

'use server';
/**
 * @fileOverview External API Moderator Wrapper for ShieldAI.
 * Orchestrates multi-modal detection, behavioral drift analysis, 
 * and relationship metadata management.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getOrCreateRelationship, getProfileSettings, updateRelationshipBehavior, db } from '@/lib/firebase';
import { detectCyberbullying } from './detect-cyberbullying-from-text';
import { collection, query, where, limit, getDocs, addDoc, orderBy } from 'firebase/firestore';

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
 * Detects if the sentiment vibe is declining rapidly.
 */
async function analyzeSentimentDrift(senderId: string, receiverId: string, currentRollingScore: number): Promise<boolean> {
  // Check 1: Direct Rolling Score Check (The "Vibe" Check)
  if (currentRollingScore < 0.4) return true;

  // Check 2: Historical Flag Check (The "Trend" Check)
  try {
    const activitiesRef = collection(db, 'activities');
    const q = query(
      activitiesRef, 
      where('userId', '==', senderId),
      orderBy('date', 'desc'),
      limit(5)
    );
    const snap = await getDocs(q);
    const recentFlags = snap.docs.filter(doc => doc.data().status === 'Flagged').length;
    return recentFlags >= 2; // Drift detected if 2 of last 5 were toxic
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
    // 1. Context Lookup (Fetch from DB or Create if Missing)
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
    
    // 3. Update Database Persistence (Awaited for sequential test consistency)
    await updateRelationshipBehavior(input.senderId, input.receiverId, !analysis.isCyberbullying);

    // 4. Log the activity for historical tracking
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
    
    // BURST_DETECTED: Frequency flooding
    if (relData.isBursting) alerts.push('BURST_DETECTED');
    
    // NEGATIVE_DRIFT_DETECTED: Falling sentiment score
    const isDrifting = await analyzeSentimentDrift(input.senderId, input.receiverId, relData.rollingSentimentScore || 0.5);
    if (isDrifting) alerts.push('NEGATIVE_DRIFT_DETECTED');

    // HIGH_CONFIDENCE_LOW_BOND: Strong flagging on Strangers
    if (analysis.isCyberbullying && analysis.confidenceScore > 0.85 && relData.relationshipType === 'Stranger') {
      alerts.push('HIGH_CONFIDENCE_LOW_BOND');
    }

    // NEGATIVE_HISTORY_DETECTED: Chronic toxicity
    if ((relData.rollingSentimentScore || 0.5) < 0.3) {
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
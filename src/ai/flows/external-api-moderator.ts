'use server';
/**
 * @fileOverview External API Moderator for ShieldAI with Behavioral Intelligence.
 * Separates Moderation Decisions (Law) from Relationship Sentiment (Climate).
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
  confidenceScore: z.number().describe('Numeric toxicity score.'),
});

export type ExternalModeratorOutput = z.infer<typeof ExternalModeratorOutputSchema>;

/**
 * Detects if the sentiment vibe is declining rapidly based on toxicity frequency.
 */
async function analyzeSentimentDrift(userId: string): Promise<boolean> {
  try {
    const activitiesRef = collection(db, 'activities');
    const q = query(
      activitiesRef, 
      where('userId', '==', userId),
      limit(10)
    );
    const snap = await getDocs(q);
    
    // Check how many of the last 10 messages had a high toxicity confidenceScore (> 0.70)
    const highToxicityCount = snap.docs.filter(doc => (doc.data().confidenceScore || 0) > 0.70).length;
    
    // Trigger if count is 3 or higher (30% or more of recent history is toxic)
    return highToxicityCount >= 3;
  } catch (e) {
    console.error('[DRIFT_CHECK] Error querying history:', e);
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
    // 1. Context Lookup (Relationship Climate)
    const relData = await getOrCreateRelationship(input.senderId, input.receiverId);
    const settings = await getProfileSettings(input.profileId);
    
    // 2. Perform AI Core Analysis (Moderation Decision)
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
    
    // 3. Update Persistence using raw confidence score (Climate Update)
    await updateRelationshipBehavior(input.senderId, input.receiverId, analysis.confidenceScore);

    // 4. Log Activity with numeric confidence for auditing
    await addDoc(collection(db, 'activities'), {
      type: 'Content',
      userId: input.senderId,
      details: input.messageText.substring(0, 50),
      status: analysis.isCyberbullying ? 'Flagged' : 'Safe',
      date: new Date().toISOString(),
      reasoning: analysis.reasoning,
      originalText: input.messageText,
      relType: relData.relationshipType,
      profileId: input.profileId || 'standard',
      confidenceScore: analysis.confidenceScore
    });

    // 5. Derive Comprehensive Behavioral Alerts
    const alerts: string[] = [];
    
    // Alert A: Flooding behavior
    if (relData.isBursting) alerts.push('BURST_DETECTED');
    
    // Alert B: Negative Drift (High frequency toxicity in recent messages)
    const isDrifting = await analyzeSentimentDrift(input.senderId);
    if (isDrifting) alerts.push('NEGATIVE_DRIFT_DETECTED');

    // Alert C: High Toxicity between Strangers
    if (analysis.isCyberbullying && analysis.confidenceScore > 0.85 && relData.relationshipType === 'Stranger') {
      alerts.push('HIGH_CONFIDENCE_LOW_BOND');
    }

    // Alert D: Chronic Hostility (Climate check)
    if ((relData.rollingSentimentScore || 0.5) < 0.35) {
      alerts.push('NEGATIVE_HISTORY_DETECTED');
    }

    const action = analysis.isCyberbullying ? 'block' : 'allow';
    
    return {
      action,
      reasoning: analysis.reasoning,
      behavioralAlerts: alerts,
      confidenceScore: analysis.confidenceScore
    };
  }
);
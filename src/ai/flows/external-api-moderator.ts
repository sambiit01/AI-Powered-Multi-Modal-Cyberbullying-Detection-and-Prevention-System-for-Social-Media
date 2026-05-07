'use server';
/**
 * @fileOverview External API Moderator for ShieldAI with Behavioral Intelligence.
 * Separates Moderation Decisions (Law) from Relationship Sentiment (Climate).
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
  confidenceScore: z.number().describe('Numeric confidence score.'),
  toxicityScore: z.number().describe('Calculated toxicity level (0-1).'),
});

export type ExternalModeratorOutput = z.infer<typeof ExternalModeratorOutputSchema>;

/**
 * Detects if the sentiment vibe is declining rapidly based on toxicity frequency for a specific pair.
 */
async function analyzeSentimentDrift(senderId: string, receiverId: string): Promise<boolean> {
  try {
    const activitiesRef = collection(db, 'activities');
    const q = query(
      activitiesRef, 
      where('userId', '==', senderId),
      where('receiverId', '==', receiverId),
      orderBy('date', 'desc'),
      limit(10)
    );
    const snap = await getDocs(q);
    
    // Check how many of the last 10 messages for this pair have a toxicityScore > 0.70
    const highToxicityCount = snap.docs.filter(doc => (doc.data().toxicityScore || 0) > 0.70).length;
    
    // Trigger if count is 3 or higher (30% or more of recent pair history is toxic)
    return highToxicityCount >= 3;
  } catch (e) {
    console.error('[DRIFT_CHECK] Error querying pair history:', e);
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

    // 3. Directional Toxicity Calculation
    // If bullying is detected, toxicity is the confidence score. 
    // If safe, toxicity is 1 - confidence (inverse of safety confidence).
    const toxicityScore = analysis.isCyberbullying 
      ? analysis.confidenceScore 
      : Math.max(0.1, 1 - analysis.confidenceScore);
    
    // 4. Update Persistence (Climate Update)
    await updateRelationshipBehavior(input.senderId, input.receiverId, toxicityScore);

    // 5. Log Activity with pair-locked metadata
    await addDoc(collection(db, 'activities'), {
      type: 'Content',
      userId: input.senderId,
      receiverId: input.receiverId,
      details: input.messageText.substring(0, 50),
      status: analysis.isCyberbullying ? 'Flagged' : 'Safe',
      date: new Date().toISOString(),
      reasoning: analysis.reasoning,
      originalText: input.messageText,
      relType: relData.relationshipType,
      profileId: input.profileId || 'standard',
      confidenceScore: analysis.confidenceScore,
      toxicityScore: toxicityScore
    });

    // 6. Derive Comprehensive Behavioral Alerts
    const alerts: string[] = [];
    
    // Alert A: Flooding behavior
    if (relData.isBursting) alerts.push('BURST_DETECTED');
    
    // Alert B: Negative Drift (High frequency toxicity in recent messages for this pair)
    const isDrifting = await analyzeSentimentDrift(input.senderId, input.receiverId);
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
      confidenceScore: analysis.confidenceScore,
      toxicityScore: toxicityScore
    };
  }
);
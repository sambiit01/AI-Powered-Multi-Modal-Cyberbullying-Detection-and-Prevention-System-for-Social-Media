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
  confidenceScore: z.number().describe('Numeric confidence score.'),
  toxicityScore: z.number().describe('Calculated toxicity level (0-1).'),
});

export type ExternalModeratorOutput = z.infer<typeof ExternalModeratorOutputSchema>;

/**
 * Detects if the sentiment vibe is declining rapidly based on toxicity frequency for a specific pair.
 * Uses in-memory sorting to bypass Firestore composite index requirements.
 */
async function analyzeSentimentDrift(senderId: string, receiverId: string): Promise<boolean> {
  try {
    const activitiesRef = collection(db, 'activities');
    // Fetch recent logs for this pair without a server-side order to avoid index issues
    const q = query(
      activitiesRef, 
      where('userId', '==', senderId),
      where('receiverId', '==', receiverId),
      limit(50) 
    );
    const snap = await getDocs(q);
    
    // Perform manual sort in memory
    const sortedDocs = snap.docs.sort((a, b) => {
      const dateA = new Date(a.data().date).getTime();
      const dateB = new Date(b.data().date).getTime();
      return dateB - dateA;
    });

    // Check how many of the last 10 messages for this pair have a toxicityScore > 0.70
    const recentMessages = sortedDocs.slice(0, 10);
    const highToxicityCount = recentMessages.filter(doc => (doc.data().toxicityScore || 0) > 0.70).length;
    
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
    // High confidence of bullying = High Toxicity
    // Low confidence of bullying (High safety) = Low Toxicity
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
    
    if (relData.isBursting) alerts.push('BURST_DETECTED');
    
    const isDrifting = await analyzeSentimentDrift(input.senderId, input.receiverId);
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
      confidenceScore: analysis.confidenceScore,
      toxicityScore: toxicityScore
    };
  }
);

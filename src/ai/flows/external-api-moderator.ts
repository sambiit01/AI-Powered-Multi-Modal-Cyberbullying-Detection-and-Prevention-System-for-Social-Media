'use server';
/**
 * @fileOverview Central External API Moderator with Behavioral Process Logging.
 * This flow audits interactions and logs exactly how decisions are made.
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

async function analyzeSentimentDrift(senderId: string, receiverId: string): Promise<boolean> {
  console.log(`[PROCESS] Auditing Recent Activity for pair: ${senderId} -> ${receiverId}...`);
  try {
    const activitiesRef = collection(db, 'activities');
    const q = query(
      activitiesRef, 
      where('userId', '==', senderId),
      where('receiverId', '==', receiverId),
      limit(50) 
    );
    const snap = await getDocs(q);
    
    // Sort in-memory to avoid composite index requirement
    const sortedDocs = snap.docs.sort((a, b) => {
      const dateA = new Date(a.data().date).getTime();
      const dateB = new Date(b.data().date).getTime();
      return dateB - dateA;
    });

    const recentMessages = sortedDocs.slice(0, 10);
    console.log(`[PROCESS] Audit Trail (Last 10 messages for pair):`);
    
    recentMessages.forEach((doc, idx) => {
      const d = doc.data();
      console.log(`  [${idx + 1}] Tox: ${d.toxicityScore?.toFixed(2)} | Text: "${d.originalText?.substring(0, 30)}..."`);
    });

    const highToxicityCount = recentMessages.filter(doc => (doc.data().toxicityScore || 0) > 0.70).length;
    console.log(`[PROCESS] High Toxicity Count: ${highToxicityCount}/10 (Threshold for DRIFT is 3)`);
    
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
    console.log(`\n==================================================`);
    console.log(`🚀 [MODERATOR] STARTING FLOW for ${input.senderId} -> ${input.receiverId}`);
    console.log(`Content: "${input.messageText}"`);

    // 1. Context Lookup (Relationship Climate)
    const relData = await getOrCreateRelationship(input.senderId, input.receiverId);
    const settings = await getProfileSettings(input.profileId);
    
    console.log(`[DB_STATE] Relationship Climate:`);
    console.log(`  - Level: ${relData.relationshipType}`);
    console.log(`  - Rolling Sentiment: ${relData.rollingSentimentScore?.toFixed(4)}`);
    console.log(`  - History: ${relData.historyType}`);
    console.log(`  - Frequency: ${relData.interactionFrequency}`);
    console.log(`  - Bursting: ${relData.isBursting}`);

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

    // 3. Directional Toxicity Logic
    const toxicityScore = analysis.isCyberbullying 
      ? analysis.confidenceScore 
      : Math.max(0.1, 1 - analysis.confidenceScore);
    
    console.log(`[AI_RESULT] Flagged: ${analysis.isCyberbullying} | Conf: ${analysis.confidenceScore.toFixed(2)} | Tox: ${toxicityScore.toFixed(2)}`);

    // 4. Climate Update (Numeric)
    await updateRelationshipBehavior(input.senderId, input.receiverId, toxicityScore);

    // 5. Persistence
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

    // 6. Behavioral Auditing (Pair-Locked)
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

    console.log(`[PROCESS] Behavioral Alerts Triggered: ${JSON.stringify(alerts)}`);
    console.log(`==================================================\n`);

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
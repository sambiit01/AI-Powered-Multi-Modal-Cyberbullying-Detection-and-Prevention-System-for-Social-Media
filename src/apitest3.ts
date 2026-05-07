import * as dotenv from 'dotenv';
import * as path from 'path';

// Absolute path loading for environment variables to resolve auth/invalid-api-key errors
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { externalModerator } from './ai/flows/external-api-moderator';
import { db } from './lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * SHIELDAI: SENTIMENT DRIFT STRESS TEST (PHASE 5)
 * 
 * Objectives:
 * 1. Establish a unique relationship context using requested IDs.
 * 2. Simulate an attack sequence to degrade rolling sentiment.
 * 3. Verify that a neutral "Pulse" message triggers the NEGATIVE_DRIFT_DETECTED alert.
 * 4. Print all database parameters and internal processes to the console.
 */
async function runDriftStressTest() {
  // Reinstating requested IDs
  const senderId = "MmOCEqXDe6VeaNoM6RAcOSE1Dkz2";
  const receiverId = "anonymous_reciever2";
  const profileId = 'educational'; 

  console.log("\n==================================================");
  console.log("🛡️ SHIELDAI: BEHAVIORAL DRIFT SIMULATION");
  console.log(`[PROCESS] Sender: ${senderId}`);
  console.log(`[PROCESS] Receiver: ${receiverId}`);
  console.log(`[PROCESS] Profile: ${profileId}`);
  console.log("==================================================\n");

  /**
   * Helper to fetch and print the relationship state from Firestore.
   */
  const logRelationshipParams = async (stage: string) => {
    const relId = [senderId, receiverId].sort().join('_');
    const relRef = doc(db, "relationships", relId);
    
    console.log(`[PROCESS] Checking Database Parameters [Stage: ${stage}]...`);
    try {
      const snap = await getDoc(relRef);
      if (snap.exists()) {
        const data = snap.data();
        console.log(`[DB_STATE] RelID: ${relId}`);
        console.log(`  - relationshipType: "${data.relationshipType}"`);
        console.log(`  - historyType: "${data.historyType}"`);
        console.log(`  - rollingSentimentScore: ${data.rollingSentimentScore?.toFixed(4)} (CLIMATE)`);
        console.log(`  - interactionCount: ${data.interactionCount}`);
        console.log(`  - isBursting: ${data.isBursting}`);
      } else {
        console.log(`[DB_STATE] No record exists yet.`);
      }
    } catch (e) {
      console.error(`[DB_ERROR] Failed to fetch state:`, e);
    }
  };

  /**
   * Helper to fetch and print the last 10 toxicity scores for this pair.
   * This shows exactly what the AI audits for NEGATIVE_DRIFT_DETECTED.
   */
  const logRecentActivities = async () => {
    console.log(`[PROCESS] Auditing Last 10 Toxicity Scores for this Pair...`);
    try {
      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef, 
        where('userId', '==', senderId),
        where('receiverId', '==', receiverId),
        limit(10) 
      );
      const snap = await getDocs(q);
      
      // Manual sort for logging output
      const docs = snap.docs.sort((a, b) => {
        const dateA = new Date(a.data().date).getTime();
        const dateB = new Date(b.data().date).getTime();
        return dateB - dateA; // Descending
      });

      if (docs.length === 0) {
        console.log(`  - No activity logs found yet.`);
      } else {
        docs.forEach((doc, idx) => {
          const d = doc.data();
          console.log(`  [${idx + 1}] Toxicity: ${d.toxicityScore?.toFixed(2)} | Text: "${d.originalText?.substring(0, 30)}..." | Date: ${d.date}`);
        });
        const highToxicityCount = docs.filter(doc => (doc.data().toxicityScore || 0) > 0.70).length;
        console.log(`  - High Toxicity Messages (>0.70): ${highToxicityCount}/10 (Alert triggers if count >= 3)`);
      }
    } catch (e) {
      console.error(`[PROCESS_ERROR] Failed to fetch activity logs:`, e);
    }
    console.log("--------------------------------------------------");
  };

  // Attack Messages sequence
  const attackMessages = [
    "You're being really annoying.",
    "I'm tired of your attitude.",
    "Stop talking to me.",
    "You are such a loser.",
    "Seriously, get lost."
  ];

  console.log("\n[STAGE 1] ATTACK SEQUENCE (DEGRADING CLIMATE)");
  for (const [idx, msg] of attackMessages.entries()) {
    console.log(`\n[MSG ${idx + 1}/5] Content: "${msg}"`);
    console.log(`[PROCESS] Analyzing toxicity and updating rolling sentiment...`);
    
    const result = await externalModerator({
      messageText: msg,
      senderId,
      receiverId,
      profileId
    });

    console.log(`[RESPONSE] Action: ${result.action.toUpperCase()}`);
    console.log(`[RESPONSE] Alerts: ${JSON.stringify(result.behavioralAlerts)}`);
    console.log(`[RESPONSE] Confidence: ${(result.confidenceScore * 100).toFixed(1)}%`);
    console.log(`[RESPONSE] Calculated Toxicity: ${result.toxicityScore?.toFixed(2)}`);
    
    await logRelationshipParams(`After Attack ${idx + 1}`);
    await logRecentActivities();
    
    // Sleep to ensure Firestore consistency
    await new Promise(r => setTimeout(r, 1500));
  }

  // Pulse Check
  console.log("\n[STAGE 2] THE PULSE VERIFICATION (THE SMOKING GUN)");
  const pulseMsg = "Fine, whatever.";
  console.log(`[PROCESS] Sending NEUTRAL Message: "${pulseMsg}"`);
  console.log(`[PROCESS] Expecting NEGATIVE_DRIFT_DETECTED due to toxic history.`);
  
  try {
    const finalResult = await externalModerator({
      messageText: pulseMsg,
      senderId,
      receiverId,
      profileId
    });

    console.log("\n==================================================");
    console.log("📊 FINAL FLOW RESPONSE:");
    console.log(JSON.stringify(finalResult, null, 2));
    console.log("==================================================");

    await logRelationshipParams("FINAL VERIFICATION");
    await logRecentActivities();

    if (finalResult.behavioralAlerts.includes("NEGATIVE_DRIFT_DETECTED")) {
      console.log("\n✅ SUCCESS: Sentiment Drift detected correctly!");
    } else {
      console.log("\n❌ FAILURE: Drift alert missing. Check thresholds.");
    }
  } catch (err) {
    console.error(`[PROCESS_ERROR] Pulse check failed:`, err);
  }
  
  process.exit(0);
}

runDriftStressTest().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
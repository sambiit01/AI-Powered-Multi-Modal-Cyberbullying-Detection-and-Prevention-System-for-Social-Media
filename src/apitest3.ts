import * as dotenv from 'dotenv';
import * as path from 'path';

// Absolute path loading for environment variables to resolve auth/invalid-api-key errors
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { externalModerator } from './ai/flows/external-api-moderator';
import { db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * SHIELDAI: SENTIMENT DRIFT STRESS TEST (PHASE 5)
 * 
 * Objectives:
 * 1. Establish a unique relationship context.
 * 2. Simulate an attack sequence to degrade rolling sentiment.
 * 3. Verify that a neutral "Pulse" message triggers the NEGATIVE_DRIFT_DETECTED alert.
 * 4. Print all database parameters and internal processes to the console.
 */
async function runDriftStressTest() {
  const senderId = `tester_drift_${Date.now()}`;
  const receiverId = `target_drift_${Date.now()}`;
  const profileId = 'educational'; 

  console.log("\n==================================================");
  console.log("🛡️ SHIELDAI: BEHAVIORAL DRIFT SIMULATION");
  console.log(`[PROCESS] Sender: ${senderId}`);
  console.log(`[PROCESS] Receiver: ${receiverId}`);
  console.log(`[PROCESS] Profile: ${profileId}`);
  console.log("==================================================\n");

  /**
   * Helper to fetch and print the relationship state from Firestore.
   * This displays the parameters taken into consideration by the AI.
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
        console.log(`  - interactionFrequency: "${data.interactionFrequency}"`);
        console.log(`  - isBursting: ${data.isBursting}`);
        console.log(`  - userCounts: ${JSON.stringify(data.userCounts)}`);
      } else {
        console.log(`[DB_STATE] No record exists yet.`);
      }
    } catch (e) {
      console.error(`[DB_ERROR] Failed to fetch state:`, e);
    }
    console.log("--------------------------------------------------");
  };

  // Step 1: Baseline
  console.log("[STAGE 1] ESTABLISHING BASELINE");
  await logRelationshipParams("PRE-BASELINE");
  
  const baselineMsg = "Hey, let's start the group project.";
  console.log(`[PROCESS] Sending Baseline: "${baselineMsg}"`);
  await externalModerator({ messageText: baselineMsg, senderId, receiverId, profileId });
  await logRelationshipParams("POST-BASELINE");
  await new Promise(r => setTimeout(r, 1500));

  // Step 2: Attack Sequence
  const attackMessages = [
    "You're being really annoying.",
    "I'm tired of your attitude.",
    "Stop talking to me.",
    "You are such a loser.",
    "Seriously, get lost."
  ];

  console.log("\n[STAGE 2] ATTACK SEQUENCE (DEGRADING CLIMATE)");
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
    
    await logRelationshipParams(`After Attack ${idx + 1}`);
    
    // Sleep to ensure Firestore consistency
    await new Promise(r => setTimeout(r, 1500));
  }

  // Step 3: Pulse Verification
  console.log("\n[STAGE 3] THE PULSE VERIFICATION (THE SMOKING GUN)");
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

console.log("[PROCESS] Initializing ShieldAI Stress Test...");
runDriftStressTest().catch(err => {
  console.error("\n❌ FATAL ERROR:");
  console.error(err);
  process.exit(1);
});
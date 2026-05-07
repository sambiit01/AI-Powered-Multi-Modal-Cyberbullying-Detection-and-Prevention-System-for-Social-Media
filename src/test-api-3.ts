import * as dotenv from 'dotenv';
import * as path from 'path';

// Absolute path loading for environment variables to resolve auth/invalid-api-key errors
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { externalModerator } from './ai/flows/external-api-moderator';
import { db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * PHASE 5: SENTIMENT DRIFT STRESS TEST
 * 
 * Objectives:
 * 1. Establish a unique relationship context.
 * 2. Simulate an attack sequence to degrade rolling sentiment.
 * 3. Verify that a neutral "Pulse" message triggers the NEGATIVE_DRIFT_DETECTED alert.
 * 4. Print all database parameters and internal processes to the console.
 */
async function performDriftTest() {
  // Use unique IDs to ensure a clean state in the database for each test run
  const senderId = `tester_sambit_${Date.now()}`;
  const receiverId = `target_aap_${Date.now()}`;
  const profileId = 'professional'; 

  console.log("\n==================================================");
  console.log("🛡️ SHIELDAI PHASE 5: SENTIMENT DRIFT STRESS TEST");
  console.log(`[PROCESS] Sender: ${senderId}`);
  console.log(`[PROCESS] Receiver: ${receiverId}`);
  console.log(`[PROCESS] Moderation Profile: ${profileId}`);
  console.log("==================================================\n");

  /**
   * Helper to fetch and print the relationship state from Firestore.
   * This shows the "parameters taken into consideration" from the DB.
   */
  const logRelationshipParams = async (stage: string) => {
    const relId = [senderId, receiverId].sort().join('_');
    const relRef = doc(db, "relationships", relId);
    
    console.log(`[PROCESS] Inspecting Database for stage: ${stage}...`);
    try {
      const snap = await getDoc(relRef);
      if (snap.exists()) {
        const data = snap.data();
        console.log(`[DB_STATE] Relationship ID: ${relId}`);
        console.log(`  - Relationship Level: ${data.relationshipType}`);
        console.log(`  - Rolling Sentiment Score: ${data.rollingSentimentScore?.toFixed(4)} (Climate)`);
        console.log(`  - History Sentiment: ${data.historyType}`);
        console.log(`  - Interaction Count: ${data.interactionCount}`);
        console.log(`  - Interaction Frequency: ${data.interactionFrequency}`);
        console.log(`  - Bursting Mode: ${data.isBursting}`);
        console.log(`  - Participants: ${JSON.stringify(data.participants)}`);
      } else {
        console.log(`[DB_STATE] No relationship document found yet (expected for first message).`);
      }
    } catch (e) {
      console.error(`[DB_ERROR] Failed to fetch relationship data:`, e);
    }
    console.log("--------------------------------------------------");
  };

  const attackMessages = [
    "You're being really annoying.",
    "I'm tired of your attitude.",
    "Stop talking to me.",
    "You are such a loser.",
    "Seriously, get lost."
  ];

  console.log("--- [STAGE 1] ATTACK SIMULATION ---");
  console.log("[PROCESS] Sending 5 messages to degrade the vibe...");

  for (const [idx, msg] of attackMessages.entries()) {
    console.log(`\n[MSG ${idx + 1}/5] Content: "${msg}"`);
    
    try {
      console.log(`[PROCESS] Invoking External API Moderator...`);
      const result = await externalModerator({
        messageText: msg,
        senderId,
        receiverId,
        profileId
      });

      console.log(`[FLOW_RESPONSE] Action: ${result.action.toUpperCase()}`);
      console.log(`[FLOW_RESPONSE] Alerts: ${JSON.stringify(result.behavioralAlerts)}`);
      console.log(`[FLOW_RESPONSE] Confidence: ${(result.confidenceScore * 100).toFixed(1)}%`);
      
      // Print parameters after update
      await logRelationshipParams(`After Message ${idx + 1}`);
      
      // Delay to ensure Firestore write propagates for the next query
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[PROCESS_ERROR] Failed at message ${idx + 1}:`, err);
    }
  }

  console.log("\n--- [STAGE 2] THE PULSE VERIFICATION ---");
  const pulseMsg = "Fine, whatever.";
  console.log(`[PROCESS] Sending NEUTRAL Pulse: "${pulseMsg}"`);
  console.log(`[PROCESS] This message should trigger DRIFT alert despite being "Safe".`);
  
  try {
    const finalResult = await externalModerator({
      messageText: pulseMsg,
      senderId,
      receiverId,
      profileId
    });

    console.log("\n==================================================");
    console.log("📊 FINAL FLOW RESPONSE JSON:");
    console.log(JSON.stringify(finalResult, null, 2));
    console.log("==================================================");

    // Final state check
    await logRelationshipParams("Final State Verification");

    if (finalResult.behavioralAlerts.includes("NEGATIVE_DRIFT_DETECTED")) {
      console.log("\n✅ SUCCESS: Negative Sentiment Drift successfully detected!");
    } else {
      console.log("\n❌ FAILURE: Drift alert missing. Check rolling sentiment thresholds.");
    }
  } catch (err) {
    console.error(`[PROCESS_ERROR] Pulse check failed:`, err);
  }
  
  process.exit(0);
}

// Global process logging
console.log("[PROCESS] Initializing ShieldAI Test Environment...");
performDriftTest().catch(err => {
  console.error("\n❌ TEST CRITICAL FAILURE:");
  console.error(err);
  process.exit(1);
});

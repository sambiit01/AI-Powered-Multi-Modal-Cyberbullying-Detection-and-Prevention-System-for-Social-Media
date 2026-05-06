import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

import { externalModerator } from './ai/flows/external-api-moderator';

/**
 * PHASE 5: SENTIMENT DRIFT STRESS TEST
 * 
 * Scenario:
 * 1. Send 5 toxic (but not necessarily flaggable) messages to degrade sentiment.
 * 2. Send a neutral "Pulse" message.
 * 3. Verify NEGATIVE_DRIFT_DETECTED alert.
 */
async function performDriftTest() {
  const senderId = `samb`;
  const receiverId = `aap`;
  const profileId = 'professional';

  console.log("\n==================================================");
  console.log("🚀 SHIELDAI PHASE 5: SENTIMENT DRIFT TEST");
  console.log(`Target: ${senderId} -> ${receiverId}`);
  console.log("==================================================\n");

  const attackMessages = [
    "You're being really annoying.",
    "I'm tired of your attitude.",
    "Stop talking to me.",
    "You are such a loser.",
    "Seriously, get lost."
  ];

  console.log("--- [STAGE 1] ATTACK SIMULATION ---");
  for (const [idx, msg] of attackMessages.entries()) {
    console.log(`\n[MSG ${idx + 1}/5] "${msg}"`);
    const result = await externalModerator({
      messageText: msg,
      senderId,
      receiverId,
      profileId
    });
    console.log(`>> Result: ${result.action.toUpperCase()} | Alerts: [${result.behavioralAlerts.join(', ')}]`);
    
    // Small delay to ensure Firestore consistency
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log("\n--- [STAGE 2] THE PULSE VERIFICATION ---");
  const pulseMsg = "Fine, whatever.";
  console.log(`[PULSE] "${pulseMsg}"`);
  
  const finalResult = await externalModerator({
    messageText: pulseMsg,
    senderId,
    receiverId,
    profileId
  });

  console.log("\n==================================================");
  console.log("📊 FINAL JSON RESPONSE:");
  console.log(JSON.stringify(finalResult, null, 2));
  console.log("==================================================");

  if (finalResult.behavioralAlerts.includes("NEGATIVE_DRIFT_DETECTED")) {
    console.log("\n✅ SUCCESS: Negative Sentiment Drift detected!");
  } else {
    console.log("\n❌ FAILURE: Drift alert missing. Check rolling score logic.");
  }
  
  process.exit(0);
}

performDriftTest().catch(err => {
  console.error("\n❌ TEST CRITICAL FAILURE:");
  console.error(err);
  process.exit(1);
});

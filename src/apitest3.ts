
import * as dotenv from 'dotenv';
import * as path from 'path';

// Absolute path loading for environment variables to resolve auth/invalid-api-key errors
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { externalModerator } from './ai/flows/external-api-moderator';

/**
 * SHIELDAI: CROSS-PAIR BEHAVIORAL AUDIT (CENTRALIZED LOGGING)
 * 
 * Objectives:
 * 1. Simulate alternating interactions between one sender and two different targets.
 * 2. Verify that drift logic is 'Pair-Locked' and centralized logs show the process.
 */
async function runCrossPairDriftTest() {
  const userA = "adi";
  const userB = "cpim";
  const userC = "sambit";
  const profileId = 'professional'; 

  const conversationQueue = [
    { from: userA, to: userB, text: "You're honestly so slow at this.", type: "TOXIC" },
    { from: userA, to: userC, text: "Great job on that presentation, Charlie!", type: "HEALTHY" },
    { from: userA, to: userB, text: "I can't believe we have to work together.", type: "TOXIC" },
    { from: userA, to: userC, text: "Thanks for the help earlier.", type: "HEALTHY" },
    { from: userA, to: userB, text: "You are a complete waste of desk space.", type: "TOXIC" },
    { from: userA, to: userC, text: "Lunch later? My treat.", type: "HEALTHY" },
    { from: userA, to: userB, text: "Just stay out of my way, idiot.", type: "TOXIC" }, // Should trigger Drift for B
    { from: userA, to: userC, text: "You're the best, Charlie.", type: "HEALTHY" },   // Should NOT trigger Drift for C
  ];

  console.log("\n==================================================");
  console.log("🛡️ SHIELDAI: CROSS-PAIR BEHAVIORAL SIMULATION");
  console.log(`[PROCESS] Test Driver Started`);
  console.log("==================================================\n");

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  
  for (const [idx, item] of conversationQueue.entries()) {
    console.log(`\n[DRIVER] Queue Item ${idx + 1}/${conversationQueue.length}: ${item.from} -> ${item.to}`);
    
    // Minimal delay to ensure sequential Firestore writes propagate
    await delay(12000); 
    
    try {
      // The flow itself handles all "Process Logging" now
      const result = await externalModerator({
        messageText: item.text,
        senderId: item.from,
        receiverId: item.to,
        profileId
      });

      console.log(`[DRIVER] AI Decision: ${result.action.toUpperCase()}`);
      
      if (result.behavioralAlerts.includes("NEGATIVE_DRIFT_DETECTED")) {
        console.log(`🚨 [DRIVER] DRIFT DETECTED for pair ${item.from} -> ${item.to}`);
      }

    } catch (err) {
      console.error(`[DRIVER_ERROR] Message ${idx + 1} failed:`, err);
    }
  }

  console.log("\n==================================================");
  console.log("🏁 SIMULATION DRIVER COMPLETE");
  console.log("==================================================\n");
  process.exit(0);
}

runCrossPairDriftTest().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});

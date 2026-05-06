import * as dotenv from 'dotenv';
// Absolute earliest initialization of env vars
dotenv.config();
dotenv.config({ path: '.env.local' });

import { runFlow } from '@genkit-ai/flow';
import { externalApiModerator } from './ai/flows/external-api-moderator';
import { db } from './lib/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

/**
 * Utility to seed behavioral states that would otherwise 
 * take hundreds of messages to form naturally.
 */
async function seedRelationshipState(sender: string, receiver: string, type: 'Close Friend' | 'Stalker') {
  const relId = [sender, receiver].sort().join('_');
  const now = Date.now();
  
  if (type === 'Close Friend') {
    await setDoc(doc(db, "relationships", relId), {
      interactionCount: 150,
      userCounts: { [sender]: 75, [receiver]: 75 },
      relationshipType: 'Close Friend',
      historyType: 'Friendly',
      rollingSentimentScore: 0.9,
      participants: [sender, receiver],
      lastInteraction: new Date().toISOString()
    });
  } else if (type === 'Stalker') {
    await setDoc(doc(db, "relationships", relId), {
      interactionCount: 10,
      userCounts: { [sender]: 10, [receiver]: 0 },
      messageTimestamps: { 
        [sender]: [now, now-1000, now-2000, now-3000, now-4000] 
      },
      relationshipType: 'Stranger',
      rollingSentimentScore: 0.4,
      participants: [sender, receiver],
      lastInteraction: new Date().toISOString()
    });
  }
}

async function runShieldAITests() {
  console.log("\n============================================================");
  console.log("🛡️ SHIELDAI EXTERNAL API COMPREHENSIVE SUITE");
  console.log("============================================================\n");

  const scenarios = [
    {
      name: "Scenario A: Zero Tolerance (Guardian Lens)",
      input: {
        messageText: "You are a total failure.",
        senderId: "student_x",
        receiverId: "student_y",
        profileId: "guardian"
      },
      expectation: "ACTION: BLOCK | ALERT: HIGH_CONFIDENCE_LOW_BOND"
    },
    {
      name: "Scenario B: Bonded Banter (Professional Lens)",
      setup: () => seedRelationshipState("dev_a", "dev_b", "Close Friend"),
      input: {
        messageText: "You are a total failure.",
        senderId: "dev_a",
        receiverId: "dev_b",
        profileId: "professional"
      },
      expectation: "ACTION: ALLOW | REASON: Playful banter allowed between friends."
    },
    {
      name: "Scenario C: Behavioral Risk (Bursting & Drift Check)",
      setup: () => seedRelationshipState("stalker", "victim", "Stalker"),
      input: {
        messageText: "Why are you ignoring me?",
        senderId: "stalker",
        receiverId: "victim",
        profileId: "standard"
      },
      expectation: "ALERTS: ['BURST_DETECTED', 'NEGATIVE_DRIFT_DETECTED']"
    }
  ];

  for (const scenario of scenarios) {
    console.log(`▶️ EXECUTING: ${scenario.name}`);
    console.log(`💡 EXPECTED: ${scenario.expectation}`);

    if (scenario.setup) await scenario.setup();

    try {
      const result = await runFlow(externalApiModerator, scenario.input);
      console.log("--- RESULT ---");
      console.log(`ACTION: ${result.action.toUpperCase()}`);
      console.log(`ALERTS: ${JSON.stringify(result.behavioralAlerts)}`);
      console.log(`REASON: ${result.reasoning}`);
      console.log("--------------\n");
    } catch (e) {
      console.error(`❌ Flow Error: ${e}\n`);
    }
    
    // Brief sleep to avoid gRPC stream contention in terminal
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log("============================================================");
  console.log("🏁 TEST SUITE COMPLETE");
  console.log("============================================================\n");
}

runShieldAITests().catch(console.error);
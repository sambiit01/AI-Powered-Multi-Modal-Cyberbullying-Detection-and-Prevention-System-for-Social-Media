
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from both standard .env and .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { externalModerator } from './ai/flows/external-api-moderator';
import { db } from './lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Utility to seed behavioral states for testing different scenarios.
 * This ensures the database has the required context before analysis.
 */
async function seedRelationshipState(sender: string, receiver: string, type: 'Close Friend' | 'Stalker') {
  const relId = [sender, receiver].sort().join('_');
  const now = Date.now();
  
  if (type === 'Close Friend') {
    console.log(`[SEED] Creating Close Friend bond for ${relId}`);
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
    console.log(`[SEED] Creating Stalker/Bursting state for ${relId}`);
    await setDoc(doc(db, "relationships", relId), {
      interactionCount: 10,
      userCounts: { [sender]: 10, [receiver]: 0 },
      messageTimestamps: { 
        [sender]: [now, now-1000, now-2000, now-3000, now-4000] 
      },
      relationshipType: 'Stranger',
      rollingSentimentScore: 0.4,
      participants: [sender, receiver],
      lastInteraction: new Date().toISOString(),
      isBursting: true
    });
  }
}

async function runShieldAITests() {
  console.log("\n============================================================");
  console.log("🛡️ SHIELDAI EXTERNAL API COMPREHENSIVE SUITE");
  console.log("============================================================\n");

  const scenarios = [
    {
      name: "Scenario A: School Environment (Guardian Lens)",
      input: {
        messageText: "You are a total failure.",
        senderId: "student_x",
        receiverId: "student_y",
        profileId: "guardian"
      },
      expectation: "ACTION: BLOCK | ALERT: HIGH_CONFIDENCE_LOW_BOND"
    },
    {
      name: "Scenario B: Dev Team Banter (Professional Lens)",
      setup: () => seedRelationshipState("dev_a", "dev_b", "Close Friend"),
      input: {
        messageText: "You are a total failure.",
        senderId: "dev_a",
        receiverId: "dev_b",
        profileId: "professional"
      },
      expectation: "ACTION: ALLOW | REASON: Playful banter allowed between bonded friends."
    },
    {
      name: "Scenario C: Behavioral Risk Detection (Bursting)",
      setup: () => seedRelationshipState("stalker", "victim", "Stalker"),
      input: {
        messageText: "Are you there? Answer me.",
        senderId: "stalker",
        receiverId: "victim",
        profileId: "standard"
      },
      expectation: "ALERTS: ['BURST_DETECTED']"
    }
  ];

  for (const scenario of scenarios) {
    console.log(`▶️ EXECUTING: ${scenario.name}`);
    console.log(`💡 EXPECTED: ${scenario.expectation}`);

    if (scenario.setup) await scenario.setup();

    try {
      // Calling the flow function directly to avoid @genkit-ai/flow dependency
      const result = await externalModerator(scenario.input);
      console.log("--- RESULT ---");
      console.log(`ACTION: ${result.action.toUpperCase()}`);
      console.log(`ALERTS: ${JSON.stringify(result.behavioralAlerts)}`);
      console.log(`REASON: ${result.reasoning}`);
      console.log("--------------\n");
    } catch (e) {
      console.error(`❌ Execution Error: ${e}\n`);
    }
    
    // Brief sleep for Firestore consistency
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log("============================================================");
  console.log("🏁 TEST SUITE COMPLETE");
  console.log("============================================================\n");
}

runShieldAITests().catch(console.error);


import * as dotenv from 'dotenv';
dotenv.config();

import { runFlow } from '@genkit-ai/flow';
import { externalApiModerator } from './ai/flows/external-api-moderator';
import { db } from './lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

async function seedTestData() {
  console.log("🌱 SEEDING TEST DATA...");
  
  // Seed a 'Close Friend' bond for Scenario B
  const devRelId = ['dev_1', 'dev_2'].sort().join('_');
  await setDoc(doc(db, "relationships", devRelId), {
    interactionCount: 150,
    userCounts: { dev_1: 75, dev_2: 75 },
    relationshipType: 'Close Friend',
    historyType: 'Friendly',
    rollingSentimentScore: 0.9,
    participants: ['dev_1', 'dev_2'],
    lastInteraction: new Date().toISOString()
  });

  // Seed a 'Bursting' scenario for Scenario C
  const stalkerRelId = ['stalker_user', 'target_user'].sort().join('_');
  const now = Date.now();
  await setDoc(doc(db, "relationships", stalkerRelId), {
    interactionCount: 10,
    userCounts: { stalker_user: 10, target_user: 0 },
    messageTimestamps: { 
      stalker_user: [now, now-1000, now-2000, now-3000, now-4000] 
    },
    participants: ['stalker_user', 'target_user']
  });
}

async function runShieldAITests() {
  console.log("🛡️ SHIELDAI EXTERNAL API TEST SUITE\n");

  await seedTestData();

  const testCases = [
    {
      name: "Scenario A: School Environment (Guardian Lens)",
      input: {
        messageText: "You are a total failure.",
        senderId: "student_1",
        receiverId: "student_2",
        profileId: "guardian"
      },
      expectation: "Should BLOCK due to strict zero-tolerance thresholds."
    },
    {
      name: "Scenario B: Dev Team Banter (Professional Lens)",
      input: {
        messageText: "You are a total failure.",
        senderId: "dev_1",
        receiverId: "dev_2",
        profileId: "professional"
      },
      expectation: "Should ALLOW because professional lens permits higher banter between bonded pairs."
    },
    {
      name: "Scenario C: Behavioral Risk Detection (Bursting)",
      input: {
        messageText: "Are you there?",
        senderId: "stalker_user",
        receiverId: "target_user",
        profileId: "standard"
      },
      expectation: "Should ALLOW message but return ['BURST_DETECTED'] in behavioralAlerts."
    }
  ];

  for (const scenario of testCases) {
    console.log(`\n▶️ Testing: ${scenario.name}`);
    console.log(`💡 Expectation: ${scenario.expectation}`);
    
    try {
      const result = await runFlow(externalApiModerator, scenario.input);
      
      console.log("--- API RESPONSE ---");
      console.log(`ACTION: ${result.action.toUpperCase()}`);
      console.log(`REASONING: ${result.reasoning}`);
      console.log(`ALERTS: ${JSON.stringify(result.behavioralAlerts)}`);
      console.log("--------------------");
    } catch (error) {
      console.error(`❌ Error running flow: ${error}\n`);
    }
  }
}

runShieldAITests().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables immediately to resolve auth errors
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { externalModerator } from './ai/flows/external-api-moderator';

/**
 * SHIELDAI: 10-MESSAGE STRESS TEST (DRIVER)
 * This script is a clean driver. All internal logging and database
 * inspection happens within the externalModerator flow.
 */
async function runMasterTest() {
  const senderId = `samb`;
  const receiverId = `aap`;
  const profileId = 'educational'; 

  const messages = [
    { text: "Hey team, let's get this done.", type: "Friendly" },
    { text: "You're doing a great job.", type: "Friendly" },
    { text: "I'm not sure about your last commit.", type: "Neutral" },
    { text: "Honestly, your logic is kind of stupid lol.", type: "Toxic/Banter" }, 
    { text: "Are you even trying today?", type: "Toxic/Banter" },               
    { text: "Let's just move on.", type: "Neutral" },
    { text: "You're a total failure at debugging.", type: "Toxic/Banter" },      
    { text: "Whatever, I'll fix it myself.", type: "Toxic/Banter" },             
    { text: "Can we meet at 5?", type: "Neutral" },
    { text: "Just don't be late, idiot.", type: "Toxic/Banter" }                
  ];

  console.log("\n==================================================");
  console.log(`🚀 SHIELDAI 10-MESSAGE STRESS TEST [Profile: ${profileId}]`);
  console.log(`Target: ${senderId} -> ${receiverId}`);
  console.log("==================================================\n");

  for (let i = 0; i < messages.length; i++) {
    console.log(`[DRIVER] Executing Item ${i + 1}/${messages.length}: "${messages[i].text}"`);
    
    try {
      const result = await externalModerator({
        messageText: messages[i].text,
        senderId,
        receiverId,
        profileId
      });

      console.log(`[DRIVER] AI Decision: ${result.action.toUpperCase()}`);
      if (result.behavioralAlerts.length > 0) {
        console.log(`[DRIVER] Alerts Received: ${JSON.stringify(result.behavioralAlerts)}`);
      }
      
      // Delay to ensure Firestore write consistency and prevent terminal flooding
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[DRIVER_ERROR] Failed at item ${i + 1}:`, err);
    }
  }

  console.log("\n==================================================");
  console.log("🏁 STRESS TEST COMPLETE");
  console.log("==================================================\n");
}

runMasterTest().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
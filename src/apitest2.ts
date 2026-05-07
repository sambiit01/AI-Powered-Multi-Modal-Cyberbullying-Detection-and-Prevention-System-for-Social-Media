import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables immediately
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { externalModerator } from './ai/flows/external-api-moderator';

async function runMasterTest() {
  const senderId = `biri`;
  const receiverId = `churut`;
  const profileId = 'professional'; 

  const messages = [
    { text: "You shoud get laid motherfucker.", type: "Friendly" },
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
    console.log(`--- Message ${i + 1}: "${messages[i].text}" ---`);
    
    try {
      const result = await externalModerator({
        messageText: messages[i].text,
        senderId,
        receiverId,
        profileId
      });

      console.log(`Action: ${result.action.toUpperCase()}`);
      console.log(`Confidence: ${(result.confidenceScore * 100).toFixed(1)}%`);
      console.log(`Alerts: ${JSON.stringify(result.behavioralAlerts)}`);
      
      if (result.behavioralAlerts.includes("NEGATIVE_DRIFT_DETECTED")) {
        console.log("🚨 ALERT: Negative Drift was detected at message " + (i + 1));
      }
      
      // Mandatory sleep for Firestore consistency
      await new Promise(r => setTimeout(r, 1200));
    } catch (err) {
      console.error(`❌ Error at message ${i + 1}:`, err);
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
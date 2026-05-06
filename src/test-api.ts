/**
 * @fileOverview Test script for the External API Moderator flow.
 */
import { config } from 'dotenv';
config();

import { externalModerator } from './ai/flows/external-api-moderator';

async function performTest() {
  console.log("--------------------------------------------------");
  console.log("🚀 Starting ShieldAI Phase 4 Contrast Test...");
  console.log("--------------------------------------------------");

  try {
    const testMessage = "you sure are a big piece of ass that surely does needs to get laid ";

    console.log(`\n[TEST 1] Testing with 'guardian' lens...`);
    const guardianResult = await externalModerator({
      messageText: testMessage,
      senderId: "MmOCEqXDe6VeaNoM6RAcOSE1Dkz2",
      receiverId: "adi_cpim",
      profileId: "guardian"
    });
    console.log("🛡️ GUARDIAN Result:");
    console.log(JSON.stringify(guardianResult, null, 2));

    console.log(`\n[TEST 2] Testing with 'professional' lens...`);
    const profResult = await externalModerator({
      messageText: testMessage,
      senderId: "adi",
      receiverId: "cpim",
      profileId: "professional"
    });
    console.log("💼 PROFESSIONAL Result:");
    console.log(JSON.stringify(profResult, null, 2));

    console.log("\n--------------------------------------------------");
    console.log("✅ Contrast Test Complete.");
    console.log("--------------------------------------------------");
  } catch (error: any) {
    console.error("\n❌ Test Failed!");
    console.error("Error Message:", error.message || error);
  }
  
  process.exit(0);
}

performTest();
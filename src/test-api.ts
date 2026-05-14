/**
 * @fileOverview Phase 4 Contrast Test (DRIVER)
 * This script is a clean driver. All internal logging and database
 * inspection happens within the externalModerator flow.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables immediately to resolve auth errors
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { externalModerator } from './ai/flows/external-api-moderator';

async function performTest() {
  console.log("\n==================================================");
  console.log("🚀 Starting ShieldAI Phase 4 Contrast Test...");
  console.log("==================================================\n");

  const testMessage = "you sure are a big piece of ass that surely does needs to get laid ";

  try {
    // Test 1: Guardian Lens
    console.log(`[DRIVER] TEST 1: Executing with 'guardian' lens...`);
    const guardianResult = await externalModerator({
      messageText: testMessage,
      senderId: "MmOCEqXDe6VeaNoM6RAcOSE1Dkz2",
      receiverId: "adi_cpim",
      profileId: "guardian"
    });
    console.log("🛡️ GUARDIAN Result Action:", guardianResult.action.toUpperCase());
    console.log("🛡️ GUARDIAN Alerts:", JSON.stringify(guardianResult.behavioralAlerts));

    // Brief sleep for database consistency
    await new Promise(r => setTimeout(r, 2000));

    // Test 2: Professional Lens
    console.log(`\n[DRIVER] TEST 2: Executing with 'professional' lens...`);
    const profResult = await externalModerator({
      messageText: testMessage,
      senderId: "adi",
      receiverId: "cpim",
      profileId: "professional"
    });
    console.log("💼 PROFESSIONAL Result Action:", profResult.action.toUpperCase());
    console.log("💼 PROFESSIONAL Alerts:", JSON.stringify(profResult.behavioralAlerts));

    console.log("\n==================================================");
    console.log("✅ Contrast Test Complete.");
    console.log("==================================================\n");
  } catch (error: any) {
    console.error("\n❌ TEST CRITICAL FAILURE:");
    console.error(error.message || error);
  }
  
  process.exit(0);
}

performTest();
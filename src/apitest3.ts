import { runFlow } from '@genkit-ai/flow';
import { externalModerator } from './ai/flows/external-api-moderator';

async function runSocialTriangleTest() {
  const userA = "USER_ALICE";
  const userB = "USER_BOB";
  const userC = "USER_CHARLIE";
  const profile = "professional"; // High tolerance to test "Climate" vs "Law"

  console.log("🚀 STARTING MULTI-USER ISOLATION TEST");
  console.log("---------------------------------------");

  // We will interleave the messages to simulate real-time chat traffic
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

  for (const [index, msg] of conversationQueue.entries()) {
    console.log(`\n[MSG ${index + 1}] ${msg.from} -> ${msg.to}: "${msg.text}"`);
    
    const result = await runFlow(externalModerator, {
      messageText: msg.text,
      senderId: msg.from,
      receiverId: msg.to,
      profileId: profile
    });

    const hasDrift = result.behavioralAlerts.includes("NEGATIVE_DRIFT_DETECTED");
    
    console.log(` > Action: ${result.action.toUpperCase()}`);
    console.log(` > Alerts: ${JSON.stringify(result.behavioralAlerts)}`);

    // VERIFICATION LOGIC
    if (msg.to === userB && hasDrift) {
      console.log(` ✅ SUCCESS: Correctly detected toxic drift for the ALICE-BOB pair.`);
    } 
    if (msg.to === userC && hasDrift) {
      console.log(` ❌ FAILURE: Toxic drift leaked from Bob's history into CHARLIE'S conversation!`);
    }
  }

  console.log("\n---------------------------------------");
  console.log("TEST COMPLETE: Check Firestore to verify different Rolling Scores for Bob vs Charlie.");
}

runSocialTriangleTest().catch(console.error);
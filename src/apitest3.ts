import * as dotenv from 'dotenv';
import * as path from 'path';

// Absolute path loading for environment variables to resolve auth/invalid-api-key errors
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { externalModerator } from './ai/flows/external-api-moderator';
import { db } from './lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * SHIELDAI: CROSS-PAIR BEHAVIORAL AUDIT (PHASE 5)
 * 
 * Objectives:
 * 1. Simulate alternating interactions between one sender and two different targets.
 * 2. Verify that drift logic is 'Pair-Locked' (Toxic history with User B doesn't affect User C).
 * 3. Print the last 10 toxicity scores for each pair to show the AI's audit trail.
 */
async function runCrossPairDriftTest() {
  const userA = "MmOCEqXDe6VeaNoM6RAcOSE1Dkz2";
  const userB = "target_user_toxic_B";
  const userC = "target_user_healthy_C";
  const profileId = 'educational'; 

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
  console.log(`[PROCESS] Main Sender: ${userA}`);
  console.log(`[PROCESS] Target B (Toxic): ${userB}`);
  console.log(`[PROCESS] Target C (Healthy): ${userC}`);
  console.log("==================================================\n");

  /**
   * Helper to fetch and print the relationship state from Firestore.
   */
  const logRelationshipParams = async (sender: string, receiver: string, label: string) => {
    const relId = [sender, receiver].sort().join('_');
    const relRef = doc(db, "relationships", relId);
    
    try {
      const snap = await getDoc(relRef);
      if (snap.exists()) {
        const data = snap.data();
        console.log(`[DB_STATE] Pair: ${label} (${relId})`);
        console.log(`  - rollingSentimentScore: ${data.rollingSentimentScore?.toFixed(4)} (CLIMATE)`);
        console.log(`  - historyType: "${data.historyType}"`);
      }
    } catch (e) {
      console.error(`[DB_ERROR] Failed to fetch state:`, e);
    }
  };

  /**
   * Helper to fetch and print the last 10 toxicity scores for a specific pair.
   */
  const logPairActivityAudit = async (sender: string, receiver: string) => {
    console.log(`[PROCESS] Auditing Pair History: ${sender} -> ${receiver}...`);
    try {
      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef, 
        where('userId', '==', sender),
        where('receiverId', '==', receiver),
        limit(10) 
      );
      const snap = await getDocs(q);
      
      const docs = snap.docs.sort((a, b) => {
        const dateA = new Date(a.data().date).getTime();
        const dateB = new Date(b.data().date).getTime();
        return dateB - dateA;
      });

      if (docs.length === 0) {
        console.log(`  - No activity logs found for this pair.`);
      } else {
        docs.forEach((doc, idx) => {
          const d = doc.data();
          console.log(`  [${idx + 1}] Tox: ${d.toxicityScore?.toFixed(2)} | Text: "${d.originalText?.substring(0, 30)}..."`);
        });
        const highToxicityCount = docs.filter(doc => (doc.data().toxicityScore || 0) > 0.70).length;
        console.log(`  - High Toxicity Messages: ${highToxicityCount}/10 (Threshold for DRIFT alert is 3)`);
      }
    } catch (e) {
      console.error(`[PROCESS_ERROR] Failed to fetch audit:`, e);
    }
    console.log("--------------------------------------------------");
  };

  for (const [idx, item] of conversationQueue.entries()) {
    const label = item.to === userB ? "TOXIC_TARGET_B" : "HEALTHY_TARGET_C";
    console.log(`\n[MESSAGE ${idx + 1}/${conversationQueue.length}] ${item.from} -> ${item.to} (${label})`);
    console.log(`Content: "${item.text}"`);
    
    try {
      const result = await externalModerator({
        messageText: item.text,
        senderId: item.from,
        receiverId: item.to,
        profileId
      });

      console.log(`[FLOW_RESPONSE] Action: ${result.action.toUpperCase()}`);
      console.log(`[FLOW_RESPONSE] Alerts: ${JSON.stringify(result.behavioralAlerts)}`);
      
      if (result.behavioralAlerts.includes("NEGATIVE_DRIFT_DETECTED")) {
        console.log(`🚨 ALERT: Drift detected for pair ${item.from} -> ${item.to}`);
      }

      await logRelationshipParams(item.from, item.to, label);
      await logPairActivityAudit(item.from, item.to);
      
      // Wait for Firestore consistency
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[ERROR] Message ${idx + 1} failed:`, err);
    }
  }

  console.log("\n==================================================");
  console.log("🏁 SIMULATION COMPLETE");
  console.log("==================================================\n");
  process.exit(0);
}

runCrossPairDriftTest().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
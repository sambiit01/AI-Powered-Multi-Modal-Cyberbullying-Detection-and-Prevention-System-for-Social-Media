
// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Maps interaction count to relationship level.
 */
function calculateRelationshipLevel(totalCount: number, isBidirectional: boolean): string {
  const effectiveCount = isBidirectional ? totalCount * 2 : totalCount;
  if (effectiveCount <= 5) return 'Stranger';
  if (effectiveCount <= 50) return 'Acquaintance';
  if (effectiveCount <= 200) return 'Frequent Contact';
  return 'Close Friend';
}

/**
 * Fetches or creates a relationship document between two users.
 * Now handles behavioral inference metrics.
 */
export async function getOrCreateRelationship(senderId: string, receiverId: string) {
  console.log(`[DATABASE] Fetching relationship for: ${senderId} <-> ${receiverId}`);
  const relId = [senderId, receiverId].sort().join('_');
  const relRef = doc(db, "relationships", relId);
  
  try {
    const relDoc = await getDoc(relRef);

    if (relDoc.exists()) {
      const data = relDoc.data();
      console.log(`[DATABASE] Relationship found:`, data);
      
      // Calculate isBursting context
      const now = Date.now();
      const senderTimestamps = (data.messageTimestamps?.[senderId] || []) as number[];
      const receiverTimestamps = (data.messageTimestamps?.[receiverId] || []) as number[];
      
      let isBursting = false;
      if (senderTimestamps.length >= 10) {
        const tenMessagesAgo = senderTimestamps[senderTimestamps.length - 10];
        const twoMinutesAgo = now - 120000;
        
        // Sender sent 10 in 2 mins
        const sentTenInTwoMins = tenMessagesAgo > twoMinutesAgo;
        // Receiver sent 0 in 2 mins
        const receiverInactive = !receiverTimestamps.some(ts => ts > twoMinutesAgo);
        
        isBursting = sentTenInTwoMins && receiverInactive;
      }

      return {
        ...data,
        isBursting,
        interactionFrequency: isBursting ? 'High (Bursting)' : 'Normal'
      };
    } else {
      console.log(`[DATABASE] No relationship found. Creating default: Stranger/None`);
      const initialData = {
        interactionCount: 0,
        userCounts: { [senderId]: 0, [receiverId]: 0 },
        relationshipType: 'Stranger',
        historyType: 'Neutral',
        rollingSentimentScore: 0.5,
        messageTimestamps: { [senderId]: [], [receiverId]: [] },
        participants: [senderId, receiverId],
        lastInteraction: new Date().toISOString()
      };
      
      setDoc(relRef, initialData).catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: relRef.path,
          operation: 'create',
          requestResourceData: initialData
        }));
      });

      return { ...initialData, isBursting: false, interactionFrequency: 'Normal' };
    }
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: relRef.path,
        operation: 'get'
      }));
    }
    throw error;
  }
}

/**
 * Updates relationship metrics after an interaction.
 */
export async function updateRelationshipBehavior(senderId: string, receiverId: string, isSafe: boolean) {
  const relId = [senderId, receiverId].sort().join('_');
  const relRef = doc(db, "relationships", relId);
  const now = Date.now();

  try {
    const relDoc = await getDoc(relRef);
    if (!relDoc.exists()) return;

    const data = relDoc.data();
    const userCounts = data.userCounts || { [senderId]: 0, [receiverId]: 0 };
    userCounts[senderId] = (userCounts[senderId] || 0) + 1;

    const totalCount = (data.interactionCount || 0) + 1;
    const isBidirectional = (userCounts[senderId] > 0 && userCounts[receiverId] > 0);
    
    // Update Timestamps (last 10)
    const timestamps = data.messageTimestamps || { [senderId]: [], [receiverId]: [] };
    timestamps[senderId] = [now, ...(timestamps[senderId] || [])].slice(0, 10);

    // Update Sentiment
    let sentiment = data.rollingSentimentScore || 0.5;
    if (isSafe) {
      sentiment = Math.min(1.0, sentiment + 0.05);
    } else {
      sentiment = Math.max(0.0, sentiment - 0.1);
    }

    const newLevel = calculateRelationshipLevel(totalCount, isBidirectional);
    const newHistory = sentiment > 0.8 ? 'Friendly' : 'Neutral';

    await updateDoc(relRef, {
      interactionCount: increment(1),
      userCounts,
      messageTimestamps: timestamps,
      rollingSentimentScore: sentiment,
      relationshipType: newLevel,
      historyType: newHistory,
      lastInteraction: new Date().toISOString()
    });
  } catch (err) {
    console.error("[DATABASE] Error updating behavior metrics:", err);
  }
}


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
 * Calculates interaction frequency based on timing and volume.
 */
function calculateInteractionFrequency(count: number, lastInteractionIso: string): string {
  if (count <= 1) return 'One-time';
  
  const lastDate = new Date(lastInteractionIso).getTime();
  const now = Date.now();
  const diffHours = (now - lastDate) / (1000 * 60 * 60);

  // If talked within 48 hours and has a decent history
  if (diffHours < 48 && count > 5) return 'Often';
  return 'Occasional';
}

/**
 * Calculates if a user is currently bursting (flooding messages).
 */
function calculateIsBursting(timestamps: { [uid: string]: number[] }, senderId: string, receiverId: string): boolean {
  const now = Date.now();
  const senderTimestamps = timestamps[senderId] || [];
  const receiverTimestamps = timestamps[receiverId] || [];
  
  if (senderTimestamps.length >= 10) {
    const twoMinutesAgo = now - 120000;
    
    // Check if the 10th most recent message was sent within 2 minutes
    // Note: since we use [now, ...prev].slice(0,10), the 10th message is at index 9
    const tenthMessageTs = senderTimestamps[9] || 0;
    const sentTenInTwoMins = tenthMessageTs > twoMinutesAgo;
    
    // Check if receiver hasn't replied at all in that window
    const receiverInactive = !receiverTimestamps.some(ts => ts > twoMinutesAgo);
    
    return sentTenInTwoMins && receiverInactive;
  }
  return false;
}

/**
 * Fetches or creates a relationship document between two users.
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
      
      // Calculate isBursting context dynamically
      const isBursting = calculateIsBursting(data.messageTimestamps || {}, senderId, receiverId);

      // Return persisted frequency or calculate on the fly
      const frequency = data.interactionFrequency || calculateInteractionFrequency(data.interactionCount || 0, data.lastInteraction || new Date().toISOString());

      return {
        ...data,
        isBursting,
        interactionFrequency: isBursting ? 'High (Bursting)' : frequency
      };
    } else {
      console.log(`[DATABASE] No relationship found. Creating default: Stranger/One-time`);
      const initialData = {
        interactionCount: 0,
        userCounts: { [senderId]: 0, [receiverId]: 0 },
        relationshipType: 'Stranger',
        historyType: 'Neutral',
        interactionFrequency: 'One-time',
        rollingSentimentScore: 0.5,
        messageTimestamps: { [senderId]: [], [receiverId]: [] },
        participants: [senderId, receiverId],
        lastInteraction: new Date().toISOString(),
        isBursting: false
      };
      
      setDoc(relRef, initialData).catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: relRef.path,
          operation: 'create',
          requestResourceData: initialData
        }));
      });

      return { ...initialData, isBursting: false };
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
    
    // Update Timestamps (store last 10)
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
    const newLastInteraction = new Date().toISOString();
    const newFrequency = calculateInteractionFrequency(totalCount, newLastInteraction);
    
    // Recalculate and persist the isBursting flag
    const isBursting = calculateIsBursting(timestamps, senderId, receiverId);

    await updateDoc(relRef, {
      interactionCount: increment(1),
      userCounts,
      messageTimestamps: timestamps,
      rollingSentimentScore: sentiment,
      relationshipType: newLevel,
      historyType: newHistory,
      interactionFrequency: newFrequency,
      lastInteraction: newLastInteraction,
      isBursting: isBursting
    });
  } catch (err) {
    console.error("[DATABASE] Error updating behavior metrics:", err);
  }
}

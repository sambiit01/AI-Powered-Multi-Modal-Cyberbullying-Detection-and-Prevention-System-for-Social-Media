import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
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

// Safely export auth for terminal environments
export const auth = firebaseConfig.apiKey ? getAuth(app) : (null as any);
export const db = getFirestore(app);

/**
 * Interface for Admin/Moderation Settings
 */
export interface AdminSettings {
  profileType: string;
  sensitivityThreshold: number;
  banterTolerance: number;
  updatedAt: string;
}

/**
 * Interface for Global App Configuration
 */
export interface GlobalConfig {
  defaultProfileId: string;
  updatedAt: string;
}

/**
 * Fetches moderation settings for a specific profile.
 * Defaults to the global default profile if no profileId is provided.
 */
export async function getProfileSettings(profileId?: string): Promise<AdminSettings> {
  let targetId = profileId;

  if (!targetId) {
    try {
      const globalRef = doc(db, "adminSettings", "global");
      const globalSnap = await getDoc(globalRef);
      if (globalSnap.exists()) {
        const config = globalSnap.data() as GlobalConfig;
        targetId = config.defaultProfileId;
      }
    } catch (e) {
      // Fallback
    }
  }

  targetId = targetId || 'standard';
  const profileRef = doc(db, "moderationProfiles", targetId);
  
  try {
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      return profileSnap.data() as AdminSettings;
    } else {
      return {
        profileType: targetId,
        sensitivityThreshold: 85,
        banterTolerance: 75,
        updatedAt: new Date().toISOString()
      };
    }
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: profileRef.path,
        operation: 'get'
      }));
    }
    throw error;
  }
}

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
    const tenthMessageTs = senderTimestamps[9] || 0;
    const sentTenInTwoMins = tenthMessageTs > twoMinutesAgo;
    const receiverInactive = !receiverTimestamps.some(ts => ts > twoMinutesAgo);
    return sentTenInTwoMins && receiverInactive;
  }
  return false;
}

/**
 * Fetches or creates a relationship document between two users.
 */
export async function getOrCreateRelationship(senderId: string, receiverId: string) {
  const relId = [senderId, receiverId].sort().join('_');
  const relRef = doc(db, "relationships", relId);
  
  try {
    const relDoc = await getDoc(relRef);

    if (relDoc.exists()) {
      const data = relDoc.data();
      const isBursting = calculateIsBursting(data.messageTimestamps || {}, senderId, receiverId);
      const frequency = data.interactionFrequency || calculateInteractionFrequency(data.interactionCount || 0, data.lastInteraction || new Date().toISOString());

      return {
        ...data,
        isBursting,
        interactionFrequency: isBursting ? 'High (Bursting)' : frequency
      };
    } else {
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
      
      await setDoc(relRef, initialData);
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
 * Updates relationship metrics after an interaction using numeric toxicity scores.
 */
export async function updateRelationshipBehavior(senderId: string, receiverId: string, toxicityScore: number) {
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
    
    const timestamps = data.messageTimestamps || { [senderId]: [], [receiverId]: [] };
    timestamps[senderId] = [now, ...(timestamps[senderId] || [])].slice(0, 10);

    let sentiment = data.rollingSentimentScore || 0.5;
    
    // NEW SENTIMENT LOGIC: Toxicity-based updates
    if (toxicityScore > 0.7) {
      sentiment -= 0.15;
    } else if (toxicityScore < 0.3) {
      sentiment += 0.05;
    }

    // Clamp score between 0.0 and 1.0
    sentiment = Math.max(0.0, Math.min(1.0, sentiment));

    const newLevel = calculateRelationshipLevel(totalCount, isBidirectional);
    const newHistory = sentiment > 0.8 ? 'Friendly' : (sentiment < 0.4 ? 'Hostile' : 'Neutral');
    const newLastInteraction = new Date().toISOString();
    const newFrequency = calculateInteractionFrequency(totalCount, newLastInteraction);
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
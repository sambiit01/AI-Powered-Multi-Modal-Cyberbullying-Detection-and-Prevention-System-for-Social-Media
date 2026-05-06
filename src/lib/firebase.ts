
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment,
  collection,
  query,
  where,
  limit,
  getDocs,
  Timestamp 
} from "firebase/firestore";

// Ensure environment variables are loaded for CLI environments
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

/**
 * We export a getter or lazy initializer for Auth to prevent 
 * "invalid-api-key" errors during terminal initialization if 
 * the env vars are slightly out of sync.
 */
export const auth = firebaseConfig.apiKey ? getAuth(app) : (null as any);
export const db = getFirestore(app);

export interface AdminSettings {
  profileType: string;
  sensitivityThreshold: number;
  banterTolerance: number;
  updatedAt: string;
}

export interface GlobalConfig {
  defaultProfileId: string;
  updatedAt: string;
}

/**
 * Fetches moderation settings for a profile.
 */
export async function getProfileSettings(profileId?: string): Promise<AdminSettings> {
  let targetId = profileId;

  if (!targetId) {
    try {
      const globalRef = doc(db, "adminSettings", "global");
      const globalSnap = await getDoc(globalRef);
      if (globalSnap.exists()) {
        targetId = (globalSnap.data() as GlobalConfig).defaultProfileId;
      }
    } catch (e) {
      targetId = 'standard';
    }
  }

  targetId = targetId || 'standard';
  const profileRef = doc(db, "moderationProfiles", targetId);
  
  try {
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      return profileSnap.data() as AdminSettings;
    }
    
    // Return hardcoded defaults for simulation if DB is empty
    const defaults: Record<string, AdminSettings> = {
      guardian: { profileType: 'guardian', sensitivityThreshold: 40, banterTolerance: 10, updatedAt: '' },
      professional: { profileType: 'professional', sensitivityThreshold: 90, banterTolerance: 90, updatedAt: '' },
      educational: { profileType: 'educational', sensitivityThreshold: 60, banterTolerance: 50, updatedAt: '' },
      standard: { profileType: 'standard', sensitivityThreshold: 85, banterTolerance: 75, updatedAt: '' }
    };
    return defaults[targetId] || defaults.standard;
  } catch (error) {
    return { profileType: targetId, sensitivityThreshold: 85, banterTolerance: 75, updatedAt: '' };
  }
}

/**
 * Maps interaction count and reciprocation to relationship level.
 */
function calculateRelationshipLevel(totalCount: number, user1Count: number, user2Count: number): string {
  const isBidirectional = user1Count > 0 && user2Count > 0;
  if (!isBidirectional && totalCount < 10) return 'Stranger';
  if (totalCount <= 20) return 'Acquaintance';
  if (totalCount <= 100) return 'Frequent Contact';
  return 'Close Friend';
}

/**
 * Detects if a user is flooding messages.
 */
function calculateIsBursting(timestamps: number[]): boolean {
  if (timestamps.length < 5) return false;
  const now = Date.now();
  const recentCount = timestamps.filter(ts => ts > now - 60000).length;
  return recentCount >= 5;
}

/**
 * Fetches/Updates relationship metadata.
 */
export async function getOrCreateRelationship(senderId: string, receiverId: string) {
  const relId = [senderId, receiverId].sort().join('_');
  const relRef = doc(db, "relationships", relId);
  
  const relSnap = await getDoc(relRef);
  const now = Date.now();

  if (relSnap.exists()) {
    const data = relSnap.data();
    const timestamps = [now, ...(data.messageTimestamps?.[senderId] || [])].slice(0, 10);
    const isBursting = calculateIsBursting(timestamps);
    
    return {
      ...data,
      isBursting,
      relationshipType: calculateRelationshipLevel(
        data.interactionCount || 0, 
        data.userCounts?.[senderId] || 0, 
        data.userCounts?.[receiverId] || 0
      )
    };
  } else {
    const initial = {
      interactionCount: 0,
      userCounts: { [senderId]: 0, [receiverId]: 0 },
      relationshipType: 'Stranger',
      historyType: 'Neutral',
      interactionFrequency: 'Normal',
      isBursting: false,
      rollingSentimentScore: 0.5,
      participants: [senderId, receiverId],
      lastInteraction: new Date().toISOString()
    };
    await setDoc(relRef, initial);
    return { ...initial, isBursting: false };
  }
}

/**
 * Updates behavioral metrics.
 */
export async function updateRelationshipBehavior(senderId: string, receiverId: string, isSafe: boolean) {
  const relId = [senderId, receiverId].sort().join('_');
  const relRef = doc(db, "relationships", relId);

  const currentTS: any = {};
  currentTS[senderId] = [Date.now()];

  const userCounts: any = {};
  userCounts[senderId] = increment(1);

  let sentimentDelta = isSafe ? 0.02 : -0.15;

  await setDoc(relRef, {
    interactionCount: increment(1),
    userCounts,
    messageTimestamps: currentTS,
    lastInteraction: new Date().toISOString(),
    // We update the score if it exists, otherwise it's handled by merge
  }, { merge: true });

  // Update rolling sentiment with a separate fetch to be safe
  const snap = await getDoc(relRef);
  if (snap.exists()) {
    const currentScore = snap.data().rollingSentimentScore || 0.5;
    await updateDoc(relRef, {
      rollingSentimentScore: Math.max(0, Math.min(1, currentScore + sentimentDelta))
    });
  }
}

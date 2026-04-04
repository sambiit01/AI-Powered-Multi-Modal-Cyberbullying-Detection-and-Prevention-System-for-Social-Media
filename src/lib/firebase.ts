// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
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
 * Fetches or creates a relationship document between two users.
 * Generates a unique ID by sorting the UIDs alphabetically.
 */
export async function getOrCreateRelationship(senderId: string, receiverId: string) {
  console.log(`[DATABASE] Fetching relationship for: ${senderId} <-> ${receiverId}`);
  const relId = [senderId, receiverId].sort().join('_');
  const relRef = doc(db, "relationships", relId);
  
  try {
    const relDoc = await getDoc(relRef);

    if (relDoc.exists()) {
      console.log(`[DATABASE] Relationship found:`, relDoc.data());
      return relDoc.data();
    } else {
      console.log(`[DATABASE] No relationship found. Creating default: Stranger/None`);
      const initialData = {
        interactionCount: 0,
        relationshipType: 'Stranger',
        historyType: 'None',
        participants: [senderId, receiverId],
        lastInteraction: new Date().toISOString()
      };
      
      // Mutate without awaiting immediately
      setDoc(relRef, initialData).catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: relRef.path,
          operation: 'create',
          requestResourceData: initialData
        }));
      });

      return initialData;
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

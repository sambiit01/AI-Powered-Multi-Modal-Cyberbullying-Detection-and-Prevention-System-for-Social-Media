
import 'dotenv/config';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// Initialize Firebase for the script environment using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function uploadCSVData() {
  const files = ['bull.csv', 'bull2.csv'];
  const docsDir = path.join(process.cwd(), 'docs');

  console.log('--------------------------------------------------');
  console.log('[UPLOAD SCRIPT] >>> STARTING CONTEXT UPLOAD');
  console.log('--------------------------------------------------');

  for (const fileName of files) {
    const filePath = path.join(docsDir, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`[UPLOAD SCRIPT] WARNING: File not found at ${filePath}. Skipping.`);
      continue;
    }

    console.log(`[UPLOAD SCRIPT] STEP 1: READING FILE: ${fileName}`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    try {
      console.log(`[UPLOAD SCRIPT] STEP 2: PARSING CSV CONTENT...`);
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true // Helps with varying row lengths if any
      });

      console.log(`[UPLOAD SCRIPT] STEP 3: UPLOADING ${records.length} RECORDS TO FIRESTORE...`);

      for (const [index, record] of records.entries()) {
        const data = {
          text: record.text || '',
          relationship: record.relationship || '',
          history: record.history || '',
          label: record.label || '',
          sourceFile: fileName,
          uploadedAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'contextExamples'), data);
        
        if ((index + 1) % 10 === 0 || index === records.length - 1) {
          console.log(`[UPLOAD SCRIPT] PROGRESS: ${index + 1}/${records.length} records uploaded from ${fileName}.`);
        }
      }

      console.log(`[UPLOAD SCRIPT] SUCCESS: Finished processing ${fileName}.`);

    } catch (error) {
      console.error(`[UPLOAD SCRIPT] !!! ERROR PROCESSING ${fileName}:`, error);
    }
  }

  console.log('--------------------------------------------------');
  console.log('[UPLOAD SCRIPT] <<< ALL TASKS COMPLETE');
  console.log('--------------------------------------------------');
  process.exit(0);
}

uploadCSVData().catch(err => {
  console.error('[UPLOAD SCRIPT] CRITICAL FAILURE:', err);
  process.exit(1);
});

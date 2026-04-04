
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
  // List of files to process. We'll check for all three versions.
  const files = ['bull.csv', 'bull2.csv', 'bull3.csv'];
  const docsDir = path.join(process.cwd(), 'docs');

  console.log('--------------------------------------------------');
  console.log('[UPLOAD SCRIPT] >>> STARTING CONTEXT UPLOAD');
  console.log('--------------------------------------------------');

  for (const fileName of files) {
    const filePath = path.join(docsDir, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`[UPLOAD SCRIPT] INFO: File ${fileName} not found. Skipping.`);
      continue;
    }

    console.log(`[UPLOAD SCRIPT] STEP 1: READING FILE: ${fileName}`);
    let fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Remove Byte Order Mark (BOM) if present (common in Excel CSVs)
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }

    try {
      console.log(`[UPLOAD SCRIPT] STEP 2: PARSING CSV CONTENT...`);
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      });

      if (records.length === 0) {
        console.warn(`[UPLOAD SCRIPT] No records found in ${fileName}.`);
        continue;
      }

      // Log headers of the first record to debug
      const headers = Object.keys(records[0]);
      console.log(`[UPLOAD SCRIPT] Detected headers: ${headers.join(', ')}`);

      console.log(`[UPLOAD SCRIPT] STEP 3: UPLOADING ${records.length} RECORDS TO FIRESTORE...`);

      for (const [index, record] of records.entries()) {
        // Find keys case-insensitively
        const findValue = (keyName: string) => {
          const match = Object.keys(record).find(k => k.toLowerCase().trim() === keyName.toLowerCase());
          return match ? record[match] : '';
        };

        const data = {
          text: findValue('text'),
          relationship: findValue('relationship'),
          history: findValue('history'),
          label: findValue('label'),
          sourceFile: fileName,
          uploadedAt: new Date().toISOString()
        };

        // Only upload if text is present
        if (data.text) {
          await addDoc(collection(db, 'contextExamples'), data);
        }
        
        if ((index + 1) % 50 === 0 || index === records.length - 1) {
          console.log(`[UPLOAD SCRIPT] PROGRESS: ${index + 1}/${records.length} records processed for ${fileName}.`);
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


import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {enableFirebaseTelemetry} from '@genkit-ai/firebase';

/**
 * Enable Genkit monitoring and telemetry.
 * This sends traces to the Firebase Console (Genkit tab) for debugging and performance monitoring.
 * Note: When running on Vercel, ensure GCLOUD_PROJECT is set in environment variables to 'shieldai-ab7ge'.
 */
enableFirebaseTelemetry();

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
  model: 'googleai/gemini-2.5-flash',
});


import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {enableFirebaseTelemetry} from '@genkit-ai/firebase';

/**
 * Enable Genkit monitoring and telemetry.
 * This sends traces to the Firebase Console (Genkit tab) for debugging and performance monitoring.
 * Note: Ensure GCLOUD_PROJECT is set to 'shieldai-ab7ge' in Vercel environment variables.
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

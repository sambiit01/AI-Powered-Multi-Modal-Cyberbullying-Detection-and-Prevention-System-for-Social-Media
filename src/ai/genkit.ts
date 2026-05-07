
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {enableFirebaseTelemetry} from '@genkit-ai/firebase';

/**
 * Enable Genkit monitoring and telemetry.
 * This sends traces to the Firebase Console (Genkit tab) for debugging and performance monitoring.
 * 
 * IMPORTANT FOR VERCEL USERS:
 * 1. You must be on the Firebase Blaze (Pay-as-you-go) plan to enable the underlying 
 *    Google Cloud Logging and Tracing APIs.
 * 2. Ensure GCLOUD_PROJECT is set to 'shieldai-ab7ge' in Vercel environment variables.
 * 3. Telemetry usage is free within generous Google Cloud limits (Spark plan projects 
 *    cannot report telemetry data).
 */
if (process.env.GCLOUD_PROJECT) {
  enableFirebaseTelemetry();
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
  model: 'googleai/gemini-3.1-flash-lite-preview',
});

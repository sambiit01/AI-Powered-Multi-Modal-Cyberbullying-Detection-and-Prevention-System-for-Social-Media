'use server';
/**
 * @fileOverview Detects cyberbullying from text-based content with relationship context, 
 * inferred behavioral metrics, profile-specific RAG retrieval, and admin thresholds.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const DetectCyberbullyingFromTextInputSchema = z.object({
  text: z.string().describe('The text content to analyze.'),
  relationshipType: z.string().describe('The level of relationship (Stranger, Friend, etc.).'),
  historyType: z.string().describe('The interaction history sentiment (Friendly, Neutral).'),
  interactionFrequency: z.string().describe('How often they communicate.'),
  isBursting: z.boolean().describe('Whether the sender is flooding messages without response.'),
  profileId: z.string().describe('The ID of the moderation profile being used.'),
  sensitivityThreshold: z.number().describe('The required confidence score percentage (0-100).'),
  banterTolerance: z.number().describe('The tolerance for hostile language between friends (0-100).'),
});
export type DetectCyberbullyingFromTextInput = z.infer<
  typeof DetectCyberbullyingFromTextInputSchema
>;

const DetectCyberbullyingFromTextOutputSchema = z.object({
  isCyberbullying: z.boolean().describe('Whether the content is flagged.'),
  reasoning: z.string().describe('AI reasoning for the classification.'),
  confidenceScore: z.number().describe('The model confidence level (0-1).'),
});
export type DetectCyberbullyingFromTextOutput = z.infer<
  typeof DetectCyberbullyingFromTextOutputSchema
>;

export async function detectCyberbullying(
  input: DetectCyberbullyingFromTextInput
): Promise<DetectCyberbullyingFromTextOutput> {
  console.log('[SERVER: detectCyberbullying] >>> STARTING BEHAVIORAL ANALYSIS');
  
  const result = await detectCyberbullyingFromTextFlow(input);

  const thresholdAsDecimal = input.sensitivityThreshold / 100;

  if (result.isCyberbullying && result.confidenceScore < thresholdAsDecimal) {
    return {
      ...result,
      isCyberbullying: false,
      reasoning: `[Suppressed] ${result.reasoning} (Confidence ${Math.round(result.confidenceScore * 100)}% < ${input.sensitivityThreshold}%)`
    };
  }

  return result;
}

const detectCyberbullyingPrompt = ai.definePrompt({
  name: 'detectCyberbullyingPrompt',
  input: {
    schema: DetectCyberbullyingFromTextInputSchema.extend({
      examples: z.array(z.any()).describe('Retrieved RAG examples for this profile context.'),
    }),
  },
  output: {schema: DetectCyberbullyingFromTextOutputSchema},
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
  prompt: `You are an expert AI moderator specializing in cyberbullying detection.
  
  ### BEHAVIORAL CONTEXT:
  - Relationship Level: {{{relationshipType}}}
  - Sentiment History: {{{historyType}}}
  - Interaction Frequency: {{{interactionFrequency}}}
  - Bursting Mode: {{#if isBursting}}ACTIVE (Sender is flooding messages){{else}}Inactive{{/if}}
  
  ### SYSTEM PARAMETERS:
  - Sensitivity Threshold: {{{sensitivityThreshold}}}% (Higher = stricter)
  - Banter Tolerance: {{{banterTolerance}}}% (Higher = more tolerant of rough talk between friends)

  ### REFERENCE EXAMPLES (RAG):
  {{#if examples}}
  {{#each examples}}
  - Text: "{{{this.text}}}" | Relationship: {{{this.relationship}}} | Label: {{{this.label}}}
  {{/each}}
  {{else}}
  No specific reference examples found for this profile.
  {{/if}}

  ### CONTENT TO ANALYZE:
  "{{{text}}}"

  ### STRICT MODERATION GUIDELINES:
  1. **Bursting Mode Warning**: If Bursting Mode is ACTIVE, the sender is sending many messages without a response. This is a high-risk indicator of harassment. Lower your tolerance significantly and be much stricter.
  2. **Stranger Threshold**: If relationship is 'Stranger', even mild insults should be flagged.
  3. **Friendship Context**: If relationship is 'Close Friend' and history is 'Friendly', allow for playful banter. Use the Banter Tolerance ({{{banterTolerance}}}%) to adjust your sensitivity.

  Return JSON: { isCyberbullying, reasoning, confidenceScore }
  `,
});

const detectCyberbullyingFromTextFlow = ai.defineFlow(
  {
    name: 'detectCyberbullyingFromTextFlow',
    inputSchema: DetectCyberbullyingFromTextInputSchema,
    outputSchema: DetectCyberbullyingFromTextOutputSchema,
  },
  async input => {
    const examplesRef = collection(db, 'contextExamples');
    
    const profileToQuery = (input.profileId && input.profileId !== 'standard') 
      ? input.profileId 
      : 'general';

    const q = query(
      examplesRef, 
      where('profileType', '==', profileToQuery),
      limit(50)
    );
    
    const examples: any[] = [];
    try {
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        examples.push(doc.data());
      });
      
      if (profileToQuery === 'general' && examples.length === 0) {
        const fallbackQuery = query(examplesRef, limit(50));
        const fallbackSnap = await getDocs(fallbackQuery);
        fallbackSnap.forEach((doc) => {
          const data = doc.data();
          if (!data.profileType) {
            examples.push(data);
          }
        });
      }
    } catch (err) {
      console.error('[SERVER: detectCyberbullyingFromTextFlow] RAG Retrieval failed:', err);
    }

    const relevantExamples = examples
      .filter(ex => (ex.relationship === input.relationshipType || ex.relationship_level === input.relationshipType))
      .slice(0, 3);

    const finalExamples = relevantExamples.length > 0 ? relevantExamples : examples.slice(0, 3);

    const {output} = await detectCyberbullyingPrompt({
      ...input,
      examples: finalExamples,
    });
    
    if (!output) {
      throw new Error('The AI model failed to return a result.');
    }
    return output!;
  }
);

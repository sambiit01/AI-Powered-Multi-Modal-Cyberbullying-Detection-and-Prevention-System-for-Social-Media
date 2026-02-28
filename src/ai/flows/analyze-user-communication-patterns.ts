'use server';
/**
 * @fileOverview This file defines a Genkit flow for analyzing user communication patterns to identify potential bullies and victims.
 *
 * analyzeUserCommunicationPatterns - Analyzes user communication patterns to identify potential bullies and victims.
 * AnalyzeUserCommunicationPatternsInput - The input type for the analyzeUserCommunicationPatterns function.
 * AnalyzeUserCommunicationPatternsOutput - The return type for the analyzeUserCommunicationPatterns function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeUserCommunicationPatternsInputSchema = z.object({
  userId: z.string().describe('The ID of the user to analyze.'),
  messages: z
    .array(z.string())
    .describe('An array of recent messages from the user.'),
});
export type AnalyzeUserCommunicationPatternsInput = z.infer<
  typeof AnalyzeUserCommunicationPatternsInputSchema
>;

const AnalyzeUserCommunicationPatternsOutputSchema = z.object({
  bullyingLikelihood: z
    .number()
    .describe(
      'The likelihood that the user is exhibiting bullying behavior (0-1).' + ' 1 indicates the user is very likely a bully.'
    ),
  victimLikelihood: z
    .number()
    .describe(
      'The likelihood that the user is a victim of bullying (0-1).' + ' 1 indicates the user is very likely a victim.'
    ),
  analysisDetails: z
    .string()
    .describe(
      'Detailed analysis of the user communication patterns, ' +
        'including specific examples of bullying or victimization behaviors if they exist.'
    ),
});
export type AnalyzeUserCommunicationPatternsOutput = z.infer<
  typeof AnalyzeUserCommunicationPatternsOutputSchema
>;

export async function analyzeUserCommunicationPatterns(
  input: AnalyzeUserCommunicationPatternsInput
): Promise<AnalyzeUserCommunicationPatternsOutput> {
  console.log('[SERVER: analyzeUserCommunicationPatterns] >>> STARTING BEHAVIORAL ANALYSIS');
  console.log('[SERVER: analyzeUserCommunicationPatterns] TARGET USER:', input.userId);
  console.log('[SERVER: analyzeUserCommunicationPatterns] MESSAGE COUNT:', input.messages.length);
  
  const result = await analyzeUserCommunicationPatternsFlow(input);
  
  console.log('[SERVER: analyzeUserCommunicationPatterns] <<< BEHAVIORAL ANALYSIS COMPLETE');
  console.log('[SERVER: analyzeUserCommunicationPatterns] SCORES - Bullying:', result.bullyingLikelihood, 'Victim:', result.victimLikelihood);
  return result;
}

const prompt = ai.definePrompt({
  name: 'analyzeUserCommunicationPatternsPrompt',
  input: {schema: AnalyzeUserCommunicationPatternsInputSchema},
  output: {schema: AnalyzeUserCommunicationPatternsOutputSchema},
  prompt: `You are an AI assistant specializing in identifying cyberbullying.

  Analyze the following user's messages to determine if they are a bully or a victim.

  User ID: {{{userId}}}
  Messages:
  {{#each messages}}
  - {{{this}}}
  {{/each}}

  Provide a bullyingLikelihood and victimLikelihood score between 0 and 1.
  Also provide analysisDetails, including specific examples of bullying or victimization behaviors if they exist.

  Be concise.
  Remember the output MUST conform to the schema.
  `,
});

const analyzeUserCommunicationPatternsFlow = ai.defineFlow(
  {
    name: 'analyzeUserCommunicationPatternsFlow',
    inputSchema: AnalyzeUserCommunicationPatternsInputSchema,
    outputSchema: AnalyzeUserCommunicationPatternsOutputSchema,
  },
  async input => {
    console.log('[SERVER: analyzeUserCommunicationPatternsFlow] REQUESTING PATTERN ANALYSIS FROM AI...');
    const {output} = await prompt(input);
    console.log('[SERVER: analyzeUserCommunicationPatternsFlow] AI ANALYSIS RETURNED.');
    return output!;
  }
);

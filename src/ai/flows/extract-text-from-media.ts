'use server';
/**
 * @fileOverview Extracts text from an image or video.
 *
 * - extractTextFromMedia - A function that extracts text from an image or video file.
 * - ExtractTextFromMediaInput - The input type for the extractTextFromMedia function.
 * - ExtractTextFromMediaOutput - The return type for the extractTextFromMedia function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractTextFromMediaInputSchema = z.object({
  dataUri: z
    .string()
    .describe(
      "An image or video file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractTextFromMediaInput = z.infer<typeof ExtractTextFromMediaInputSchema>;

const ExtractTextFromMediaOutputSchema = z.object({
  text: z.string().describe('The extracted text from the media file.'),
});
export type ExtractTextFromMediaOutput = z.infer<typeof ExtractTextFromMediaOutputSchema>;

export async function extractTextFromMedia(
  input: ExtractTextFromMediaInput
): Promise<ExtractTextFromMediaOutput> {
  return extractTextFromMediaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractTextFromMediaPrompt',
  input: {schema: ExtractTextFromMediaInputSchema},
  output: {schema: ExtractTextFromMediaOutputSchema},
  prompt: `You are an AI assistant that extracts text from images and videos.
If the media is a video, provide a detailed description of the video content.
If the media contains no text, describe the media.

Media: {{media url=dataUri}}

Respond with the extracted text or description.`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const extractTextFromMediaFlow = ai.defineFlow(
  {
    name: 'extractTextFromMediaFlow',
    inputSchema: ExtractTextFromMediaInputSchema,
    outputSchema: ExtractTextFromMediaOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

"use client";

import React, { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle, Upload } from "lucide-react";
import {
  detectCyberbullyingFromText,
  DetectCyberbullyingFromTextOutput,
} from "@/ai/flows/detect-cyberbullying-from-text";
import {
  extractTextFromMedia,
  ExtractTextFromMediaOutput,
} from "@/ai/flows/extract-text-from-media";
import { Badge } from "../ui/badge";

type AnalysisResult = {
  textResult?: DetectCyberbullyingFromTextOutput;
  mediaResult?: DetectCyberbullyingFromTextOutput;
  extractedText?: string;
};

export default function Moderation() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileType(file.type);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setResult(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const text = formData.get("text") as string;
    const file = (formData.get("media") as File) ?? null;

    if (!text && !file) {
      setError("Please provide text, an image, or a video to analyze.");
      setIsLoading(false);
      return;
    }

    try {
      let textResult: DetectCyberbullyingFromTextOutput | undefined;
      let mediaResult: DetectCyberbullyingFromTextOutput | undefined;
      let extractedText: string | undefined;

      if (text) {
        textResult = await detectCyberbullyingFromText({ text });
      }

      if (file && file.size > 0 && filePreview) {
        const mediaAnalysis: ExtractTextFromMediaOutput = await extractTextFromMedia(
          { dataUri: filePreview }
        );
        extractedText = mediaAnalysis.text;
        if (extractedText) {
          mediaResult = await detectCyberbullyingFromText({
            text: extractedText,
          });
        }
      }

      setResult({ textResult, mediaResult, extractedText });
    } catch (e) {
      setError("An error occurred during analysis. Please try again.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  const getBadgeVariant = (isBullying: boolean) =>
    isBullying ? "destructive" : "default";

  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <Card>
        <CardHeader>
          <CardTitle>Content Moderation</CardTitle>
          <CardDescription>
            Analyze text, images, or videos for cyberbullying. The AI will
            extract text from media for analysis.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="text">Text Content</Label>
                <Textarea
                  id="text"
                  name="text"
                  placeholder="Enter text to analyze..."
                  className="min-h-24"
                  disabled={isLoading}
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="media">Image/Video Content</Label>
                <Input
                  id="media"
                  name="media"
                  type="file"
                  accept="image/*,video/*"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Image or Video
                </Button>
                {filePreview && (
                  <div className="mt-4">
                    {fileType?.startsWith("image/") ? (
                      <img
                        src={filePreview}
                        alt="Image preview"
                        className="rounded-md max-h-60 w-auto"
                      />
                    ) : (
                      <video
                        src={filePreview}
                        controls
                        className="rounded-md max-h-60 w-auto"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Analyze Content
            </Button>
          </CardFooter>
        </form>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardHeader className="flex flex-row items-center gap-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <div>
              <CardTitle className="text-destructive">Error</CardTitle>
              <CardDescription className="text-destructive/80">
                {error}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {result.textResult && (
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Text Content Analysis
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Detection:</span>
                    <Badge
                      variant={getBadgeVariant(
                        result.textResult.isCyberbullying
                      )}
                    >
                      {result.textResult.isCyberbullying
                        ? "Cyberbullying Detected"
                        : "No Cyberbullying Detected"}
                    </Badge>
                  </div>
                  <p>
                    <span className="font-medium">Reason:</span>{" "}
                    {result.textResult.reason}
                  </p>
                  <p>
                    <span className="font-medium">Confidence Score:</span>{" "}
                    {(result.textResult.confidenceScore * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            )}
            {result.mediaResult && (
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Image/Video Content Analysis
                </h3>
                {result.extractedText && (
                  <div className="mb-4">
                    <p className="font-medium">Extracted Text:</p>
                    <p className="text-sm text-muted-foreground bg-slate-100 p-4 rounded-md">
                      {result.extractedText}
                    </p>
                  </div>
                )}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Detection:</span>
                    <Badge
                      variant={getBadgeVariant(
                        result.mediaResult.isCyberbullying
                      )}
                    >
                      {result.mediaResult.isCyberbullying
                        ? "Cyberbullying Detected"
                        : "No Cyberbullying Detected"}
                    </Badge>
                  </div>
                  <p>
                    <span className="font-medium">Reason:</span>{" "}
                    {result.mediaResult.reason}
                  </p>
                  <p>
                    <span className="font-medium">Confidence Score:</span>{" "}
                    {(result.mediaResult.confidenceScore * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
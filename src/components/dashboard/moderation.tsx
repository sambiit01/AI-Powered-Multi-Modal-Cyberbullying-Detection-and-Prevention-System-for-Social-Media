"use client";

import React, { useState } from "react";
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
import { Loader2, AlertCircle } from "lucide-react";
import {
  detectCyberbullyingFromText,
  DetectCyberbullyingFromTextOutput,
} from "@/ai/flows/detect-cyberbullying-from-text";
import {
  detectCyberbullyingFromImageCaption,
  DetectCyberbullyingFromImageCaptionOutput,
} from "@/ai/flows/detect-cyberbullying-from-image-captions";
import { Badge } from "../ui/badge";

type AnalysisResult = {
  textResult?: DetectCyberbullyingFromTextOutput;
  captionResult?: DetectCyberbullyingFromImageCaptionOutput;
};

export default function Moderation() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setResult(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const text = formData.get("text") as string;
    const imageCaption = formData.get("imageCaption") as string;

    if (!text && !imageCaption) {
      setError("Please provide text or an image caption to analyze.");
      setIsLoading(false);
      return;
    }

    try {
      let textResult: DetectCyberbullyingFromTextOutput | undefined;
      let captionResult: DetectCyberbullyingFromImageCaptionOutput | undefined;

      if (text) {
        textResult = await detectCyberbullyingFromText({ text });
      }

      if (imageCaption) {
        captionResult = await detectCyberbullyingFromImageCaption({
          imageCaption,
        });
      }

      setResult({ textResult, captionResult });
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
            Analyze text, image captions, or video captions for cyberbullying in
            real-time.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="text">Text or Video Caption</Label>
                <Textarea
                  id="text"
                  name="text"
                  placeholder="Enter text or a video caption to analyze..."
                  className="min-h-24"
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="imageCaption">Image Caption</Label>
                <Input
                  id="imageCaption"
                  name="imageCaption"
                  type="text"
                  placeholder="Enter an image caption to analyze..."
                  disabled={isLoading}
                />
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
                  Text/Video Caption Analysis
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
            {result.captionResult && (
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Image Caption Analysis
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Detection:</span>
                    <Badge
                      variant={getBadgeVariant(
                        result.captionResult.isCyberbullying
                      )}
                    >
                      {result.captionResult.isCyberbullying
                        ? "Cyberbullying Detected"
                        : "No Cyberbullying Detected"}
                    </Badge>
                  </div>
                  <p>
                    <span className="font-medium">Reason:</span>{" "}
                    {result.captionResult.reason}
                  </p>
                  <p>
                    <span className="font-medium">Confidence Score:</span>{" "}
                    {(result.captionResult.confidenceScore * 100).toFixed(2)}%
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

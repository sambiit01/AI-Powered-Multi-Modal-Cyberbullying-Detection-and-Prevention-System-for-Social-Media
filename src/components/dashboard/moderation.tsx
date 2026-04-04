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
import { Loader2, AlertCircle, Upload, User } from "lucide-react";
import {
  detectCyberbullyingFromText,
  DetectCyberbullyingFromTextOutput,
} from "@/ai/flows/detect-cyberbullying-from-text";
import {
  extractTextFromMedia,
  ExtractTextFromMediaOutput,
} from "@/ai/flows/extract-text-from-media";
import { Badge } from "../ui/badge";
import { type Activity } from "./dashboard";
import { useAuth } from "@/hooks/use-auth";

type ModerationProps = {
  addActivity: (activity: Omit<Activity, "id" | "date">) => void;
};

type AnalysisResult = {
  textResult?: DetectCyberbullyingFromTextOutput;
  mediaResult?: DetectCyberbullyingFromTextOutput;
  extractedText?: string;
};

export default function Moderation({ addActivity }: ModerationProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("[CLIENT] >>> FILE SELECTED:", file.name, "TYPE:", file.type);
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
    console.log("\n[CLIENT] **************************************************");
    console.log("[CLIENT] * ACTION: ANALYZE CONTENT (Step 1: UI Trigger)  *");
    console.log("[CLIENT] **************************************************\n");
    
    setIsLoading(true);
    setResult(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const text = formData.get("text") as string;
    const receiverId = (formData.get("receiverId") as string) || "anonymous_receiver";
    const file = (formData.get("media") as File) ?? null;

    if (!user) {
      setError("You must be logged in to perform analysis.");
      setIsLoading(false);
      return;
    }

    console.log("[CLIENT] STEP 2: PREPARING PAYLOAD -> Sender:", user.uid, "Receiver:", receiverId);

    if (!text && (!file || file.size === 0)) {
      setError("Please provide text, an image, or a video to analyze.");
      setIsLoading(false);
      return;
    }

    try {
      let textResult: DetectCyberbullyingFromTextOutput | undefined;
      let mediaResult: DetectCyberbullyingFromTextOutput | undefined;
      let extractedText: string | undefined;

      if (text) {
        console.log("[CLIENT] STEP 3A: STARTING TEXT FLOW...");
        textResult = await detectCyberbullyingFromText({ 
          text, 
          senderId: user.uid,
          receiverId: receiverId,
        });
        
        addActivity({
          type: "Content",
          details: `Text Analysis: ${text.substring(0, 30)}...`,
          status: textResult.isCyberbullying ? "Flagged" : "Monitored",
          isCyberbullying: textResult.isCyberbullying,
        });
      }

      if (file && file.size > 0 && filePreview) {
        console.log("[CLIENT] STEP 3B: STARTING MEDIA VISION FLOW...");
        const mediaAnalysis: ExtractTextFromMediaOutput = await extractTextFromMedia(
          { dataUri: filePreview }
        );
        extractedText = mediaAnalysis.text;

        if (extractedText) {
          console.log("[CLIENT] STEP 4: ANALYZING MEDIA TEXT FOR BULLYING...");
          mediaResult = await detectCyberbullyingFromText({
            text: extractedText,
            senderId: user.uid,
            receiverId: receiverId,
          });
          
          addActivity({
            type: "Content",
            details: `Media Analysis: ${extractedText.substring(0, 30)}...`,
            status: mediaResult.isCyberbullying ? "Flagged" : "Monitored",
            isCyberbullying: mediaResult.isCyberbullying,
          });
        }
      }

      console.log("[CLIENT] STEP 5: RESULTS RECEIVED. UPDATING UI.");
      setResult({ textResult, mediaResult, extractedText });
    } catch (e: any) {
      console.error("[CLIENT] CRITICAL FAILURE DURING ANALYSIS:", e);
      setError("An error occurred during analysis. Please check the logs.");
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
          <CardTitle>Contextual Content Moderation</CardTitle>
          <CardDescription>
            Analyze interactions between users. The AI considers relationship history and similar context examples to accurately identify harassment.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="grid gap-4 p-4 bg-muted/50 rounded-lg border">
              <div className="grid gap-2">
                <Label htmlFor="receiverId" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Receiver User ID
                </Label>
                <Input
                  id="receiverId"
                  name="receiverId"
                  placeholder="e.g. user_target_123"
                  defaultValue="anonymous_receiver"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  The ID of the user receiving this message/content.
                </p>
              </div>
            </div>

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
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                disabled={isLoading}
                className="w-full h-20 border-dashed"
              >
                <Upload className="mr-2 h-5 w-5" />
                Click to Upload Media
              </Button>
              {filePreview && (
                <div className="mt-4 border rounded-lg overflow-hidden bg-black flex justify-center">
                  {fileType?.startsWith("image/") ? (
                    <img
                      src={filePreview}
                      alt="Image preview"
                      className="max-h-60 w-auto object-contain"
                    />
                  ) : (
                    <video
                      src={filePreview}
                      controls
                      className="max-h-60 w-auto"
                    />
                  )}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4 bg-muted/20">
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Analyze with Full Context
            </Button>
          </CardFooter>
        </form>
      </Card>

      {error && (
        <Card className="border-destructive bg-destructive/5">
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
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardHeader>
            <CardTitle>AI Analysis Results</CardTitle>
            <CardDescription>Context-aware assessment powered by few-shot learning.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {result.textResult && (
              <div className="p-4 rounded-lg border bg-muted/30">
                <h3 className="font-semibold text-lg mb-4 flex items-center justify-between">
                  Text Content
                  <Badge
                    variant={getBadgeVariant(
                      result.textResult.isCyberbullying
                    )}
                    className="ml-2"
                  >
                    {result.textResult.isCyberbullying
                      ? "Flagged"
                      : "Clean"}
                  </Badge>
                </h3>
                <div className="grid gap-4">
                  <div className="text-sm">
                    <span className="font-bold uppercase text-xs text-muted-foreground block mb-1">AI Reasoning:</span>
                    <p className="leading-relaxed">
                      {result.textResult.reasoning}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                    <span>Confidence Score</span>
                    <span className="font-mono">{(result.textResult.confidenceScore * 100).toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            )}

            {result.mediaResult && (
              <div className="p-4 rounded-lg border bg-muted/30">
                <h3 className="font-semibold text-lg mb-4 flex items-center justify-between">
                  Media Content
                  <Badge
                    variant={getBadgeVariant(
                      result.mediaResult.isCyberbullying
                    )}
                    className="ml-2"
                  >
                    {result.mediaResult.isCyberbullying
                      ? "Flagged"
                      : "Clean"}
                  </Badge>
                </h3>
                {result.extractedText && (
                  <div className="mb-4">
                    <span className="font-bold uppercase text-xs text-muted-foreground block mb-1">Extracted Text:</span>
                    <p className="text-sm italic p-3 bg-background rounded border">
                      "{result.extractedText}"
                    </p>
                  </div>
                )}
                <div className="grid gap-4">
                  <div className="text-sm">
                    <span className="font-bold uppercase text-xs text-muted-foreground block mb-1">AI Reasoning:</span>
                    <p className="leading-relaxed">
                      {result.mediaResult.reasoning}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                    <span>Confidence Score</span>
                    <span className="font-mono">{(result.mediaResult.confidenceScore * 100).toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
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
import { Loader2, AlertCircle, Upload, User, CheckCircle2, XCircle } from "lucide-react";
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
import { getOrCreateRelationship, db } from "@/lib/firebase";
import { collection, query, where, limit, getDocs, doc, getDoc, addDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";

type ModerationProps = {
  addActivity: (activity: Omit<Activity, "id" | "date">) => void;
};

type AnalysisResult = {
  textResult?: DetectCyberbullyingFromTextOutput;
  mediaResult?: DetectCyberbullyingFromTextOutput;
  extractedText?: string;
  originalText?: string;
  relType?: string;
};

export default function Moderation({ addActivity }: ModerationProps) {
  const { user } = useAuth();
  const { toast } = useToast();
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

  async function fetchContextData(senderId: string, receiverId: string) {
    console.log("[CLIENT] STEP 3: FETCHING CONTEXT DATA (Relationship & Examples)");
    
    // 1. Get Relationship Metadata
    const relationship = await getOrCreateRelationship(senderId, receiverId);
    const relType = (relationship.relationshipType as string) || 'Stranger';
    const histType = (relationship.historyType as string) || 'None';

    // 2. Fetch Relevant Examples
    console.log(`[CLIENT] Querying reference examples for: ${relType}`);
    const examplesRef = collection(db, 'contextExamples');
    const q = query(examplesRef, where('relationship', '==', relType), limit(3));
    
    let examples: any[] = [];
    try {
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        examples.push(doc.data());
      });
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'contextExamples',
          operation: 'list'
        }));
      }
      throw err;
    }

    // 3. Fetch Global Admin Settings
    let sensitivityThreshold = 85;
    try {
      const settingsSnap = await getDoc(doc(db, "adminSettings", "global"));
      if (settingsSnap.exists()) {
        sensitivityThreshold = settingsSnap.data().sensitivityThreshold || 85;
      }
    } catch (err) {}

    console.log(`[CLIENT] Found ${examples.length} reference examples. Threshold: ${sensitivityThreshold}%`);
    return { relType, histType, examples, sensitivityThreshold };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

    if (!text && (!file || file.size === 0)) {
      setError("Please provide text, an image, or a video to analyze.");
      setIsLoading(false);
      return;
    }

    try {
      const context = await fetchContextData(user.uid, receiverId);

      let textResult: DetectCyberbullyingFromTextOutput | undefined;
      let mediaResult: DetectCyberbullyingFromTextOutput | undefined;
      let extractedText: string | undefined;

      if (text) {
        console.log("[CLIENT] STEP 4A: STARTING TEXT FLOW...");
        textResult = await detectCyberbullyingFromText({ 
          text, 
          relationshipType: context.relType,
          historyType: context.histType,
          examples: context.examples,
          sensitivityThreshold: context.sensitivityThreshold
        });
        
        addActivity({
          type: "Content",
          details: `Text Analysis: ${text.substring(0, 30)}...`,
          status: textResult.isCyberbullying ? "Flagged" : "Monitored",
          isCyberbullying: textResult.isCyberbullying,
        });
      }

      if (file && file.size > 0 && filePreview) {
        console.log("[CLIENT] STEP 4B: STARTING VISION FLOW...");
        const mediaAnalysis: ExtractTextFromMediaOutput = await extractTextFromMedia(
          { dataUri: filePreview }
        );
        extractedText = mediaAnalysis.text;

        if (extractedText) {
          mediaResult = await detectCyberbullyingFromText({
            text: extractedText,
            relationshipType: context.relType,
            historyType: context.histType,
            examples: context.examples,
            sensitivityThreshold: context.sensitivityThreshold
          });
          
          addActivity({
            type: "Content",
            details: `Media Analysis: ${extractedText.substring(0, 30)}...`,
            status: mediaResult.isCyberbullying ? "Flagged" : "Monitored",
            isCyberbullying: mediaResult.isCyberbullying,
          });
        }
      }

      setResult({ 
        textResult, 
        mediaResult, 
        extractedText, 
        originalText: text,
        relType: context.relType
      });
    } catch (e: any) {
      console.error("[CLIENT] ANALYSIS FAILED:", e);
      setError(e.message || "An error occurred during analysis.");
    } finally {
      setIsLoading(false);
    }
  }

  const handleCorrectLabel = async (originalText: string, relType: string, correctedLabel: string) => {
    console.log("[CLIENT] Feedback loop: Adding corrected example to Firestore...");
    const feedbackData = {
      text: originalText,
      relationship: relType,
      history: "Admin Corrected",
      label: correctedLabel,
      sourceFile: "Manual Correction",
      uploadedAt: new Date().toISOString()
    };

    addDoc(collection(db, "contextExamples"), feedbackData)
      .then(() => {
        toast({
          title: "Label Corrected",
          description: "This correction has been saved to improve future AI calls.",
        });
      })
      .catch((err) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: "contextExamples",
          operation: "create",
          requestResourceData: feedbackData
        }));
      });
  };

  const getBadgeVariant = (isBullying: boolean) =>
    isBullying ? "destructive" : "default";

  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <Card>
        <CardHeader>
          <CardTitle>Contextual Content Moderation</CardTitle>
          <CardDescription>
            Analyze interactions with relationship history. Use the feedback loop below to correct AI mistakes and retrain the few-shot memory.
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
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="w-full h-20 border-dashed"
              >
                <Upload className="mr-2 h-5 w-5" />
                Upload Media
              </Button>
              {filePreview && (
                <div className="mt-4 border rounded-lg overflow-hidden bg-black flex justify-center">
                  {fileType?.startsWith("image/") ? (
                    <img src={filePreview} alt="Preview" className="max-h-60" />
                  ) : (
                    <video src={filePreview} controls className="max-h-60" />
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
              <CardDescription className="text-destructive/80">{error}</CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {result && (
        <Card className="animate-in fade-in slide-in-from-bottom-2">
          <CardHeader>
            <CardTitle>AI Analysis Results</CardTitle>
            <CardDescription>Correct AI mistakes to improve future accuracy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {(result.textResult || result.mediaResult) && (
              <div className="space-y-6">
                {result.textResult && (
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Text Result</h3>
                      <Badge variant={getBadgeVariant(result.textResult.isCyberbullying)}>
                        {result.textResult.isCyberbullying ? "Flagged" : "Clean"}
                      </Badge>
                    </div>
                    <p className="text-sm mb-4 leading-relaxed">{result.textResult.reasoning}</p>
                    
                    <div className="flex flex-col gap-3 pt-4 border-t">
                      <span className="text-xs font-bold uppercase text-muted-foreground">Community Feedback Loop</span>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleCorrectLabel(result.originalText || "", result.relType || "Stranger", "Bullying")}
                        >
                          <XCircle className="mr-2 h-4 w-4 text-destructive" />
                          Should be Bullying
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleCorrectLabel(result.originalText || "", result.relType || "Stranger", "Not Bullying")}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
                          Should be Clean
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
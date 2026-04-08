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
import { Loader2, AlertCircle, Upload, User, CheckCircle2, XCircle, Info } from "lucide-react";
import {
  detectCyberbullying,
  DetectCyberbullyingFromTextOutput,
} from "@/ai/flows/detect-cyberbullying-from-text";
import {
  extractTextFromMedia,
  ExtractTextFromMediaOutput,
} from "@/ai/flows/extract-text-from-media";
import { Badge } from "../ui/badge";
import { type Activity } from "./dashboard";
import { useAuth } from "@/hooks/use-auth";
import { getOrCreateRelationship, db, updateRelationshipBehavior } from "@/lib/firebase";
import { collection, query, where, limit, getDocs, doc, getDoc, addDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

type ModerationProps = {
  addActivity: (activity: Omit<Activity, "id" | "date" | "userId">) => void;
};

type AnalysisResult = {
  textResult?: DetectCyberbullyingFromTextOutput;
  mediaResult?: DetectCyberbullyingFromTextOutput;
  extractedText?: string;
  originalText?: string;
  relType?: string;
  histType?: string;
  freq?: string;
  isBursting?: boolean;
};

export default function Moderation({ addActivity }: ModerationProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userProfile?.role === "superuser";

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
    const relData = await getOrCreateRelationship(senderId, receiverId);
    
    const relType = relData.relationshipType || 'Stranger';
    const histType = relData.historyType || 'Neutral';
    const freq = relData.interactionFrequency || 'Occasional';
    const isBursting = !!relData.isBursting;

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
    }

    let sensitivityThreshold = 85;
    let banterTolerance = 75;

    try {
      const settingsSnap = await getDoc(doc(db, "adminSettings", "global"));
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        sensitivityThreshold = data.sensitivityThreshold ?? 85;
        banterTolerance = data.banterTolerance ?? 75;
        console.log("[Moderation] Applied global settings:", { sensitivityThreshold, banterTolerance });
      }
    } catch (err) {
      console.warn("[Moderation] Using default settings due to fetch error:", err);
    }

    return { relType, histType, freq, isBursting, examples, sensitivityThreshold, banterTolerance };
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
      setError("You must be logged in.");
      setIsLoading(false);
      return;
    }

    try {
      const ctx = await fetchContextData(user.uid, receiverId);

      let textResult: DetectCyberbullyingFromTextOutput | undefined;
      let mediaResult: DetectCyberbullyingFromTextOutput | undefined;
      let extractedText: string | undefined;

      if (text) {
        textResult = await detectCyberbullying({ 
          text, 
          relationshipType: ctx.relType,
          historyType: ctx.histType,
          interactionFrequency: ctx.freq,
          isBursting: ctx.isBursting,
          examples: ctx.examples,
          sensitivityThreshold: ctx.sensitivityThreshold,
          banterTolerance: ctx.banterTolerance
        });
        
        addActivity({
          type: "Content",
          details: `Analysis: ${text.substring(0, 30)}...`,
          status: textResult.isCyberbullying ? "Flagged" : "Safe",
          isCyberbullying: textResult.isCyberbullying,
          reasoning: textResult.reasoning,
          originalText: text,
          relType: ctx.relType,
          histType: ctx.histType,
          freq: ctx.freq
        });

        await updateRelationshipBehavior(user.uid, receiverId, !textResult.isCyberbullying);
      }

      if (file && file.size > 0 && filePreview) {
        const mediaAnalysis: ExtractTextFromMediaOutput = await extractTextFromMedia({ dataUri: filePreview });
        extractedText = mediaAnalysis.text;

        if (extractedText) {
          mediaResult = await detectCyberbullying({
            text: extractedText,
            relationshipType: ctx.relType,
            historyType: ctx.histType,
            interactionFrequency: ctx.freq,
            isBursting: ctx.isBursting,
            examples: ctx.examples,
            sensitivityThreshold: ctx.sensitivityThreshold,
            banterTolerance: ctx.banterTolerance
          });
          
          addActivity({
            type: "Content",
            details: `Media: ${extractedText.substring(0, 30)}...`,
            status: mediaResult.isCyberbullying ? "Flagged" : "Safe",
            isCyberbullying: mediaResult.isCyberbullying,
            reasoning: mediaResult.reasoning,
            originalText: extractedText,
            relType: ctx.relType,
            histType: ctx.histType,
            freq: ctx.freq
          });

          await updateRelationshipBehavior(user.uid, receiverId, !mediaResult.isCyberbullying);
        }
      }

      setResult({ 
        textResult, 
        mediaResult, 
        extractedText, 
        originalText: text,
        relType: ctx.relType,
        histType: ctx.histType,
        freq: ctx.freq,
        isBursting: ctx.isBursting
      });
    } catch (e: any) {
      console.error("[Moderation] Analysis error:", e);
      setError(e.message || "An unexpected error occurred during analysis.");
    } finally {
      setIsLoading(false);
    }
  }

  const handleCorrectLabel = async (originalText: string, relType: string, histType: string, freq: string, correctedLabel: string) => {
    const feedbackData = {
      text: originalText,
      relationship: relType,
      interaction_history: histType,
      interaction_frequency: freq,
      label: correctedLabel,
      sourceFile: "Manual Correction",
      uploadedAt: new Date().toISOString()
    };

    addDoc(collection(db, "contextExamples"), feedbackData)
      .then(() => {
        toast({ title: "Feedback Saved", description: "AI accuracy improved." });
      })
      .catch((err) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: "contextExamples",
          operation: "create",
          requestResourceData: feedbackData
        }));
      });
  };

  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <Card>
        <CardHeader>
          <CardTitle>Behavioral Moderation</CardTitle>
          <CardDescription>
            AI analysis powered by relationship leveling and frequency detection.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="grid gap-4 p-4 bg-muted/50 rounded-lg border">
              <div className="grid gap-2">
                <Label htmlFor="receiverId" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Receiver ID
                </Label>
                <Input
                  id="receiverId"
                  name="receiverId"
                  placeholder="Target User ID"
                  defaultValue="anonymous_receiver"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid gap-3">
              <Label htmlFor="text">Message Content</Label>
              <Textarea
                id="text"
                name="text"
                placeholder="Analyze text for cyberbullying..."
                className="min-h-24"
                disabled={isLoading}
              />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="media">Visual Context (Optional)</Label>
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
                className="w-full h-16 border-dashed"
              >
                <Upload className="mr-2 h-5 w-5" />
                {filePreview ? "Change Media" : "Upload Image or Video"}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4 bg-muted/20">
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Analyze with Behavioral Context
            </Button>
          </CardFooter>
        </form>
      </Card>

      {error && (
        <Card className="border-destructive animate-in fade-in slide-in-from-top-2">
          <CardHeader className="flex flex-row items-center gap-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <div>
              <CardTitle className="text-destructive font-semibold">Analysis Failed</CardTitle>
              <CardDescription className="text-destructive/80">
                {error}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {result && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 border-primary/20 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Inference Result</CardTitle>
            {result.isBursting && (
              <Badge variant="destructive" className="animate-pulse">
                Bursting Detected
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {(result.textResult || result.mediaResult) && (
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{result.relType}</Badge>
                    <Badge variant="outline" className="text-xs">{result.freq}</Badge>
                    <h3 className="font-semibold text-sm">AI Determination</h3>
                  </div>
                  <Badge variant={(result.textResult?.isCyberbullying || result.mediaResult?.isCyberbullying) ? "destructive" : "default"}>
                    {(result.textResult?.isCyberbullying || result.mediaResult?.isCyberbullying) ? "Flagged" : "Safe"}
                  </Badge>
                </div>
                <p className="text-sm mb-6 leading-relaxed text-muted-foreground italic">
                  "{result.textResult?.reasoning || result.mediaResult?.reasoning}"
                </p>
                
                {isAdmin && (
                  <div className="pt-4 border-t">
                    <p className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-1">
                      Admin Feedback Loop <Info className="h-3 w-3" />
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 hover:bg-destructive/10"
                        onClick={() => handleCorrectLabel(result.originalText || "", result.relType || "Stranger", result.histType || "Neutral", result.freq || "Occasional", "Bullying")}
                      >
                        <XCircle className="mr-2 h-4 w-4 text-destructive" />
                        Label as Bullying
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 hover:bg-primary/10"
                        onClick={() => handleCorrectLabel(result.originalText || "", result.relType || "Stranger", result.histType || "Neutral", result.freq || "Occasional", "Not Bullying")}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
                        Label as Safe
                      </Button>
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

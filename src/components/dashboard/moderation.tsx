
"use client";

import React, { useState, useRef, useEffect } from "react";
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
import { Loader2, AlertCircle, Upload, User, CheckCircle2, XCircle, Info, Eye } from "lucide-react";
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
import { getOrCreateRelationship, db, updateRelationshipBehavior, getProfileSettings, type GlobalConfig } from "@/lib/firebase";
import { collection, query, where, limit, getDocs, addDoc, doc, getDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [activeProfile, setActiveProfile] = useState<string>("standard");
  const [availableProfiles, setAvailableProfiles] = useState<string[]>(["standard", "guardian", "professional"]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userProfile?.role === "superuser";

  useEffect(() => {
    async function syncDynamicData() {
      try {
        // Fetch all available profiles for the dropdown
        const profilesSnap = await getDocs(collection(db, "moderationProfiles"));
        const profiles = profilesSnap.docs.map(doc => doc.id);
        if (profiles.length > 0) setAvailableProfiles(profiles);

        // Fetch Global active profile to sync default lens
        const globalRef = doc(db, "adminSettings", "global");
        const globalSnap = await getDoc(globalRef);
        if (globalSnap.exists()) {
          const config = globalSnap.data() as GlobalConfig;
          if (config.defaultProfileId) {
            setActiveProfile(config.defaultProfileId);
          }
        }
      } catch (err) {
        console.warn("[Moderation] Failed to sync global data.");
      }
    }
    syncDynamicData();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  async function fetchContextData(senderId: string, receiverId: string, profileId: string) {
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

    const settings = await getProfileSettings(profileId);
    return { relType, histType, freq, isBursting, examples, ...settings };
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
      const ctx = await fetchContextData(user.uid, receiverId, activeProfile);

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
      setError(e.message || "An error occurred.");
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
      .then(() => toast({ title: "Feedback Saved" }))
      .catch((err) => errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: "contextExamples",
        operation: "create",
        requestResourceData: feedbackData
      })));
  };

  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <Card>
        <CardHeader>
          <CardTitle>Simulation Console</CardTitle>
          <CardDescription>Test content analysis under specific behavioral profiles.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="grid gap-4 p-4 bg-muted/50 rounded-lg border">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="receiverId" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Target User ID
                  </Label>
                  <Input id="receiverId" name="receiverId" placeholder="Receiver ID" defaultValue="anonymous_receiver" disabled={isLoading} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="activeProfile" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Moderation Lens
                  </Label>
                  <Select value={activeProfile} onValueChange={setActiveProfile} disabled={isLoading}>
                    <SelectTrigger id="activeProfile">
                      <SelectValue placeholder="Select lens" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProfiles.map(profile => (
                        <SelectItem key={profile} value={profile}>
                          {profile.charAt(0).toUpperCase() + profile.slice(1).replace(/-/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <Label htmlFor="text">Message</Label>
              <Textarea id="text" name="text" placeholder="Enter message text..." className="min-h-24" disabled={isLoading} />
            </div>

            <div className="grid gap-3">
              <Label>Media</Label>
              <Input id="media" name="media" type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isLoading} />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-full border-dashed">
                <Upload className="mr-2 h-4 w-4" />
                {filePreview ? "Media Attached" : "Attach Image"}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run Behavioral Analysis
            </Button>
          </CardFooter>
        </form>
      </Card>

      {result && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 border-primary/20 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>AI Results</CardTitle>
            {result.isBursting && <Badge variant="destructive">Bursting Detected</Badge>}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  <Badge variant="outline">{result.relType}</Badge>
                  <Badge variant="outline">{result.freq}</Badge>
                </div>
                <Badge variant={(result.textResult?.isCyberbullying || result.mediaResult?.isCyberbullying) ? "destructive" : "default"}>
                  {(result.textResult?.isCyberbullying || result.mediaResult?.isCyberbullying) ? "Flagged" : "Safe"}
                </Badge>
              </div>
              <p className="text-sm italic text-muted-foreground">
                "{result.textResult?.reasoning || result.mediaResult?.reasoning}"
              </p>
              
              {isAdmin && (
                <div className="pt-4 mt-4 border-t flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleCorrectLabel(result.originalText || "", result.relType || "Stranger", result.histType || "Neutral", result.freq || "Occasional", "Bullying")}>
                    <XCircle className="mr-2 h-4 w-4 text-destructive" /> Label Bullying
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleCorrectLabel(result.originalText || "", result.relType || "Stranger", result.histType || "Neutral", result.freq || "Occasional", "Not Bullying")}>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Label Safe
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { db, getProfileSettings, type GlobalConfig } from "@/lib/firebase";
import { doc, setDoc, collection, getDocs, getDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Loader2, Download, Database, Save, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Settings() {
  const { toast } = useToast();
  const [toxicityThreshold, setToxicityThreshold] = useState(85);
  const [bullyingThreshold, setBullyingThreshold] = useState(75);
  const [defaultProfileId, setDefaultProfileId] = useState("standard");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      console.log("[SETTINGS] Loading configurations...");
      try {
        // 1. Fetch Global Config
        const globalRef = doc(db, "adminSettings", "global");
        const globalSnap = await getDoc(globalRef);
        let activeProfile = "standard";
        
        if (globalSnap.exists()) {
          const gData = globalSnap.data() as GlobalConfig;
          activeProfile = gData.defaultProfileId;
          if (isMounted) setDefaultProfileId(activeProfile);
        }

        // 2. Fetch Active Profile Settings
        const data = await getProfileSettings(activeProfile);
        
        if (isMounted) {
          setToxicityThreshold(data.sensitivityThreshold ?? 85);
          setBullyingThreshold(data.banterTolerance ?? 75);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("[SETTINGS] Load failed:", err);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadSettings();
    return () => { isMounted = false; };
  }, []);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    
    const profileData = {
      profileType: defaultProfileId,
      sensitivityThreshold: toxicityThreshold,
      banterTolerance: bullyingThreshold,
      updatedAt: new Date().toISOString()
    };

    const globalData = {
      defaultProfileId: defaultProfileId,
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Save Global config
      await setDoc(doc(db, "adminSettings", "global"), globalData);
      
      // 2. Save active profile data
      await setDoc(doc(db, "moderationProfiles", defaultProfileId), profileData);
      
      toast({
        title: "Settings Saved",
        description: `Lens: ${defaultProfileId} | Sensitivity: ${toxicityThreshold}%`,
      });
    } catch (err: any) {
      console.error("[SETTINGS] Save failed:", err);
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: "adminSettings/global",
        operation: "write",
        requestResourceData: globalData
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const querySnapshot = await getDocs(collection(db, "contextExamples"));
      const records = querySnapshot.docs.map(doc => doc.data());

      if (records.length === 0) {
        toast({
          variant: "destructive",
          title: "No Data",
          description: "There are no context examples to export.",
        });
        return;
      }

      const headers = ["text", "relationship", "interaction_history", "interaction_frequency", "label", "sourceFile", "uploadedAt"];
      
      const csvContent = [
        headers.join(","),
        ...records.map(record => {
          return headers.map(header => {
            let val = record[header] || "";
            if (typeof val === 'string') {
              val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          }).join(",");
        })
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `shieldai_context_examples_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Complete",
        description: `Successfully exported ${records.length} records.`,
      });
    } catch (err: any) {
      console.error("[SETTINGS] Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Global Moderation Lens
          </CardTitle>
          <CardDescription>
            Select the active moderation personality for the entire system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lens-select">Active Profile</Label>
              <Select value={defaultProfileId} onValueChange={setDefaultProfileId}>
                <SelectTrigger id="lens-select">
                  <SelectValue placeholder="Select a lens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (Balanced)</SelectItem>
                  <SelectItem value="guardian">Guardian (Strict/Safe)</SelectItem>
                  <SelectItem value="professional">Professional (Neutral/Formal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-muted/50 rounded-md border flex items-center">
              <p className="text-xs text-muted-foreground italic">
                Changing this will immediately affect AI sensitivity across the platform.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Tuning: {defaultProfileId.charAt(0).toUpperCase() + defaultProfileId.slice(1)}</CardTitle>
          <CardDescription>
            Adjust thresholds for the currently selected active profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="toxicity-threshold" className="text-lg font-medium">
                AI Sensitivity Threshold
              </Label>
              <span className="text-lg font-semibold text-primary">
                {toxicityThreshold}%
              </span>
            </div>
            <Slider
              id="toxicity-threshold"
              value={[toxicityThreshold]}
              onValueChange={(value) => setToxicityThreshold(value[0])}
              max={100}
              step={1}
            />
            <p className="text-sm text-muted-foreground">
              Required confidence level for AI to flag content. Higher = less aggressive flagging.
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="bullying-threshold" className="text-lg font-medium">
                Banter Tolerance
              </Label>
              <span className="text-lg font-semibold text-primary">
                {bullyingThreshold}%
              </span>
            </div>
            <Slider
              id="bullying-threshold"
              value={[bullyingThreshold]}
              onValueChange={(value) => setBullyingThreshold(value[0])}
              max={100}
              step={1}
            />
            <p className="text-sm text-muted-foreground">
              How much "rough" talk is permitted between close friends. Higher = more permissive.
            </p>
          </div>
          
          <div className="pt-6 border-t">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              Data Management
            </h3>
            <Card className="bg-muted/30">
              <CardContent className="pt-6 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Training Data Export</p>
                  <p className="text-xs text-muted-foreground">
                    Download the contextExamples dataset as a CSV.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExportCSV} 
                  disabled={isExporting}
                  className="shrink-0"
                >
                  {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Export CSV
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={handleSaveChanges} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}

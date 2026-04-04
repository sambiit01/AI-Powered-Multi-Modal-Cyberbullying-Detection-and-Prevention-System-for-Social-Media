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
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Loader2 } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [toxicityThreshold, setToxicityThreshold] = useState(85);
  const [bullyingThreshold, setBullyingThreshold] = useState(75);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      console.log("[SETTINGS] Loading global admin settings...");
      try {
        const settingsRef = doc(db, "adminSettings", "global");
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          const data = snap.data();
          setToxicityThreshold(data.sensitivityThreshold || 85);
          setBullyingThreshold(data.banterTolerance || 75);
          console.log("[SETTINGS] Loaded settings:", data);
        }
      } catch (err: any) {
        if (err.code === "permission-denied") {
          errorEmitter.emit("permission-error", new FirestorePermissionError({
            path: "adminSettings/global",
            operation: "get"
          }));
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    console.log("[SETTINGS] Saving changes to Firestore...");
    
    const settingsData = {
      sensitivityThreshold: toxicityThreshold,
      banterTolerance: bullyingThreshold,
      updatedAt: new Date().toISOString()
    };

    setDoc(doc(db, "adminSettings", "global"), settingsData)
      .then(() => {
        toast({
          title: "Settings Saved",
          description: "Global AI parameters have been updated.",
        });
      })
      .catch(async (err) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: "adminSettings/global",
          operation: "write",
          requestResourceData: settingsData
        }));
      })
      .finally(() => {
        setIsSaving(false);
      });
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
          <CardTitle>System Settings</CardTitle>
          <CardDescription>
            Adjust the AI detection thresholds and other system parameters.
            Higher sensitivity values make the detection more strict.
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
              Determines the required AI confidence level before flagging. 
              Higher values reduce "false positives" but might miss subtle bullying.
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
              Adjusts how much "hostile" language is allowed between established friends before being flagged.
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Automations</h3>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="auto-suspend" className="font-semibold">
                  Auto-Suspend Users
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically suspend users who exceed thresholds multiple times.
                </p>
              </div>
              <Switch id="auto-suspend" />
            </div>
             <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="auto-notify" className="font-semibold">
                  Notify Potential Victims
                </Label>
                <p className="text-sm text-muted-foreground">
                  Send automated messages and resources to users identified as potential victims.
                </p>
              </div>
              <Switch id="auto-notify" defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={handleSaveChanges} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
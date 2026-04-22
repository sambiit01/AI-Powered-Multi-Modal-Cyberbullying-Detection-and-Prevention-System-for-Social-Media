
"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { db, getProfileSettings, type GlobalConfig, type AdminSettings } from "@/lib/firebase";
import { doc, setDoc, collection, getDocs, getDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Loader2, Database, Save, Eye, Plus, Trash2 } from "lucide-react";
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
  const [defaultProfileId, setDefaultProfileId] = useState("");
  const [availableProfiles, setAvailableProfiles] = useState<string[]>(["standard", "guardian", "professional"]);
  const [newProfileName, setNewProfileName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // 1. Initial Load: Fetch Global Config and Available Profiles
  useEffect(() => {
    async function loadConfig() {
      console.log("[SETTINGS] Loading configurations...");
      try {
        // Fetch all available profiles
        const profilesSnap = await getDocs(collection(db, "moderationProfiles"));
        const profiles = profilesSnap.docs.map(doc => doc.id);
        if (profiles.length > 0) {
          setAvailableProfiles(profiles);
        }

        // Fetch Global active profile
        const globalRef = doc(db, "adminSettings", "global");
        const globalSnap = await getDoc(globalRef);
        let activeProfile = "standard";
        
        if (globalSnap.exists()) {
          const gData = globalSnap.data() as GlobalConfig;
          activeProfile = gData.defaultProfileId || "standard";
        }
        
        setDefaultProfileId(activeProfile);
      } catch (err: any) {
        console.error("[SETTINGS] Load failed:", err);
        setDefaultProfileId("standard");
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  // 2. Profile Sync: Fetch specific thresholds whenever the selected profile changes
  useEffect(() => {
    if (!defaultProfileId) return;

    async function syncProfileThresholds() {
      try {
        const data = await getProfileSettings(defaultProfileId);
        setToxicityThreshold(data.sensitivityThreshold ?? 85);
        setBullyingThreshold(data.banterTolerance ?? 75);
      } catch (err: any) {
        console.error(`[SETTINGS] Profile sync failed for ${defaultProfileId}:`, err);
      }
    }
    syncProfileThresholds();
  }, [defaultProfileId]);

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      toast({ variant: "destructive", title: "Missing Name", description: "Please enter a name for the new profile." });
      return;
    }

    const profileId = newProfileName.toLowerCase().trim().replace(/\s+/g, '-');
    if (availableProfiles.includes(profileId)) {
      toast({ variant: "destructive", title: "Conflict", description: "A profile with this name already exists." });
      return;
    }

    setIsCreating(true);
    const newProfileData: AdminSettings = {
      profileType: profileId,
      sensitivityThreshold: 85,
      banterTolerance: 75,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "moderationProfiles", profileId), newProfileData);
      setAvailableProfiles(prev => [...prev, profileId]);
      setDefaultProfileId(profileId);
      setNewProfileName("");
      toast({ title: "Profile Created", description: `New profile "${profileId}" is now available.` });
    } catch (err) {
      console.error("[SETTINGS] Creation failed:", err);
    } finally {
      setIsCreating(false);
    }
  };

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
      await setDoc(doc(db, "adminSettings", "global"), globalData);
      await setDoc(doc(db, "moderationProfiles", defaultProfileId), profileData);
      
      toast({
        title: "Settings Saved",
        description: `Profile: ${defaultProfileId} updated and set as Global Default.`,
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

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* 1. Global Moderation Lens Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Active Moderation Lens
          </CardTitle>
          <CardDescription>
            Select which profile governs the entire system's automated logic.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lens-select">Current Global Profile</Label>
              <Select value={defaultProfileId} onValueChange={setDefaultProfileId}>
                <SelectTrigger id="lens-select">
                  <SelectValue placeholder="Select a lens" />
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
            <div className="p-3 bg-muted/50 rounded-md border flex items-center">
              <p className="text-xs text-muted-foreground italic">
                Switching profiles will load their specific tuning parameters below.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Create New Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5" />
            Create Custom Profile
          </CardTitle>
          <CardDescription>Add a new personality with specific sensitivity rules.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input 
              placeholder="e.g. Strict High School, Gaming Mode" 
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              disabled={isCreating}
            />
            <Button onClick={handleCreateProfile} disabled={isCreating} variant="secondary">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Profile Tuning */}
      <Card>
        <CardHeader>
          <CardTitle>
            Tuning: {defaultProfileId.charAt(0).toUpperCase() + defaultProfileId.slice(1).replace(/-/g, ' ')}
          </CardTitle>
          <CardDescription>
            Fine-tune thresholds for the active selection.
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
              Required confidence for flagging. Higher = more cautious (fewer flags).
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
              Rough talk allowance between friends. Higher = more permissive.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t p-4">
          <Button onClick={handleSaveChanges} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes to {defaultProfileId}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

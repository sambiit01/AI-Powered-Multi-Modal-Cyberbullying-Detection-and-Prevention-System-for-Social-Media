
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
import { doc, setDoc, collection, getDocs, getDoc, deleteDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Loader2, Save, Eye, Plus, Trash2, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const { toast } = useToast();
  const [toxicityThreshold, setToxicityThreshold] = useState(85);
  const [bullyingThreshold, setBullyingThreshold] = useState(75);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [defaultProfileId, setDefaultProfileId] = useState("");
  const [availableProfiles, setAvailableProfiles] = useState<string[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Initial Load: Fetch Global Config and Available Profiles
  useEffect(() => {
    async function loadConfig() {
      console.log("[SETTINGS] Loading configurations...");
      try {
        const profilesSnap = await getDocs(collection(db, "moderationProfiles"));
        const profiles = profilesSnap.docs.map(doc => doc.id);
        
        // Ensure 'standard' exists at least in local state for UI
        const finalProfiles = profiles.length > 0 ? profiles : ["standard"];
        setAvailableProfiles(finalProfiles);

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
        setAvailableProfiles(["standard"]);
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
        setProfileDisplayName(data.profileType || defaultProfileId);
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
      toast({ variant: "destructive", title: "Conflict", description: "A profile with this ID already exists." });
      return;
    }

    setIsCreating(true);
    const newProfileData: AdminSettings = {
      profileType: newProfileName,
      sensitivityThreshold: 85,
      banterTolerance: 75,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "moderationProfiles", profileId), newProfileData);
      setAvailableProfiles(prev => [...prev, profileId]);
      setDefaultProfileId(profileId);
      setNewProfileName("");
      toast({ title: "Profile Created", description: `New profile "${newProfileName}" is now available.` });
    } catch (err) {
      console.error("[SETTINGS] Creation failed:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    
    const profileData = {
      profileType: profileDisplayName || defaultProfileId,
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
        description: `Profile "${profileData.profileType}" updated and set as Global Default.`,
      });
    } catch (err: any) {
      console.error("[SETTINGS] Save failed:", err);
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: `moderationProfiles/${defaultProfileId}`,
        operation: 'write',
        requestResourceData: profileData
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (defaultProfileId === 'standard') {
      toast({ variant: "destructive", title: "Action Denied", description: "The 'standard' profile is a system default and cannot be deleted." });
      return;
    }

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "moderationProfiles", defaultProfileId));
      
      const updatedProfiles = availableProfiles.filter(p => p !== defaultProfileId);
      setAvailableProfiles(updatedProfiles);
      
      // Fallback to standard if it exists, otherwise the first available
      const fallback = updatedProfiles.includes('standard') ? 'standard' : updatedProfiles[0] || 'standard';
      setDefaultProfileId(fallback);

      // Update global config if we just deleted the default
      await setDoc(doc(db, "adminSettings", "global"), {
        defaultProfileId: fallback,
        updatedAt: new Date().toISOString()
      });

      toast({
        title: "Profile Deleted",
        description: `The profile has been removed. System reset to ${fallback}.`,
      });
    } catch (err: any) {
      console.error("[SETTINGS] Delete failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentProfileName = profileDisplayName || defaultProfileId;

  return (
    <div className="grid gap-6 max-w-4xl mx-auto">
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
            <div className="p-4 bg-muted/50 rounded-lg border flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                The selected profile will be used for all real-time detections. 
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
          <div className="flex flex-col sm:flex-row gap-4">
            <Input 
              placeholder="e.g. Strict High School, Gaming Mode" 
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              disabled={isCreating}
              className="flex-1"
            />
            <Button onClick={handleCreateProfile} disabled={isCreating} variant="secondary">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Profile Tuning */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader>
          <CardTitle>
            Tuning: {currentProfileName}
          </CardTitle>
          <CardDescription>
            Fine-tune thresholds and identity for the active selection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-3">
            <Label htmlFor="profile-name">Display Name</Label>
            <Input 
              id="profile-name"
              value={profileDisplayName}
              onChange={(e) => setProfileDisplayName(e.target.value)}
              placeholder="Enter friendly name"
              disabled={isSaving}
            />
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              System ID: {defaultProfileId}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="toxicity-threshold" className="text-sm font-semibold">
                AI Sensitivity Threshold
              </Label>
              <span className="text-lg font-bold text-primary">
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
            <p className="text-xs text-muted-foreground">
              Required confidence for flagging. Higher = more cautious (fewer flags).
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="bullying-threshold" className="text-sm font-semibold">
                Banter Tolerance
              </Label>
              <span className="text-lg font-bold text-primary">
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
            <p className="text-xs text-muted-foreground">
              Rough talk allowance between friends. Higher = more permissive.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 border-t p-6 bg-muted/20">
          <div className="flex items-center gap-2">
            {defaultProfileId !== 'standard' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/20 gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Profile
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the "{currentProfileName}" profile. 
                      If it was the global default, the system will fallback to "Standard".
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteProfile} className="bg-destructive hover:bg-destructive/90">
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <Button onClick={handleSaveChanges} disabled={isSaving} className="gap-2 w-full sm:w-auto">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All Changes
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

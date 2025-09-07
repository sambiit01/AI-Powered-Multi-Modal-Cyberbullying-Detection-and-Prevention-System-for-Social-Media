"use client";
import React, { useState } from "react";
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

export default function Settings() {
  const { toast } = useToast();
  const [toxicityThreshold, setToxicityThreshold] = useState(85);
  const [bullyingThreshold, setBullyingThreshold] = useState(75);

  const handleSaveChanges = () => {
    toast({
      title: "Settings Saved",
      description: "Your changes have been successfully saved.",
    });
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
          <CardDescription>
            Adjust the AI detection thresholds and other system parameters.
            Higher values make the detection more strict.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="toxicity-threshold" className="text-lg font-medium">
                Toxicity Threshold
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
              Threshold for flagging content as toxic. Content with a score
              above this value will be flagged.
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="bullying-threshold" className="text-lg font-medium">
                Bullying Score Threshold
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
              Threshold for identifying user communication as bullying behavior.
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
                  Automatically suspend users who exceed the bullying threshold multiple times.
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
        <Button onClick={handleSaveChanges}>Save Changes</Button>
      </div>
    </div>
  );
}

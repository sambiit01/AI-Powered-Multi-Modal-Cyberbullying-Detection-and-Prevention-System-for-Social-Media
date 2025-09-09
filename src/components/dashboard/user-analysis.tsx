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
  analyzeUserCommunicationPatterns,
  AnalyzeUserCommunicationPatternsOutput,
} from "@/ai/flows/analyze-user-communication-patterns";
import { Progress } from "@/components/ui/progress";
import { type Activity } from "@/app/page";

type UserAnalysisProps = {
  addActivity: (activity: Omit<Activity, "id" | "date">) => void;
};

export default function UserAnalysis({ addActivity }: UserAnalysisProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] =
    useState<AnalyzeUserCommunicationPatternsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setResult(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const currentUserId = formData.get("userId") as string;
    const messagesRaw = formData.get("messages") as string;

    setUserId(currentUserId);

    if (!currentUserId || !messagesRaw) {
      setError("Please provide a User ID and at least one message.");
      setIsLoading(false);
      return;
    }

    const messages = messagesRaw.split("\n").filter((msg) => msg.trim() !== "");

    if (messages.length === 0) {
      setError("Please provide at least one message.");
      setIsLoading(false);
      return;
    }

    try {
      const analysisResult = await analyzeUserCommunicationPatterns({
        userId: currentUserId,
        messages,
      });
      setResult(analysisResult);

      if (analysisResult.bullyingLikelihood > 0.75) {
        addActivity({
          type: "User",
          details: `High-risk behavior detected for user ${currentUserId}`,
          status: "Flagged",
          isHighRisk: true,
          isCyberbullying: true,
        });
      }
      if (analysisResult.victimLikelihood > 0.75) {
        addActivity({
          type: "User",
          details: `User ${currentUserId} identified as potential victim.`,
          status: "Monitored",
          isPotentialVictim: true,
        });
      }
    } catch (e) {
      setError("An error occurred during analysis. Please try again.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <Card>
        <CardHeader>
          <CardTitle>User Behavior Analysis</CardTitle>
          <CardDescription>
            Analyze a user's communication patterns to identify potential
            bullies and victims.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  name="userId"
                  type="text"
                  placeholder="@username or user_id_123"
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="messages">Recent Messages</Label>
                <Textarea
                  id="messages"
                  name="messages"
                  placeholder="Enter recent messages from the user, one per line."
                  className="min-h-48"
                  disabled={isLoading}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Analyze User
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
            <CardTitle>Behavioral Analysis Report for {userId}</CardTitle>
            <CardDescription>
              Likelihood of the user being a bully or a victim.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Bullying Likelihood</Label>
              <div className="flex items-center gap-4">
                <Progress value={result.bullyingLikelihood * 100} />
                <span className="font-semibold text-lg">
                  {(result.bullyingLikelihood * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Victim Likelihood</Label>
              <div className="flex items-center gap-4">
                <Progress
                  value={result.victimLikelihood * 100}
                  className="[&>div]:bg-amber-500"
                />
                <span className="font-semibold text-lg">
                  {(result.victimLikelihood * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Analysis Details</h3>
              <p className="text-sm text-muted-foreground bg-slate-100 p-4 rounded-md">
                {result.analysisDetails}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

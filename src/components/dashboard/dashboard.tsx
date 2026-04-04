"use client";

import * as React from "react";
import { collection, addDoc, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

import { type View, AppSidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/header";
import Overview from "@/components/dashboard/overview";
import Moderation from "@/components/dashboard/moderation";
import ReportingTool from "@/components/dashboard/reporting-tool";
import Settings from "@/components/dashboard/settings";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Activity = {
  id: string;
  type: "Content" | "User" | "Report";
  details: string;
  status: "Flagged" | "Pending" | "Monitored" | "Action Taken";
  date: string; // ISO string
  isCyberbullying?: boolean;
  isHighRisk?: boolean;
  isPotentialVictim?: boolean;
  reasoning?: string;
  originalText?: string;
  relType?: string;
  userId: string;
};

export default function Dashboard() {
  const { user, userProfile, signOut } = useAuth();
  const [activeView, setActiveView] = React.useState<View>("overview");
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
        console.log("[Dashboard] No user authenticated.");
        return;
    }

    if (!userProfile) {
      console.log("[Dashboard] Waiting for auth profile data...");
      const timeout = setTimeout(() => {
          if (loading) {
              console.error("[Dashboard] Profile fetch timed out.");
              setLoading(false);
          }
      }, 5000);
      return () => clearTimeout(timeout);
    }

    const isAdmin = userProfile.role === 'superuser';
    console.log(`[Dashboard] Fetching data for ${isAdmin ? 'ADMIN' : 'USER'}: ${user.uid}`);

    const activitiesRef = collection(db, "activities");
    const q = isAdmin 
      ? query(activitiesRef)
      : query(activitiesRef, where("userId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const activitiesData: Activity[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          let dateStr = new Date().toISOString();
          
          if (data.date) {
            if (typeof data.date.toDate === 'function') {
              dateStr = (data.date as Timestamp).toDate().toISOString();
            } else if (typeof data.date === 'string') {
              dateStr = data.date;
            }
          }

          activitiesData.push({
            id: doc.id,
            ...data,
            date: dateStr,
          } as Activity);
        });

        activitiesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setActivities(activitiesData);
        setLoading(false);
      }, 
      async (error: any) => {
        console.error("[Dashboard] Snapshot error:", error);
        if (error.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'activities',
            operation: 'list'
          }));
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, userProfile]);

  const addActivity = (activity: Omit<Activity, "id" | "date" | "userId">) => {
     if (!user) return;
    
    const activityData = {
      ...activity,
      date: new Date().toISOString(),
      userId: user.uid,
    };

    addDoc(collection(db, "activities"), activityData).catch(async (error) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'activities',
        operation: 'create',
        requestResourceData: activityData
      }));
    });
  };

  const renderView = () => {
    switch (activeView) {
      case "overview": return <Overview activities={activities} />;
      case "moderation": return <Moderation addActivity={addActivity} />;
      case "reporting": return <ReportingTool addActivity={addActivity} activities={activities} />;
      case "settings": return <Settings />;
      default: return <Overview activities={activities} />;
    }
  };

  if (loading) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading dashboard data...</p>
        </div>
    );
  }

  if (user && !userProfile) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 p-4 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h1 className="text-xl font-bold">Profile Not Found</h1>
            <p className="max-w-md text-muted-foreground">
                Your account is authenticated, but we couldn't find your profile in the database. 
                Please try logging out and back in, or contact support.
            </p>
            <Button variant="outline" onClick={signOut}>Log Out</Button>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <AppSidebar activeView={activeView} setActiveView={setActiveView} />
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
        <AppHeader activeView={activeView} setActiveView={setActiveView} />
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

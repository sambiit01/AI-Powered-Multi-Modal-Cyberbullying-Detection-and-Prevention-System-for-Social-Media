
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
import UserAnalysis from "@/components/dashboard/user-analysis";
import ReportingTool from "@/components/dashboard/reporting-tool";
import Settings from "@/components/dashboard/settings";
import { Loader2 } from "lucide-react";

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
  const { user, userProfile } = useAuth();
  const [activeView, setActiveView] = React.useState<View>("overview");
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user || !userProfile) {
      console.log("[Dashboard] Waiting for auth profile...");
      return;
    }

    const isAdmin = userProfile.role === 'superuser';
    console.log(`[Dashboard] Initializing data for ${isAdmin ? 'ADMIN' : 'USER'}: ${user.uid}`);

    const activitiesRef = collection(db, "activities");
    
    // We remove the server-side orderBy to avoid the requirement for a composite index
    // Firestore requires a composite index when combining equality filters (where) with inequality/ordering.
    const q = isAdmin 
      ? query(activitiesRef)
      : query(activitiesRef, where("userId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        console.log(`[Dashboard] ${isAdmin ? 'Admin' : 'User'} update: ${querySnapshot.size} records found.`);
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

        // Client-side sorting: Sort by date descending (newest first)
        activitiesData.sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

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

    return () => {
      console.log("[Dashboard] Cleaning up data listeners.");
      unsubscribe();
    };
  }, [user, userProfile]);

  const addActivity = (activity: Omit<Activity, "id" | "date" | "userId">) => {
     if (!user) return;
    console.log("[Dashboard] Creating new activity log...");
    
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
      case "overview":
        return <Overview activities={activities} />;
      case "moderation":
        return <Moderation addActivity={addActivity} />;
      case "user-analysis":
        return <UserAnalysis addActivity={addActivity} />;
      case "reporting":
        return <ReportingTool addActivity={addActivity} />;
      case "settings":
        return <Settings />;
      default:
        return <Overview activities={activities} />;
    }
  };

  if (loading) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
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

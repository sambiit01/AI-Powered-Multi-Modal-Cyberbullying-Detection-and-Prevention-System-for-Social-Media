"use client";

import * as React from "react";
import { collection, addDoc, onSnapshot, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";

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
};

export default function Dashboard() {
  const { user } = useAuth();
  const [activeView, setActiveView] = React.useState<View>("overview");
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      console.log("[Dashboard] No user found, skipping activity subscription.");
      return;
    }

    console.log("[Dashboard] Setting up real-time activity subscription for user:", user.uid);
    const activitiesRef = collection(db, "activities");
    const q = query(
      activitiesRef,
      where("userId", "==", user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log("[Dashboard] Firestore update received. Activity count:", querySnapshot.size);
      const activitiesData: Activity[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.date && typeof data.date.toDate === 'function') {
            activitiesData.push({
            id: doc.id,
            ...data,
            date: (data.date as Timestamp).toDate().toISOString(),
            } as Activity);
        }
      });
      activitiesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(activitiesData);
      setLoading(false);
    }, (error) => {
        console.error("[Dashboard] Error fetching activities: ", error);
        setLoading(false);
    });

    return () => {
      console.log("[Dashboard] Unsubscribing from activity feed.");
      unsubscribe();
    };
  }, [user]);

  const addActivity = async (activity: Omit<Activity, "id" | "date">) => {
     if (!user) return;
    console.log("[Dashboard] Adding new activity to Firestore:", activity);
    try {
      const docRef = await addDoc(collection(db, "activities"), {
        ...activity,
        date: new Date(),
        userId: user.uid,
      });
      console.log("[Dashboard] Activity saved successfully with ID:", docRef.id);
    } catch (error) {
      console.error("[Dashboard] Error adding activity: ", error);
    }
  };

  const renderView = () => {
    console.log("[Dashboard] Rendering view:", activeView);
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

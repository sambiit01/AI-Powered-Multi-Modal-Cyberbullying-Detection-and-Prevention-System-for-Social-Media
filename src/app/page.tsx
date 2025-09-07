"use client";

import * as React from "react";
import { type View, AppSidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/header";
import Overview from "@/components/dashboard/overview";
import Moderation from "@/components/dashboard/moderation";
import UserAnalysis from "@/components/dashboard/user-analysis";
import ReportingTool from "@/components/dashboard/reporting-tool";
import Settings from "@/components/dashboard/settings";

export default function DashboardPage() {
  const [activeView, setActiveView] = React.useState<View>("overview");

  const renderView = () => {
    switch (activeView) {
      case "overview":
        return <Overview />;
      case "moderation":
        return <Moderation />;
      case "user-analysis":
        return <UserAnalysis />;
      case "reporting":
        return <ReportingTool />;
      case "settings":
        return <Settings />;
      default:
        return <Overview />;
    }
  };

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

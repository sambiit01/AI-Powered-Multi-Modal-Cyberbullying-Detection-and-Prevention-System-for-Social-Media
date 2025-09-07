"use client";

import React from "react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutGrid,
  MessageSquareWarning,
  UsersRound,
  FilePlus2,
  Settings,
} from "lucide-react";
import { ShieldIcon } from "../icons/shield-icon";

export type View =
  | "overview"
  | "moderation"
  | "user-analysis"
  | "reporting"
  | "settings";

type AppSidebarProps = {
  activeView: View;
  setActiveView: (view: View) => void;
};

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "moderation", label: "Moderation", icon: MessageSquareWarning },
  { id: "user-analysis", label: "User Analysis", icon: UsersRound },
  { id: "reporting", label: "Reporting", icon: FilePlus2 },
];

export function AppSidebar({ activeView, setActiveView }: AppSidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <TooltipProvider>
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
          <Link
            href="#"
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
            onClick={() => setActiveView("overview")}
          >
            <ShieldIcon className="h-5 w-5 transition-all group-hover:scale-110" />
            <span className="sr-only">ShieldAI</span>
          </Link>
          {navItems.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Link
                  href="#"
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8 ${
                    activeView === item.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveView(item.id as View)}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </nav>
        <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="#"
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8 ${
                  activeView === "settings"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveView("settings")}
              >
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        </nav>
      </TooltipProvider>
    </aside>
  );
}

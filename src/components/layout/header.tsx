"use client";

import React from "react";
import Link from "next/link";
import {
  FilePlus2,
  LayoutGrid,
  MessageSquareWarning,
  PanelLeft,
  Settings,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ShieldIcon } from "../icons/shield-icon";
import Image from "next/image";
import { type View } from "./sidebar";

type AppHeaderProps = {
  activeView: View;
  setActiveView: (view: View) => void;
};

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "moderation", label: "Moderation", icon: MessageSquareWarning },
  { id: "user-analysis", label: "User Analysis", icon: UsersRound },
  { id: "reporting", label: "Reporting", icon: FilePlus2 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AppHeader({ activeView, setActiveView }: AppHeaderProps) {
  const currentViewLabel =
    navItems.find((item) => item.id === activeView)?.label || "Dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              href="#"
              className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
              onClick={() => setActiveView("overview")}
            >
              <ShieldIcon className="h-6 w-6 transition-all group-hover:scale-110" />
              <span className="sr-only">ShieldAI</span>
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.id}
                href="#"
                className={`flex items-center gap-4 px-2.5 ${
                  activeView === item.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveView(item.id as View)}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      <div className="flex-1">
        <h1 className="text-xl font-semibold">{currentViewLabel}</h1>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="overflow-hidden rounded-full"
          >
            <Image
              src="https://picsum.photos/36/36"
              width={36}
              height={36}
              alt="Avatar"
              data-ai-hint="user avatar"
              className="overflow-hidden rounded-full"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuItem>Support</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

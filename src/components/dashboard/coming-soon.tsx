"use client";

import { ShieldCheck } from "lucide-react";

export default function ComingSoon() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full">
      <div className="flex flex-col items-center gap-4 text-center p-8">
        <ShieldCheck className="h-16 w-16 text-primary" />
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
          Coming Soon!
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-md">
          We're hard at work building this feature. Please check back later to
          see our powerful new content moderation tools in action.
        </p>
      </div>
    </div>
  );
}

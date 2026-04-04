"use client";

import React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  ShieldAlert,
  Users,
  MessageSquareWarning,
  Info,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Activity } from "./dashboard";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/hooks/use-auth";

const chartConfig = {
  incidents: {
    label: "Incidents",
    color: "hsl(var(--primary))",
  },
};

type OverviewProps = {
  activities: Activity[];
};

export default function Overview({ activities }: OverviewProps) {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === "superuser";

  const incidentsFlagged = activities.filter(
    (a) => a.isCyberbullying
  ).length;
  const highRiskUsers = activities.filter((a) => a.isHighRisk).length;
  const potentialVictims = activities.filter((a) => a.isPotentialVictim).length;
  const reportsSubmitted = activities.filter((a) => a.type === "Report").length;

  const chartData = React.useMemo(() => {
    const months: { [key: string]: number } = {};

    // Initialize the last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = format(d, "yyyy-MM");
      months[monthKey] = 0;
    }
    
    activities.forEach((activity) => {
      if (activity.isCyberbullying) {
        try {
          const monthKey = format(parseISO(activity.date), "yyyy-MM");
          if (months.hasOwnProperty(monthKey)) {
            months[monthKey]++;
          }
        } catch (e) {}
      }
    });

    return Object.keys(months).map((key) => ({
      month: format(new Date(key + "-01T12:00:00"), "MMM"),
      incidents: months[key] || 0,
    }));
  }, [activities]);

  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Incidents Flagged</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2">
              <ShieldAlert className="h-8 w-8 text-primary" />
              {incidentsFlagged}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High-Risk Users</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2">
              <Users className="h-8 w-8 text-destructive" />
              {highRiskUsers}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Potential Victims</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2">
              <MessageSquareWarning className="h-8 w-8 text-amber-500" />
              {potentialVictims}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reports Submitted</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2">
              <FileText className="h-8 w-8 text-secondary-foreground" />
              {reportsSubmitted}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Incident Trends</CardTitle>
            <CardDescription>
              {isAdmin ? "Global platform incidents" : "Your detected incidents"} over the last 6 months.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                  allowDecimals={false}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: "hsl(var(--muted))" }}
                />
                <Bar
                  dataKey="incidents"
                  fill="var(--color-incidents)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              {isAdmin ? "Unified log of all automated detections." : "A log of your automated detections."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.slice(0, 10).map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <Badge variant="outline">{activity.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate max-w-[150px]">{activity.details}</div>
                          {activity.reasoning && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">{activity.reasoning}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(activity.date), "MMM d, h:mm a")}
                          {isAdmin && activity.userId && ` • ${activity.userId.substring(0, 6)}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            activity.status === "Flagged" ||
                            activity.status === "Action Taken"
                              ? "destructive"
                              : activity.status === "Pending"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {activity.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8 text-sm">
                No activity yet. Analyze content to see results.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

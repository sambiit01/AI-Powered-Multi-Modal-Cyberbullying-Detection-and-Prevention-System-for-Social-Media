"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
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
} from "lucide-react";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartData = [
  { month: "January", incidents: 186 },
  { month: "February", incidents: 305 },
  { month: "March", incidents: 237 },
  { month: "April", incidents: 173 },
  { month: "May", incidents: 209 },
  { month: "June", incidents: 214 },
];

const recentActivities = [
  {
    id: "U-123",
    type: "User",
    details: "High-risk behavior detected for user @toxic_troll",
    status: "Flagged",
    date: "2024-05-28",
  },
  {
    id: "C-456",
    type: "Content",
    details: 'Text post "You are worthless" flagged for review.',
    status: "Flagged",
    date: "2024-05-28",
  },
  {
    id: "R-789",
    type: "Report",
    details: "Manual report submitted for user @cyber_bully_x",
    status: "Pending",
    date: "2024-05-27",
  },
  {
    id: "U-101",
    type: "User",
    details: "User @victim_support identified as potential victim.",
    status: "Monitored",
    date: "2024-05-26",
  },
  {
    id: "C-112",
    type: "Content",
    details: "Image with hateful caption flagged for review.",
    status: "Action Taken",
    date: "2024-05-25",
  },
];

export default function Overview() {
  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Incidents Flagged (24h)</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2">
              <ShieldAlert className="h-8 w-8 text-primary" />
              128
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High-Risk Users</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2">
              <Users className="h-8 w-8 text-destructive" />
              32
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Potential Victims</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2">
              <MessageSquareWarning className="h-8 w-8 text-amber-500" />
              54
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reports Submitted</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2">
              <FileText className="h-8 w-8 text-secondary-foreground" />
              45
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Incident Trends</CardTitle>
            <CardDescription>
              Incidents detected over the last 6 months.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
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
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: "hsl(var(--muted))" }}
                />
                <Bar
                  dataKey="incidents"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              A log of recent automated detections and manual reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <Badge variant="outline">{activity.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{activity.details}</div>
                      <div className="text-sm text-muted-foreground">
                        {activity.date}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

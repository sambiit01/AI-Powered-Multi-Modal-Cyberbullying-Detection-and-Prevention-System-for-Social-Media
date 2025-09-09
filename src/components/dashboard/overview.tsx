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
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { type Activity } from "@/app/page";

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
  const incidentsFlagged = activities.filter(
    (a) => a.isCyberbullying
  ).length;
  const highRiskUsers = activities.filter((a) => a.isHighRisk).length;
  const potentialVictims = activities.filter((a) => a.isPotentialVictim).length;
  const reportsSubmitted = activities.filter((a) => a.type === "Report").length;

  const chartData = React.useMemo(() => {
    const months: { [key: string]: number } = {
      January: 0,
      February: 0,
      March: 0,
      April: 0,
      May: 0,
      June: 0,
      July: 0,
      August: 0,
      September: 0,
      October: 0,
      November: 0,
      December: 0,
    };

    activities.forEach((activity) => {
      if (activity.isCyberbullying) {
        const month = new Date(activity.date).toLocaleString("default", {
          month: "long",
        });
        if (months.hasOwnProperty(month)) {
          months[month]++;
        }
      }
    });

    const currentMonthIndex = new Date().getMonth();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    // Get last 6 months including current
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const monthIndex = (currentMonthIndex - i + 12) % 12;
      return monthNames[monthIndex];
    }).reverse();

    return last6Months.map((month) => ({
      month,
      incidents: months[month] || 0,
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
              Incidents detected over the last 6 months.
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
              A log of recent automated detections and manual reports.
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
                  {activities.slice(0, 5).map((activity) => (
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
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No activity yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

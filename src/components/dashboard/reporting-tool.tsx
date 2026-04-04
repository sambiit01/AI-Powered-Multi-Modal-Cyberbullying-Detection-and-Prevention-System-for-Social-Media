"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, CheckCircle2, XCircle, FileText, ListChecks } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type Activity } from "./dashboard";
import { useAuth } from "@/hooks/use-auth";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, parseISO } from "date-fns";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const reportSchema = z.object({
  contentUrl: z.string().url({ message: "Please enter a valid URL." }),
  bullyingType: z.string().min(1, { message: "Please select a category." }),
  description: z
    .string()
    .min(10, { message: "Description must be at least 10 characters." })
    .max(500, { message: "Description cannot exceed 500 characters." }),
});

type ReportFormValues = z.infer<typeof reportSchema>;

type ReportingToolProps = {
  addActivity: (activity: Omit<Activity, "id" | "date" | "userId">) => void;
  activities: Activity[];
};

export default function ReportingTool({ addActivity, activities }: ReportingToolProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === "superuser";

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      contentUrl: "",
      bullyingType: "",
      description: "",
    },
  });

  async function onSubmit(data: ReportFormValues) {
    console.log("[REPORTING] Manual report submitted:", data);
    await addActivity({
      type: "Report",
      details: `Manual report for: ${data.contentUrl}`,
      status: "Pending",
      isCyberbullying: true,
    });

    toast({
      title: "Report Submitted",
      description: "Thank you for your report. Our team will review it shortly.",
    });
    form.reset();
  }

  const handleCorrectLabel = async (activity: Activity, correctedLabel: string) => {
    const feedbackData = {
      text: activity.originalText || activity.details,
      relationship: activity.relType || "Stranger",
      history: "Admin Management Review",
      label: correctedLabel,
      sourceFile: "Admin Reporting Console",
      uploadedAt: new Date().toISOString()
    };

    addDoc(collection(db, "contextExamples"), feedbackData)
      .then(() => {
        toast({
          title: "Incident Reviewed",
          description: `Successfully labeled as ${correctedLabel}.`,
        });
      })
      .catch((err) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: "contextExamples",
          operation: "create",
          requestResourceData: feedbackData
        }));
      });
  };

  const ReportForm = (
    <Card>
      <CardHeader>
        <CardTitle>Submit a Report</CardTitle>
        <CardDescription>
          If you've witnessed or experienced cyberbullying, please let us know.
          Provide as much detail as possible.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="contentUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/post/123"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bullyingType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type of Bullying</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="harassment">Harassment</SelectItem>
                      <SelectItem value="hate-speech">Hate Speech</SelectItem>
                      <SelectItem value="impersonation">Impersonation</SelectItem>
                      <SelectItem value="threats">Threats of Violence</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description of Incident</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what happened..."
                      className="min-h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit">Submit Report</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  const ActivityReviewTable = (
    <Card>
      <CardHeader>
        <CardTitle>Global Activity Review</CardTitle>
        <CardDescription>
          Manage and refine all detected incidents across the platform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Date</TableHead>
                  <TableHead>Activity Details</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="text-xs font-medium">
                      {format(parseISO(activity.date), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[250px] font-medium">
                          {activity.details}
                        </span>
                        {activity.reasoning && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md">
                                <p className="text-sm font-semibold mb-1">AI Reasoning:</p>
                                <p className="text-xs">{activity.reasoning}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        User: {activity.userId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{activity.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          activity.status === "Flagged" || activity.status === "Action Taken"
                            ? "destructive"
                            : activity.status === "Pending"
                            ? "secondary"
                            : "default"
                        }
                      >
                        {activity.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleCorrectLabel(activity, "Bullying")}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mark as Bullying</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-primary"
                                onClick={() => handleCorrectLabel(activity, "Not Bullying")}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mark as Safe</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            No platform activity found to review.
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!isAdmin) {
    return ReportForm;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="review" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="review" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Activity Review
          </TabsTrigger>
          <TabsTrigger value="report" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Manual Report
          </TabsTrigger>
        </TabsList>
        <TabsContent value="review">
          {ActivityReviewTable}
        </TabsContent>
        <TabsContent value="report">
          {ReportForm}
        </TabsContent>
      </Tabs>
    </div>
  );
}

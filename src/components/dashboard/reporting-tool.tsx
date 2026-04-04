"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Info, CheckCircle2, XCircle, FileText, ListChecks, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type Activity } from "./dashboard";
import { useAuth } from "@/hooks/use-auth";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
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
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      contentUrl: "",
      bullyingType: "",
      description: "",
    },
  });

  async function onSubmit(data: ReportFormValues) {
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
    const isBullying = correctedLabel === "Bullying";
    const newStatus = isBullying ? "Flagged" : "Safe";

    const feedbackData = {
      text: activity.originalText || activity.details,
      relationship: activity.relType || "Stranger",
      interaction_history: activity.histType || "Neutral",
      interaction_frequency: activity.freq || "Normal",
      history: "Admin Management Review",
      label: correctedLabel,
      sourceFile: "Admin Reporting Console",
      uploadedAt: new Date().toISOString()
    };

    // 1. Add to context examples
    addDoc(collection(db, "contextExamples"), feedbackData)
      .catch((err) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: "contextExamples",
          operation: "create",
          requestResourceData: feedbackData
        }));
      });

    // 2. Update the actual activity status
    const activityRef = doc(db, "activities", activity.id);
    updateDoc(activityRef, {
      status: newStatus,
      isCyberbullying: isBullying
    }).then(() => {
      toast({
        title: "Incident Reviewed",
        description: `Successfully labeled as ${newStatus}. AI accuracy improved.`,
      });
      setSelectedActivity(null);
    }).catch((err) => {
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: `activities/${activity.id}`,
        operation: "update",
        requestResourceData: { status: newStatus }
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
    <>
      <Card>
        <CardHeader>
          <CardTitle>Global Activity Review</CardTitle>
          <CardDescription>
            Audit and refine all platform incidents with full contextual detail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="text-xs">
                        {format(parseISO(activity.date), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {activity.details}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedActivity(activity)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Review Details
                        </Button>
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

      <Dialog open={!!selectedActivity} onOpenChange={() => setSelectedActivity(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Incident Detailed Review</DialogTitle>
            <DialogDescription>
              Analyze the full context and AI reasoning before providing a manual correction.
            </DialogDescription>
          </DialogHeader>
          
          {selectedActivity && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-semibold">Incident Type</p>
                  <p>{selectedActivity.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold">Date</p>
                  <p>{format(parseISO(selectedActivity.date), "PPP p")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold">Sender UID</p>
                  <p className="font-mono text-xs">{selectedActivity.userId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold">Relationship Context</p>
                  <div className="flex gap-2">
                    <Badge variant="outline">{selectedActivity.relType || "Unknown"}</Badge>
                    <Badge variant="outline" className="bg-muted">{selectedActivity.histType || "Neutral"}</Badge>
                    <Badge variant="outline" className="bg-muted">{selectedActivity.freq || "Normal"}</Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-semibold mb-2">Original Content</p>
                <div className="bg-muted p-3 rounded-md text-sm italic">
                  "{selectedActivity.originalText || selectedActivity.details}"
                </div>
              </div>

              {selectedActivity.reasoning && (
                <div>
                  <p className="text-sm font-semibold mb-2">AI Behavioral Reasoning</p>
                  <div className="bg-primary/5 border border-primary/20 p-3 rounded-md text-sm">
                    {selectedActivity.reasoning}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-xs font-bold uppercase text-muted-foreground mb-4">
                  Manual Intervention
                </p>
                <div className="flex gap-3">
                  <Button 
                    className="flex-1 bg-destructive hover:bg-destructive/90" 
                    onClick={() => handleCorrectLabel(selectedActivity, "Bullying")}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Correct as Bullying
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 border-primary text-primary hover:bg-primary/5"
                    onClick={() => handleCorrectLabel(selectedActivity, "Not Bullying")}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Correct as Safe
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
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
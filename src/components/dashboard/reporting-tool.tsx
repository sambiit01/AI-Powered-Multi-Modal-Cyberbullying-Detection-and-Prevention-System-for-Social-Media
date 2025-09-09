"use client";

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
import { useToast } from "@/hooks/use-toast";
import { type Activity } from "@/app/page";

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
  addActivity: (activity: Omit<Activity, "id" | "date">) => void;
};

export default function ReportingTool({ addActivity }: ReportingToolProps) {
  const { toast } = useToast();

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      contentUrl: "",
      bullyingType: "",
      description: "",
    },
  });

  function onSubmit(data: ReportFormValues) {
    console.log("Report submitted:", data);
    addActivity({
      type: "Report",
      details: `Manual report for: ${data.contentUrl}`,
      status: "Pending",
      isCyberbullying: true, // Manual reports are treated as incidents
    });

    toast({
      title: "Report Submitted",
      description:
        "Thank you for your report. Our team will review it shortly.",
    });
    form.reset();
  }

  return (
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
}

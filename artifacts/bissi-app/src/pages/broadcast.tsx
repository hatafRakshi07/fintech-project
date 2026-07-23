import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Send, Users, UserCheck, ShieldAlert, Bell, CheckCircle2, History, Building2 } from "lucide-react";

interface BroadcastHistoryItem {
  id: number;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

export default function BroadcastPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"all" | "customers" | "collectors" | "branch">("all");
  const [branchId, setBranchId] = useState<string>("");
  const [type, setType] = useState<"announcement" | "reminder" | "alert" | "general">("announcement");

  // Fetch branches for target dropdown
  const { data: branches } = useQuery<any[]>({
    queryKey: ["branches-list"],
    queryFn: () => customFetch("/api/branches"),
  });

  // Broadcast mutation
  const broadcastMutation = useMutation({
    mutationFn: async (payload: any) => {
      return customFetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Broadcast Sent Successfully!",
        description: `Message sent to ${data.count ?? 0} recipients.`,
      });
      setTitle("");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: any) => {
      toast({
        title: "Broadcast Failed",
        description: err.message || "Failed to send broadcast message.",
        variant: "destructive",
      });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter both a title and a message.",
        variant: "destructive",
      });
      return;
    }

    broadcastMutation.mutate({
      title: title.trim(),
      message: message.trim(),
      type,
      target,
      branchId: target === "branch" && branchId ? parseInt(branchId, 10) : undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-primary" />
            Message Broadcasting & Announcements
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Broadcast real-time push announcements, payment reminders, and urgent alerts to your members and staff.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Compose Form */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Compose Broadcast Message
              </CardTitle>
              <CardDescription>
                Select your target audience, choose notification priority, and write your announcement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSend} className="space-y-5">
                {/* Target Audience & Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Target Audience
                    </label>
                    <Select value={target} onValueChange={(val: any) => setTarget(val)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Members & Staff (Everyone)</SelectItem>
                        <SelectItem value="customers">All Customers Only</SelectItem>
                        <SelectItem value="collectors">All Field Collectors Only</SelectItem>
                        <SelectItem value="branch">Specific Branch Members</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      Notification Category
                    </label>
                    <Select value={type} onValueChange={(val: any) => setType(val)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="announcement">📢 Public Announcement</SelectItem>
                        <SelectItem value="reminder">⏰ Payment Reminder</SelectItem>
                        <SelectItem value="alert">⚠️ Urgent Alert</SelectItem>
                        <SelectItem value="general">ℹ️ General Notice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Conditional Branch Selection */}
                {target === "branch" && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Select Branch
                    </label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select a branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches?.map((b: any) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.name} ({b.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Title */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Message Title</label>
                  <Input
                    placeholder="e.g. Monthly Draw & Lucky Winner Announcement"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-11 text-base"
                    required
                  />
                </div>

                {/* Message Body */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Message Content</label>
                  <Textarea
                    placeholder="Write your broadcast message details here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    className="text-base resize-none"
                    required
                  />
                </div>

                {/* Send Button */}
                <Button
                  type="submit"
                  disabled={broadcastMutation.isPending}
                  className="w-full h-11 text-base font-semibold gap-2 shadow-lg"
                >
                  <Send className="h-5 w-5" />
                  {broadcastMutation.isPending ? "Broadcasting Message..." : "Broadcast Real-Time Message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info & Target Summary */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm bg-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Target Audience Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-1 border-b border-border">
                <span className="text-muted-foreground">Audience Scope:</span>
                <Badge variant="outline" className="capitalize font-semibold">
                  {target}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border">
                <span className="text-muted-foreground">Type:</span>
                <Badge className="capitalize">{type}</Badge>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Delivery Method:</span>
                <span className="font-semibold text-emerald-600">In-App & Real-Time Push</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                Broadcasting Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>• Broadcasted messages are immediately pushed to all selected user dashboards and mobile apps.</p>
              <p>• Use <strong>Payment Reminders</strong> for monthly installment dues.</p>
              <p>• Avoid repetitive messages to ensure high engagement.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

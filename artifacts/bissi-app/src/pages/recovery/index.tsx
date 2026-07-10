import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Clock, CheckCircle2, TrendingUp, Plus, Phone, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type RecoveryTask = {
  id: number; customerId: number; collectionId?: number; loanId?: number;
  assignedCollectorId?: number; status: string; priority: string;
  dueDate?: string; overdueAmount?: string; notes?: string;
  lastContactDate?: string; nextFollowUpDate?: string; resolutionNotes?: string;
  resolvedAt?: string; branchId: number;
  customerName?: string; customerMobile?: string; collectorName?: string;
};
type RecoverySummary = { pending: number; inProgress: number; resolved: number; escalated: number; critical: number };

const statusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", in_progress: "default", resolved: "secondary", escalated: "destructive", written_off: "secondary",
};
const priorityColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "secondary", medium: "outline", high: "default", critical: "destructive",
};

const formatCurrency = (s: string) => {
  const n = parseFloat(s ?? "0");
  return isNaN(n) ? s : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
};

export default function RecoveryPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<RecoveryTask | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const [newTask, setNewTask] = useState({ customerId: "", priority: "medium", dueDate: "", overdueAmount: "", notes: "", nextFollowUpDate: "", branchId: "1" });
  const [callNote, setCallNote] = useState({ outcome: "answered", notes: "", nextAction: "" });

  const { data: summary } = useQuery<RecoverySummary>({ queryKey: ["recovery", "summary"], queryFn: () => api.get("/recovery/summary") });
  const { data: tasks = [], isLoading } = useQuery<RecoveryTask[]>({
    queryKey: ["recovery", "tasks", statusFilter],
    queryFn: () => api.get(`/recovery/tasks${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
  });

  const createTask = useMutation({
    mutationFn: (d: typeof newTask) => api.post("/recovery/tasks", { ...d, customerId: parseInt(d.customerId), branchId: parseInt(d.branchId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recovery"] }); setIsAddOpen(false); toast({ title: "Recovery task created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, ...data }: { id: number; [k: string]: any }) => api.patch(`/recovery/tasks/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recovery"] }); toast({ title: "Task updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const logCall = useMutation({
    mutationFn: ({ taskId, customerId, ...data }: { taskId: number; customerId: number; [k: string]: any }) =>
      api.post(`/recovery/tasks/${taskId}/calls`, { customerId, ...data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recovery"] }); toast({ title: "Call logged" }); setCallNote({ outcome: "answered", notes: "", nextAction: "" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recovery Module</h1>
          <p className="text-muted-foreground">Manage overdue payments and recovery tasks</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Recovery Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Recovery Task</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Customer ID</Label>
                <Input type="number" placeholder="Customer ID" value={newTask.customerId} onChange={e => setNewTask({ ...newTask, customerId: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Priority</Label>
                  <Select value={newTask.priority} onValueChange={v => setNewTask({ ...newTask, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Overdue Amount (₹)</Label>
                  <Input type="number" placeholder="5000" value={newTask.overdueAmount} onChange={e => setNewTask({ ...newTask, overdueAmount: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Due Date</Label>
                  <Input type="date" value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })} />
                </div>
                <div>
                  <Label>Next Follow-up</Label>
                  <Input type="date" value={newTask.nextFollowUpDate} onChange={e => setNewTask({ ...newTask, nextFollowUpDate: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea placeholder="Add notes about this recovery task" value={newTask.notes} onChange={e => setNewTask({ ...newTask, notes: e.target.value })} />
              </div>
              <Button className="w-full" onClick={() => createTask.mutate(newTask)} disabled={createTask.isPending || !newTask.customerId}>
                {createTask.isPending ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.pending ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.inProgress ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{summary?.resolved ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Escalated</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{summary?.escalated ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{summary?.critical ?? 0}</div></CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "pending", "in_progress", "escalated", "resolved"].map(s => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
            {s === "all" ? "All" : s.replace("_", " ")}
          </Button>
        ))}
      </div>

      {/* Task List */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Overdue Amount</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Next Follow-up</TableHead>
                <TableHead>Collector</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : tasks.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No recovery tasks found.</TableCell></TableRow>
              ) : tasks.map(t => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTask(t)}>
                  <TableCell>
                    <div className="font-medium">{t.customerName ?? `Customer #${t.customerId}`}</div>
                    {t.customerMobile && <div className="text-xs text-muted-foreground">{t.customerMobile}</div>}
                  </TableCell>
                  <TableCell className="font-medium text-destructive">{t.overdueAmount ? formatCurrency(t.overdueAmount) : "—"}</TableCell>
                  <TableCell><Badge variant={priorityColor[t.priority] ?? "outline"}>{t.priority}</Badge></TableCell>
                  <TableCell><Badge variant={statusColor[t.status] ?? "outline"}>{t.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell>{t.dueDate ?? "—"}</TableCell>
                  <TableCell>{t.nextFollowUpDate ?? "—"}</TableCell>
                  <TableCell>{t.collectorName ?? "—"}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {t.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => updateTask.mutate({ id: t.id, status: "in_progress" })}>Start</Button>
                      )}
                      {t.status === "in_progress" && (
                        <Button size="sm" variant="outline" onClick={() => updateTask.mutate({ id: t.id, status: "resolved" })}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />Resolve
                        </Button>
                      )}
                      {(t.status === "pending" || t.status === "in_progress") && (
                        <Button size="sm" variant="outline" onClick={() => updateTask.mutate({ id: t.id, status: "escalated" })}>
                          <AlertTriangle className="h-3 w-3 mr-1" />Escalate
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedTask(t);
                        logCall.mutate({ taskId: t.id, customerId: t.customerId, ...callNote });
                      }}>
                        <Phone className="h-3 w-3 mr-1" />Log Call
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Task Detail Drawer */}
      {selectedTask && (
        <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Recovery Task — {selectedTask.customerName ?? `Customer #${selectedTask.customerId}`}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={statusColor[selectedTask.status] ?? "outline"}>{selectedTask.status.replace("_"," ")}</Badge></div>
                <div><span className="text-muted-foreground">Priority:</span> <Badge variant={priorityColor[selectedTask.priority] ?? "outline"}>{selectedTask.priority}</Badge></div>
                <div><span className="text-muted-foreground">Overdue:</span> {selectedTask.overdueAmount ? formatCurrency(selectedTask.overdueAmount) : "—"}</div>
                <div><span className="text-muted-foreground">Due Date:</span> {selectedTask.dueDate ?? "—"}</div>
                <div><span className="text-muted-foreground">Last Contact:</span> {selectedTask.lastContactDate ?? "—"}</div>
                <div><span className="text-muted-foreground">Next Follow-up:</span> {selectedTask.nextFollowUpDate ?? "—"}</div>
              </div>
              {selectedTask.notes && <div><span className="text-muted-foreground">Notes:</span> <p>{selectedTask.notes}</p></div>}

              <div className="border-t pt-4">
                <h3 className="font-medium mb-2">Log a Call</h3>
                <div className="space-y-2">
                  <Select value={callNote.outcome} onValueChange={v => setCallNote({ ...callNote, outcome: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="answered">Answered</SelectItem>
                      <SelectItem value="no_answer">No Answer</SelectItem>
                      <SelectItem value="callback_promised">Callback Promised</SelectItem>
                      <SelectItem value="payment_promised">Payment Promised</SelectItem>
                      <SelectItem value="dispute">Dispute</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea placeholder="Call notes..." value={callNote.notes} onChange={e => setCallNote({ ...callNote, notes: e.target.value })} />
                  <Input placeholder="Next action..." value={callNote.nextAction} onChange={e => setCallNote({ ...callNote, nextAction: e.target.value })} />
                  <Button className="w-full" onClick={() => logCall.mutate({ taskId: selectedTask.id, customerId: selectedTask.customerId, ...callNote })} disabled={logCall.isPending}>
                    <Phone className="h-4 w-4 mr-2" />{logCall.isPending ? "Logging..." : "Log Call"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

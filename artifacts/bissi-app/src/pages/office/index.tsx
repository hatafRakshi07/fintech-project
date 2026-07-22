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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, ClipboardList, MessageSquare, Heart, Plus, CheckCircle2, Clock, AlertCircle, TrendingDown, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OfficeSummary = { openComplaints: number; pendingTasks: number; inProgressTasks: number; todayDiaryEntries: number };
type DiaryEntry = { id: number; entryDate: string; title: string; content: string; category?: string; authorName?: string };
type OfficeTask = { id: number; title: string; description?: string; status: string; priority: string; dueDate?: string; assignedName?: string };
type Complaint = { id: number; title: string; description: string; category?: string; status: string; customerName?: string; createdAt: string };
type Donation = { id: number; donorName: string; amount: string; purpose?: string; donationDate: string; receiptNumber?: string; customerName?: string };

const taskStatusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  todo: "outline", in_progress: "default", done: "secondary", cancelled: "secondary",
};
const complaintStatusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "destructive", in_review: "default", resolved: "secondary", closed: "secondary",
};
const priorityColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "secondary", medium: "outline", high: "default",
};

const formatCurrency = (s: string) => {
  const n = parseFloat(s ?? "0");
  return isNaN(n) ? s : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
};

export default function OfficePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("diary");

  const { data: summary } = useQuery<OfficeSummary>({ queryKey: ["office", "summary"], queryFn: () => api.get("/office/summary") });
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Office Management</h1>
        <p className="text-muted-foreground">Daily diary, tasks, complaints, and donations</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Complaints</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{summary?.openComplaints ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.pendingTasks ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <ClipboardList className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.inProgressTasks ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Diary</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.todayDiaryEntries ?? 0}</div></CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="diary"><BookOpen className="h-4 w-4 mr-1" />Daily Diary</TabsTrigger>
          <TabsTrigger value="tasks"><ClipboardList className="h-4 w-4 mr-1" />Tasks</TabsTrigger>
          <TabsTrigger value="complaints"><MessageSquare className="h-4 w-4 mr-1" />Complaints</TabsTrigger>
          <TabsTrigger value="donations"><Heart className="h-4 w-4 mr-1" />Donations</TabsTrigger>
          <TabsTrigger value="expenses"><TrendingDown className="h-4 w-4 mr-1" />Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="diary" className="mt-4">
          <DiaryTab today={today} />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TasksTab />
        </TabsContent>
        <TabsContent value="complaints" className="mt-4">
          <ComplaintsTab />
        </TabsContent>
        <TabsContent value="donations" className="mt-4">
          <DonationsTab />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diary Tab
// ---------------------------------------------------------------------------
function DiaryTab({ today }: { today: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ entryDate: today, title: "", content: "", category: "general", branchId: "1" });

  const { data: entries = [], isLoading } = useQuery<DiaryEntry[]>({
    queryKey: ["office", "diary"],
    queryFn: () => api.get("/office/diary"),
  });

  const create = useMutation({
    mutationFn: (d: typeof form) => api.post("/office/diary", { ...d, branchId: parseInt(d.branchId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["office"] }); setIsOpen(false); setForm(f => ({ ...f, title: "", content: "" })); toast({ title: "Diary entry added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/office/diary/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["office"] }); toast({ title: "Entry deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Entry</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Diary Entry</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.entryDate} onChange={e => setForm({ ...form, entryDate: e.target.value })} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Title</Label>
                <Input placeholder="Entry title..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea rows={4} placeholder="Write your diary entry..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
              </div>
              <Button className="w-full" onClick={() => create.mutate(form)} disabled={create.isPending || !form.title || !form.content}>
                {create.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-3">
        {isLoading ? <div className="text-center py-8 text-muted-foreground">Loading entries...</div> :
          entries.length === 0 ? <div className="text-center py-8 text-muted-foreground">No diary entries yet.</div> :
          entries.map(e => (
            <Card key={e.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{e.title}</CardTitle>
                    {e.category && <Badge variant="outline" className="text-xs">{e.category}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{e.entryDate}</span>
                    {e.authorName && <span>by {e.authorName}</span>}
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={() => del.mutate(e.id)}>Delete</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{e.content}</p>
              </CardContent>
            </Card>
          ))
        }
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tasks Tab
// ---------------------------------------------------------------------------
function TasksTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", dueDate: "", branchId: "1" });

  const { data: tasks = [], isLoading } = useQuery<OfficeTask[]>({ queryKey: ["office", "tasks"], queryFn: () => api.get("/office/tasks") });

  const create = useMutation({
    mutationFn: (d: typeof form) => api.post("/office/tasks", { ...d, branchId: parseInt(d.branchId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["office"] }); setIsOpen(false); setForm(f => ({ ...f, title: "", description: "", dueDate: "" })); toast({ title: "Task created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.patch(`/office/tasks/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["office"] }); toast({ title: "Task updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Office Task</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Title</Label>
                <Input placeholder="Task title..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea placeholder="Optional description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>
              <Button className="w-full" onClick={() => create.mutate(form)} disabled={create.isPending || !form.title}>
                {create.isPending ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : tasks.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No tasks found.</TableCell></TableRow>
              ) : tasks.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.title}</div>
                    {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  </TableCell>
                  <TableCell><Badge variant={priorityColor[t.priority] ?? "outline"}>{t.priority}</Badge></TableCell>
                  <TableCell><Badge variant={taskStatusColor[t.status] ?? "outline"}>{t.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell>{t.dueDate ?? "—"}</TableCell>
                  <TableCell>{t.assignedName ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {t.status === "todo" && <Button size="sm" variant="outline" onClick={() => update.mutate({ id: t.id, status: "in_progress" })}>Start</Button>}
                      {t.status === "in_progress" && (
                        <Button size="sm" variant="outline" onClick={() => update.mutate({ id: t.id, status: "done" })}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />Done
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Complaints Tab
// ---------------------------------------------------------------------------
function ComplaintsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "other", branchId: "1" });

  const { data: complaints = [], isLoading } = useQuery<Complaint[]>({ queryKey: ["office", "complaints"], queryFn: () => api.get("/office/complaints") });

  const create = useMutation({
    mutationFn: (d: typeof form) => api.post("/office/complaints", { ...d, branchId: parseInt(d.branchId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["office"] }); setIsOpen(false); setForm(f => ({ ...f, title: "", description: "" })); toast({ title: "Complaint registered" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.patch(`/office/complaints/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["office"] }); toast({ title: "Status updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Register Complaint</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register Complaint</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Title</Label>
                <Input placeholder="Complaint title..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={4} placeholder="Describe the complaint..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <Button className="w-full" onClick={() => create.mutate(form)} disabled={create.isPending || !form.title || !form.description}>
                {create.isPending ? "Registering..." : "Register Complaint"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : complaints.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No complaints found.</TableCell></TableRow>
              ) : complaints.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell><Badge variant="outline">{c.category ?? "—"}</Badge></TableCell>
                  <TableCell>{c.customerName ?? "Walk-in"}</TableCell>
                  <TableCell><Badge variant={complaintStatusColor[c.status] ?? "outline"}>{c.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell>{new Date(c.createdAt).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {c.status === "open" && <Button size="sm" variant="outline" onClick={() => update.mutate({ id: c.id, status: "in_review" })}>Review</Button>}
                      {c.status === "in_review" && <Button size="sm" variant="outline" onClick={() => update.mutate({ id: c.id, status: "resolved" })}>Resolve</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donations Tab
// ---------------------------------------------------------------------------
function DonationsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ donorName: "", amount: "", purpose: "", donationDate: today, receiptNumber: "", notes: "", branchId: "1" });

  const { data: donations = [], isLoading } = useQuery<Donation[]>({ queryKey: ["office", "donations"], queryFn: () => api.get("/office/donations") });

  const create = useMutation({
    mutationFn: (d: typeof form) => api.post("/office/donations", { ...d, branchId: parseInt(d.branchId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["office"] }); setIsOpen(false); setForm(f => ({ ...f, donorName: "", amount: "", purpose: "", receiptNumber: "", notes: "" })); toast({ title: "Donation recorded" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Record Donation</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Donation</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Donor Name</Label>
                <Input placeholder="Donor name..." value={form.donorName} onChange={e => setForm({ ...form, donorName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Amount (₹)</Label>
                  <Input type="number" placeholder="1000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.donationDate} onChange={e => setForm({ ...form, donationDate: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Purpose</Label>
                <Input placeholder="Donation purpose..." value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
              </div>
              <div>
                <Label>Receipt Number</Label>
                <Input placeholder="Optional receipt number" value={form.receiptNumber} onChange={e => setForm({ ...form, receiptNumber: e.target.value })} />
              </div>
              <Button className="w-full" onClick={() => create.mutate(form)} disabled={create.isPending || !form.donorName || !form.amount}>
                {create.isPending ? "Saving..." : "Record Donation"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Donor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : donations.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No donations recorded.</TableCell></TableRow>
              ) : donations.map(d => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-medium">{d.donorName}</div>
                    {d.customerName && <div className="text-xs text-muted-foreground">{d.customerName}</div>}
                  </TableCell>
                  <TableCell className="text-green-600 font-medium">{formatCurrency(d.amount)}</TableCell>
                  <TableCell>{d.purpose ?? "—"}</TableCell>
                  <TableCell>{d.donationDate}</TableCell>
                  <TableCell>{d.receiptNumber ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expenses Tab
// ---------------------------------------------------------------------------
type OfficeExpense = {
  id: number;
  category: string;
  amount: string;
  expenseDate: string;
  description: string | null;
  branchId: number;
  createdAt: string;
};

function ExpensesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    categorySelect: "Office Rent",
    categoryCustom: "",
    amount: "",
    expenseDate: new Date().toISOString().split("T")[0],
    description: "",
    branchId: "1",
  });

  const { data: expenses = [], isLoading } = useQuery<OfficeExpense[]>({
    queryKey: ["office", "expenses"],
    queryFn: () => api.get("/office/expenses"),
  });

  const create = useMutation({
    mutationFn: (body: any) => api.post("/office/expenses", body),
    onSuccess: () => {
      toast({ title: "Expense Recorded", description: "Office expense saved successfully." });
      qc.invalidateQueries({ queryKey: ["office", "expenses"] });
      setIsDialogOpen(false);
      setForm({
        categorySelect: "Office Rent",
        categoryCustom: "",
        amount: "",
        expenseDate: new Date().toISOString().split("T")[0],
        description: "",
        branchId: "1",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/office/expenses/${id}`),
    onSuccess: () => {
      toast({ title: "Expense Deleted", description: "Expense removed successfully." });
      qc.invalidateQueries({ queryKey: ["office", "expenses"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const finalCategory = form.categorySelect === "Other" ? form.categoryCustom : form.categorySelect;
    if (!finalCategory || !form.amount || !form.expenseDate) {
      toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    create.mutate({
      category: finalCategory,
      amount: form.amount,
      expenseDate: form.expenseDate,
      description: form.description,
      branchId: parseInt(form.branchId, 10),
    });
  };

  // Compute summary metrics
  const totalRent = expenses
    .filter(e => e.category === "Office Rent")
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalElectricity = expenses
    .filter(e => e.category === "Electricity Bill")
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalOthers = expenses
    .filter(e => e.category !== "Office Rent" && e.category !== "Electricity Bill")
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const grandTotal = totalRent + totalElectricity + totalOthers;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Office Expense Register</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Record Expense</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Office Expense</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Category</Label>
                <Select
                  value={form.categorySelect}
                  onValueChange={v => setForm({ ...form, categorySelect: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Office Rent">Office Rent (Built-in)</SelectItem>
                    <SelectItem value="Electricity Bill">Electricity Bill (Built-in)</SelectItem>
                    <SelectItem value="Other">Other (Enter manually)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.categorySelect === "Other" && (
                <div>
                  <Label>Manual Expense Name / Bill Type</Label>
                  <Input
                    placeholder="e.g. Water Bill, Internet, Office Stationery"
                    value={form.categoryCustom}
                    onChange={e => setForm({ ...form, categoryCustom: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.expenseDate} onChange={e => setForm({ ...form, expenseDate: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Description / Note</Label>
                <Input
                  placeholder="Optional description notes..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <Button className="w-full" onClick={handleSave} disabled={create.isPending || !form.amount}>
                {create.isPending ? "Saving..." : "Save Expense"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expense summary KPI cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-muted/40">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Rent Expense</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold font-mono">{formatCurrency(totalRent.toString())}</div>
          </CardContent>
        </Card>
        <Card className="bg-muted/40">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Electricity Expense</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold font-mono">{formatCurrency(totalElectricity.toString())}</div>
          </CardContent>
        </Card>
        <Card className="bg-muted/40">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Other Expenses</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold font-mono">{formatCurrency(totalOthers.toString())}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border border-primary/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-primary font-medium">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold font-mono text-primary">{formatCurrency(grandTotal.toString())}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Expense Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : expenses.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No expenses recorded.</TableCell></TableRow>
              ) : expenses.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="pl-4 font-medium">{e.category}</TableCell>
                  <TableCell className="font-mono text-xs text-red-600">-{formatCurrency(e.amount)}</TableCell>
                  <TableCell>{e.expenseDate}</TableCell>
                  <TableCell className="italic text-muted-foreground">{e.description ?? "—"}</TableCell>
                  <TableCell className="text-right pr-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-8 w-8 hover:bg-destructive/10"
                      onClick={() => remove.mutate(e.id)}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

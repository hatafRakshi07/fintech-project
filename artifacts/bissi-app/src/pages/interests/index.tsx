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
import { TrendingUp, IndianRupee, AlertCircle, CheckCircle2, Plus, CreditCard, PiggyBank, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type InterestAccount = {
  id: number; customerId: number; principalAmount: string; interestRate: string;
  startDate: string; endDate?: string; status: string; totalInterestPaid: string;
  pendingInterest: string; notes?: string; customerName?: string; customerMobile?: string;
};
type InterestTransaction = {
  id: number; accountId: number; customerId: number; type: string; amount: string;
  month: number; year: number; paymentDate?: string; receiptNumber?: string;
  notes?: string; customerName?: string;
};
type InterestSummary = {
  activeAccounts: number; totalPrincipal: number; totalPendingInterest: number; totalInterestPaid: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const statusBadge: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default", closed: "secondary", paused: "outline",
};

export default function InterestsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("accounts");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<InterestAccount | null>(null);

  const today = new Date();
  const [newAccount, setNewAccount] = useState({ customerId: "", principalAmount: "", interestRate: "", startDate: today.toISOString().split("T")[0], branchId: "1", notes: "" });
  const [newTx, setNewTx] = useState({ accountId: "", customerId: "", type: "credit", amount: "", month: String(today.getMonth() + 1), year: String(today.getFullYear()), paymentDate: today.toISOString().split("T")[0], receiptNumber: "", branchId: "1" });

  const { data: summary } = useQuery<InterestSummary>({ queryKey: ["interests", "summary"], queryFn: () => api.get("/interests/summary") });
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<InterestAccount[]>({ queryKey: ["interests", "accounts"], queryFn: () => api.get("/interests/accounts") });
  const { data: transactions = [], isLoading: loadingTx } = useQuery<InterestTransaction[]>({ queryKey: ["interests", "transactions"], queryFn: () => api.get("/interests/transactions") });

  const createAccount = useMutation({
    mutationFn: (d: typeof newAccount) => api.post("/interests/accounts", { ...d, customerId: parseInt(d.customerId), principalAmount: d.principalAmount, interestRate: d.interestRate, branchId: parseInt(d.branchId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["interests"] }); setIsAddOpen(false); toast({ title: "Interest account created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createTx = useMutation({
    mutationFn: (d: typeof newTx) => api.post("/interests/transactions", { ...d, accountId: parseInt(d.accountId), customerId: parseInt(d.customerId), amount: d.amount, month: parseInt(d.month), year: parseInt(d.year), branchId: parseInt(d.branchId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["interests"] }); setIsPayOpen(false); toast({ title: "Interest payment recorded" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openPay = (account: InterestAccount) => {
    setSelectedAccount(account);
    setNewTx(prev => ({ ...prev, accountId: String(account.id), customerId: String(account.customerId) }));
    setIsPayOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interest Management</h1>
          <p className="text-muted-foreground">Track interest-bearing deposit accounts and payments</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Interest Account</Button>
          </DialogTrigger>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Active Accounts",
            value: summary?.activeAccounts ?? 0,
            icon: <PiggyBank className="h-5 w-5 text-indigo-500" />,
            bg: "bg-indigo-50 dark:bg-indigo-950/30",
            isCurrency: false,
          },
          {
            label: "Total Principal",
            value: summary?.totalPrincipal ?? 0,
            icon: <IndianRupee className="h-5 w-5 text-blue-500" />,
            bg: "bg-blue-50 dark:bg-blue-950/30",
            isCurrency: true,
          },
          {
            label: "Interest Paid",
            value: summary?.totalInterestPaid ?? 0,
            icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
            bg: "bg-green-50 dark:bg-green-950/30",
            isCurrency: true,
          },
          {
            label: "Interest Pending",
            value: summary?.totalPendingInterest ?? 0,
            icon: <Clock className="h-5 w-5 text-amber-500" />,
            bg: "bg-amber-50 dark:bg-amber-950/30",
            isCurrency: true,
          },
        ].map(({ label, value, icon, bg, isCurrency }) => (
          <Card key={label} className={`border-0 ${bg}`}>
            <CardHeader className="p-4 pb-2 flex flex-row items-center gap-2">
              {icon}
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-2xl font-bold">
                {isCurrency
                  ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value as number)
                  : value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

          <DialogContent>
            <DialogHeader><DialogTitle>Create Interest Account</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Customer ID</Label>
                <Input type="number" placeholder="Customer ID" value={newAccount.customerId} onChange={e => setNewAccount({ ...newAccount, customerId: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Principal Amount (₹)</Label>
                  <Input type="number" placeholder="50000" value={newAccount.principalAmount} onChange={e => setNewAccount({ ...newAccount, principalAmount: e.target.value })} />
                </div>
                <div>
                  <Label>Monthly Interest Rate (%)</Label>
                  <Input type="number" step="0.1" placeholder="2.0" value={newAccount.interestRate} onChange={e => setNewAccount({ ...newAccount, interestRate: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={newAccount.startDate} onChange={e => setNewAccount({ ...newAccount, startDate: e.target.value })} />
              </div>
              <div>
                <Label>Notes</Label>
                <Input placeholder="Optional notes" value={newAccount.notes} onChange={e => setNewAccount({ ...newAccount, notes: e.target.value })} />
              </div>
              <Button className="w-full" onClick={() => createAccount.mutate(newAccount)} disabled={createAccount.isPending || !newAccount.customerId || !newAccount.principalAmount}>
                {createAccount.isPending ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.activeAccounts ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Principal</CardTitle>
            <IndianRupee className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(summary?.totalPrincipal ?? 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Interest</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-600">{formatCurrency(summary?.totalPendingInterest ?? 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Interest Paid</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(summary?.totalInterestPaid ?? 0)}</div></CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="accounts">Interest Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Rate/Month</TableHead>
                    <TableHead>Monthly Interest</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingAccounts ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : accounts.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No interest accounts. Create your first account.</TableCell></TableRow>
                  ) : accounts.map(a => {
                    const principal = parseFloat(a.principalAmount);
                    const rate = parseFloat(a.interestRate);
                    const monthly = (principal * rate) / 100;
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium">{a.customerName ?? `Customer #${a.customerId}`}</div>
                          <div className="text-xs text-muted-foreground">{a.customerMobile}</div>
                        </TableCell>
                        <TableCell>{formatCurrency(principal)}</TableCell>
                        <TableCell>{rate}%</TableCell>
                        <TableCell className="text-blue-600 font-medium">{formatCurrency(monthly)}</TableCell>
                        <TableCell className="text-orange-600 font-medium">{formatCurrency(parseFloat(a.pendingInterest))}</TableCell>
                        <TableCell className="text-green-600">{formatCurrency(parseFloat(a.totalInterestPaid))}</TableCell>
                        <TableCell>{a.startDate}</TableCell>
                        <TableCell><Badge variant={statusBadge[a.status] ?? "outline"}>{a.status}</Badge></TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openPay(a)}>
                            <CreditCard className="h-3 w-3 mr-1" />Pay
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTx ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : transactions.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No transactions recorded.</TableCell></TableRow>
                  ) : transactions.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.customerName ?? `Customer #${t.customerId}`}</TableCell>
                      <TableCell>
                        <Badge variant={t.type === "credit" ? "default" : "outline"}>{t.type}</Badge>
                      </TableCell>
                      <TableCell className={t.type === "credit" ? "text-green-600 font-medium" : "text-muted-foreground"}>
                        {formatCurrency(parseFloat(t.amount))}
                      </TableCell>
                      <TableCell>{MONTHS[t.month - 1]}</TableCell>
                      <TableCell>{t.year}</TableCell>
                      <TableCell>{t.paymentDate ?? "—"}</TableCell>
                      <TableCell>{t.receiptNumber ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pay Interest Dialog */}
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Interest Payment</DialogTitle>
            {selectedAccount && (
              <p className="text-sm text-muted-foreground">
                {selectedAccount.customerName} — Principal: {formatCurrency(parseFloat(selectedAccount.principalAmount))} @ {selectedAccount.interestRate}%/month
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Month</Label>
                <Select value={newTx.month} onValueChange={v => setNewTx({ ...newTx, month: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input type="number" value={newTx.year} onChange={e => setNewTx({ ...newTx, year: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" placeholder="1000" value={newTx.amount} onChange={e => setNewTx({ ...newTx, amount: e.target.value })} />
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input type="date" value={newTx.paymentDate} onChange={e => setNewTx({ ...newTx, paymentDate: e.target.value })} />
            </div>
            <div>
              <Label>Receipt Number</Label>
              <Input placeholder="Optional receipt number" value={newTx.receiptNumber} onChange={e => setNewTx({ ...newTx, receiptNumber: e.target.value })} />
            </div>
            <Button className="w-full" onClick={() => createTx.mutate(newTx)} disabled={createTx.isPending || !newTx.amount}>
              {createTx.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Calendar,
  FileText,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Briefcase,
  Layers,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface LedgerAccount {
  id: number;
  name: string;
  groupName: string;
  openingBalance: string;
  openingBalanceType: "debit" | "credit";
  description: string | null;
  debits: number;
  credits: number;
  netBalance: number;
  balanceType: "debit" | "credit";
}

interface PostingInput {
  ledgerAccountId: string;
  amount: string;
  entryType: "debit" | "credit";
}

interface VoucherPosting {
  id: number;
  ledgerAccountId: number;
  ledgerName: string;
  ledgerGroup: string;
  amount: number;
  entryType: "debit" | "credit";
}

interface Voucher {
  id: number;
  voucherNumber: string;
  voucherType: string;
  date: string;
  narration: string | null;
  postings: VoucherPosting[];
}

interface LedgerStatementEntry {
  postingId: number;
  voucherId: number;
  voucherNumber: string;
  voucherType: string;
  date: string;
  narration: string | null;
  amount: number;
  entryType: "debit" | "credit";
  runningBalance: number;
  runningBalanceType: "debit" | "credit";
}

interface TrialBalanceRow {
  ledgerId: number;
  name: string;
  groupName: string;
  opDebit: number;
  opCredit: number;
  debits: number;
  credits: number;
  closingDebit: number;
  closingCredit: number;
}

interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totals: {
    opDebit: number;
    opCredit: number;
    debits: number;
    credits: number;
    closingDebit: number;
    closingCredit: number;
  };
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

export default function AccountingPage() {
  const [tab, setTab] = useState("dashboard");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog State
  const [isLedgerDialogOpen, setIsLedgerDialogOpen] = useState(false);
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  const [selectedLedgerId, setSelectedLedgerId] = useState<number | null>(null);

  // New Ledger Form
  const [newLedgerName, setNewLedgerName] = useState("");
  const [newLedgerGroup, setNewLedgerGroup] = useState("Indirect Expenses");
  const [newLedgerOpBal, setNewLedgerOpBal] = useState("0.00");
  const [newLedgerOpType, setNewLedgerOpType] = useState<"debit" | "credit">("debit");
  const [newLedgerDesc, setNewLedgerDesc] = useState("");

  // New Voucher Form
  const [vType, setVType] = useState<"Payment" | "Receipt" | "Contra" | "Journal">("Payment");
  const [vDate, setVDate] = useState(new Date().toISOString().split("T")[0]);
  const [vNarration, setVNarration] = useState("");
  const [vPostings, setVPostings] = useState<PostingInput[]>([
    { ledgerAccountId: "", amount: "", entryType: "debit" },
    { ledgerAccountId: "", amount: "", entryType: "credit" },
  ]);

  // Day Book Filter
  const [filterStartDate, setFilterStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split("T")[0]);

  // Expanded Vouchers in Day Book
  const [expandedVouchers, setExpandedVouchers] = useState<Record<number, boolean>>({});

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: ledgers = [], isLoading: ledgersLoading } = useQuery<LedgerAccount[]>({
    queryKey: ["accounting", "ledgers"],
    queryFn: () => customFetch("/accounting/ledgers"),
  });

  const { data: vouchers = [], isLoading: vouchersLoading } = useQuery<Voucher[]>({
    queryKey: ["accounting", "vouchers"],
    queryFn: () => customFetch("/accounting/vouchers"),
  });

  const { data: trialBalance, isLoading: tbLoading } = useQuery<TrialBalanceReport>({
    queryKey: ["accounting", "reports", "trial-balance"],
    queryFn: () => customFetch("/accounting/reports/trial-balance"),
  });

  const { data: plReport, isLoading: plLoading } = useQuery<{
    incomes: any[];
    expenses: any[];
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
  }>({
    queryKey: ["accounting", "reports", "profit-loss"],
    queryFn: () => customFetch("/accounting/reports/profit-loss"),
  });

  const { data: bsReport, isLoading: bsLoading } = useQuery<{
    assets: any[];
    liabilities: any[];
    totalAssets: number;
    totalLiabilities: number;
    netProfit: number;
  }>({
    queryKey: ["accounting", "reports", "balance-sheet"],
    queryFn: () => customFetch("/accounting/reports/balance-sheet"),
  });

  const { data: statementData, isLoading: statementLoading } = useQuery<{
    ledger: any;
    openingBalance: number;
    openingBalanceType: string;
    entries: LedgerStatementEntry[];
  }>({
    queryKey: ["accounting", "ledgers", selectedLedgerId, "statement"],
    queryFn: () => customFetch(`/accounting/ledgers/${selectedLedgerId}/statement`),
    enabled: selectedLedgerId !== null,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createLedgerMutation = useMutation({
    mutationFn: (body: any) =>
      customFetch("/accounting/ledgers", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast({ title: "Ledger Created", description: `Account created successfully.` });
      queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setIsLedgerDialogOpen(false);
      setNewLedgerName("");
      setNewLedgerOpBal("0.00");
      setNewLedgerDesc("");
    },
    onError: (err: any) => {
      toast({ title: "Error creating ledger", description: err.message, variant: "destructive" });
    },
  });

  const postVoucherMutation = useMutation({
    mutationFn: (body: any) =>
      customFetch("/accounting/vouchers", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data: any) => {
      toast({
        title: "Voucher Saved Successfully",
        description: `Voucher Number: ${data.voucherNumber}`,
      });
      queryClient.invalidateQueries({ queryKey: ["accounting"] });
      // Reset form
      setVNarration("");
      setVPostings([
        { ledgerAccountId: "", amount: "", entryType: "debit" },
        { ledgerAccountId: "", amount: "", entryType: "credit" },
      ]);
    },
    onError: (err: any) => {
      toast({ title: "Failed to Post Voucher", description: err.message, variant: "destructive" });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreateLedger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLedgerName) return;
    createLedgerMutation.mutate({
      name: newLedgerName,
      groupName: newLedgerGroup,
      openingBalance: newLedgerOpBal,
      openingBalanceType: newLedgerOpType,
      description: newLedgerDesc,
    });
  };

  const handleAddPostingRow = () => {
    setVPostings([...vPostings, { ledgerAccountId: "", amount: "", entryType: "debit" }]);
  };

  const handleRemovePostingRow = (index: number) => {
    if (vPostings.length <= 2) return;
    const next = [...vPostings];
    next.splice(index, 1);
    setVPostings(next);
  };

  const handlePostingChange = (index: number, field: keyof PostingInput, value: string) => {
    const next = [...vPostings];
    next[index] = { ...next[index], [field]: value };
    setVPostings(next);
  };

  const handleSaveVoucher = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    const invalid = vPostings.some((p) => !p.ledgerAccountId || !p.amount || parseFloat(p.amount) <= 0);
    if (invalid) {
      toast({
        title: "Validation Error",
        description: "Please select ledger accounts and provide valid amounts for all entry lines.",
        variant: "destructive",
      });
      return;
    }

    // Double entry validation
    let debits = 0;
    let credits = 0;
    const parsedPostings = vPostings.map((p) => {
      const amt = parseFloat(p.amount);
      if (p.entryType === "debit") debits += amt;
      else credits += amt;

      return {
        ledgerAccountId: parseInt(p.ledgerAccountId, 10),
        amount: amt,
        entryType: p.entryType,
      };
    });

    if (Math.abs(debits - credits) > 0.01) {
      toast({
        title: "Unbalanced Voucher",
        description: `Total Debits (₹${debits.toFixed(2)}) must equal Total Credits (₹${credits.toFixed(2)})`,
        variant: "destructive",
      });
      return;
    }

    postVoucherMutation.mutate({
      voucherType: vType,
      date: new Date(vDate).toISOString(),
      narration: vNarration,
      postings: parsedPostings,
    });
  };

  const handleOpenStatement = (ledgerId: number) => {
    setSelectedLedgerId(ledgerId);
    setIsStatementDialogOpen(true);
  };

  const toggleVoucherExpanded = (id: number) => {
    setExpandedVouchers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter vouchers for Day Book
  const filteredVouchers = vouchers.filter((v) => {
    const vDateStr = v.date.substring(0, 10);
    return vDateStr >= filterStartDate && vDateStr <= filterEndDate;
  });

  // Calculate sum of debits/credits in voucher form
  const voucherDebitsSum = vPostings.reduce((sum, p) => (p.entryType === "debit" ? sum + (parseFloat(p.amount) || 0) : sum), 0);
  const voucherCreditsSum = vPostings.reduce((sum, p) => (p.entryType === "credit" ? sum + (parseFloat(p.amount) || 0) : sum), 0);

  // Group ledger accounts for display
  const cashAccounts = ledgers.filter((l) => l.groupName === "Cash-in-hand");
  const bankAccounts = ledgers.filter((l) => l.groupName === "Bank Accounts");
  const indirectExpenses = ledgers.filter((l) => l.groupName === "Indirect Expenses");
  const indirectIncomes = ledgers.filter((l) => l.groupName === "Indirect Incomes");

  const cashTotal = cashAccounts.reduce((sum, l) => sum + (l.balanceType === "debit" ? l.netBalance : -l.netBalance), 0);
  const bankTotal = bankAccounts.reduce((sum, l) => sum + (l.balanceType === "debit" ? l.netBalance : -l.netBalance), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting & Ledgers</h1>
          <p className="text-muted-foreground">Tally-style double-entry bookkeeping and accounting reports.</p>
        </div>
        <Button onClick={() => setIsLedgerDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Create Ledger
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 md:grid-cols-7 gap-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="ledgers">Ledgers</TabsTrigger>
          <TabsTrigger value="voucher">Voucher Entry</TabsTrigger>
          <TabsTrigger value="daybook">Day Book</TabsTrigger>
          <TabsTrigger value="trialbalance">Trial Balance</TabsTrigger>
          <TabsTrigger value="profitloss">Profit & Loss</TabsTrigger>
          <TabsTrigger value="balancesheet">Balance Sheet</TabsTrigger>
        </TabsList>

        {/* ─── DASHBOARD TAB ─── */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" /> Cash in Hand
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold">{formatCurrency(cashTotal)}</div>
                <p className="text-[10px] text-muted-foreground">Combined cash account balances</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-blue-500" /> Bank Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold">{formatCurrency(bankTotal)}</div>
                <p className="text-[10px] text-muted-foreground">Balances in bank ledger accounts</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> Total Incomes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-xl font-bold">{formatCurrency(plReport?.totalIncome ?? 0)}</div>
                <p className="text-[10px] text-muted-foreground">Cumulative revenues this period</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" /> Net Profit / Loss
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className={`text-xl font-bold ${(plReport?.netProfit ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {formatCurrency(plReport?.netProfit ?? 0)}
                </div>
                <p className="text-[10px] text-muted-foreground">Net earnings after expenses</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Quick Financial Standing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Assets value</span>
                  <span className="font-semibold text-primary">{formatCurrency(bsReport?.totalAssets ?? 0)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Liabilities & Equity</span>
                  <span className="font-semibold">{formatCurrency(bsReport?.totalLiabilities ?? 0)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Trial Balance Discrepancy</span>
                  <span className="font-semibold text-amber-600">
                    {formatCurrency(
                      Math.abs((trialBalance?.totals.closingDebit ?? 0) - (trialBalance?.totals.closingCredit ?? 0))
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Tally Operations Quick Access</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Button onClick={() => setTab("voucher")} variant="outline" className="justify-start gap-3 w-full">
                  <ArrowRightLeft className="h-4 w-4 text-primary" /> Post Voucher Entry
                </Button>
                <Button onClick={() => setTab("daybook")} variant="outline" className="justify-start gap-3 w-full">
                  <BookOpen className="h-4 w-4 text-blue-500" /> View Chronological Day Book
                </Button>
                <Button onClick={() => setTab("trialbalance")} variant="outline" className="justify-start gap-3 w-full">
                  <Layers className="h-4 w-4 text-emerald-500" /> Inspect Balanced Trial Sheet
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── LEDGERS TAB ─── */}
        <TabsContent value="ledgers" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Ledger Accounts</CardTitle>
              <Badge variant="secondary">{ledgers.length} Ledgers Active</Badge>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {ledgersLoading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">Loading ledgers...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Account Ledger Name</TableHead>
                      <TableHead>Group Type</TableHead>
                      <TableHead className="text-right">Opening Bal</TableHead>
                      <TableHead className="text-right">Total Debit postings</TableHead>
                      <TableHead className="text-right">Total Credit postings</TableHead>
                      <TableHead className="text-right pr-6">Current Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgers.map((l) => (
                      <TableRow key={l.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleOpenStatement(l.id)}>
                        <TableCell className="pl-6 font-semibold text-primary hover:underline">{l.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{l.groupName}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatCurrency(parseFloat(l.openingBalance))}
                          <span className="text-[10px] text-muted-foreground ml-1">({l.openingBalanceType})</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600">
                          {formatCurrency(l.debits)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-amber-600">
                          {formatCurrency(l.credits)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold pr-6">
                          {formatCurrency(l.netBalance)}
                          <span className="text-[10px] text-muted-foreground ml-1">({l.balanceType})</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── VOUCHER ENTRY TAB ─── */}
        <TabsContent value="voucher" className="mt-4">
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" /> Create Double Entry Voucher
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveVoucher} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Voucher Type</Label>
                    <Select value={vType} onValueChange={(v: any) => setVType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Payment">Payment Voucher (F5)</SelectItem>
                        <SelectItem value="Receipt">Receipt Voucher (F6)</SelectItem>
                        <SelectItem value="Contra">Contra Voucher (F4)</SelectItem>
                        <SelectItem value="Journal">Journal Voucher (F7)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Voucher Date</Label>
                    <Input type="date" value={vDate} onChange={(e) => setVDate(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Ledger Postings</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddPostingRow}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Line Item
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {vPostings.map((p, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row items-stretch md:items-end gap-3 p-3 bg-muted/40 rounded-lg border border-border">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs text-muted-foreground">Ledger Account</Label>
                          <Select
                            value={p.ledgerAccountId}
                            onValueChange={(val) => handlePostingChange(idx, "ledgerAccountId", val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Ledger Account..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ledgers.map((l) => (
                                <SelectItem key={l.id} value={l.id.toString()}>
                                  {l.name} ({l.groupName}) - Bal: {formatCurrency(l.netBalance)} ({l.balanceType})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="w-full md:w-32 space-y-1">
                          <Label className="text-xs text-muted-foreground">Dr / Cr</Label>
                          <Select
                            value={p.entryType}
                            onValueChange={(val) => handlePostingChange(idx, "entryType", val as any)}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="debit">Debit (Dr)</SelectItem>
                              <SelectItem value="credit">Credit (Cr)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="w-full md:w-44 space-y-1">
                          <Label className="text-xs text-muted-foreground">Amount (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={p.amount}
                            onChange={(e) => handlePostingChange(idx, "amount", e.target.value)}
                          />
                        </div>

                        {vPostings.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-9 w-9"
                            onClick={() => handleRemovePostingRow(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Balance validation indicator */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-muted/60 p-4 rounded-lg border border-border">
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Debits: </span>
                      <span className="font-semibold font-mono text-emerald-600">{formatCurrency(voucherDebitsSum)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Credits: </span>
                      <span className="font-semibold font-mono text-amber-600">{formatCurrency(voucherCreditsSum)}</span>
                    </div>
                  </div>
                  <div>
                    {Math.abs(voucherDebitsSum - voucherCreditsSum) <= 0.01 && voucherDebitsSum > 0 ? (
                      <Badge className="bg-emerald-600">✓ Balanced Double Entry</Badge>
                    ) : (
                      <Badge variant="destructive">
                        Difference: {formatCurrency(Math.abs(voucherDebitsSum - voucherCreditsSum))}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Narration (Voucher Notes)</Label>
                  <Input
                    placeholder="Enter narration notes explaining this transaction..."
                    value={vNarration}
                    onChange={(e) => setVNarration(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={postVoucherMutation.isPending || Math.abs(voucherDebitsSum - voucherCreditsSum) > 0.01 || voucherDebitsSum <= 0}
                  className="w-full"
                >
                  {postVoucherMutation.isPending ? "Posting Voucher..." : "Save and Post Voucher (Dr = Cr)"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── DAY BOOK TAB ─── */}
        <TabsContent value="daybook" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">Day Book Vouchers</CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">From</span>
                  <Input type="date" className="w-36 h-8 text-xs" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">To</span>
                  <Input type="date" className="w-36 h-8 text-xs" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {vouchersLoading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">Loading Day Book...</div>
              ) : filteredVouchers.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">No voucher transactions recorded in this period.</div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredVouchers.map((v) => {
                    const isExpanded = !!expandedVouchers[v.id];
                    const drPostings = v.postings.filter((p) => p.entryType === "debit");
                    const crPostings = v.postings.filter((p) => p.entryType === "credit");
                    const amount = drPostings.reduce((sum, p) => sum + p.amount, 0);

                    return (
                      <div key={v.id} className="p-4 hover:bg-muted/30">
                        <div
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
                          onClick={() => toggleVoucherExpanded(v.id)}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase font-bold">
                                {v.voucherType}
                              </Badge>
                              <span className="font-semibold text-sm">{v.voucherNumber}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(v.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-mono text-sm font-bold">{formatCurrency(amount)}</div>
                              <div className="text-[10px] text-muted-foreground">Total debited</div>
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 pt-3 border-t border-dashed border-border space-y-3">
                            {/* Detailed posting entries */}
                            <div className="bg-muted/40 rounded-md border border-border overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-4 h-8 text-[11px]">Ledger Account</TableHead>
                                    <TableHead className="h-8 text-[11px]">Dr/Cr</TableHead>
                                    <TableHead className="text-right pr-4 h-8 text-[11px]">Amount</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {v.postings.map((p) => (
                                    <TableRow key={p.id} className="hover:bg-transparent">
                                      <TableCell className="pl-4 py-2 font-medium text-xs text-primary">{p.ledgerName}</TableCell>
                                      <TableCell className="py-2 text-xs uppercase font-semibold text-muted-foreground">
                                        {p.entryType === "debit" ? "Debit (Dr)" : "Credit (Cr)"}
                                      </TableCell>
                                      <TableCell className="text-right pr-4 py-2 font-mono text-xs">
                                        {formatCurrency(p.amount)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            {v.narration && (
                              <div className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded border border-border border-dashed">
                                <strong>Narration:</strong> {v.narration}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TRIAL BALANCE TAB ─── */}
        <TabsContent value="trialbalance" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Trial Balance Sheet</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {tbLoading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">Loading Trial Balance...</div>
              ) : trialBalance && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Ledger Account Name</TableHead>
                      <TableHead>Group Category</TableHead>
                      <TableHead className="text-right">Opening Debit</TableHead>
                      <TableHead className="text-right">Opening Credit</TableHead>
                      <TableHead className="text-right">Debit Postings</TableHead>
                      <TableHead className="text-right">Credit Postings</TableHead>
                      <TableHead className="text-right">Closing Debit</TableHead>
                      <TableHead className="text-right pr-6">Closing Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalance.rows.map((row) => (
                      <TableRow key={row.ledgerId}>
                        <TableCell className="pl-6 font-semibold">{row.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{row.groupName}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{row.opDebit > 0 ? formatCurrency(row.opDebit) : ""}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{row.opCredit > 0 ? formatCurrency(row.opCredit) : ""}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600">{row.debits > 0 ? formatCurrency(row.debits) : ""}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-amber-600">{row.credits > 0 ? formatCurrency(row.credits) : ""}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">{row.closingDebit > 0 ? formatCurrency(row.closingDebit) : ""}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold pr-6">{row.closingCredit > 0 ? formatCurrency(row.closingCredit) : ""}</TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/70 font-bold hover:bg-muted/70">
                      <TableCell className="pl-6 font-bold" colSpan={2}>Grand Total</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(trialBalance.totals.opDebit)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(trialBalance.totals.opCredit)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">{formatCurrency(trialBalance.totals.debits)}</TableCell>
                      <TableCell className="text-right font-mono text-amber-600">{formatCurrency(trialBalance.totals.credits)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(trialBalance.totals.closingDebit)}</TableCell>
                      <TableCell className="text-right font-mono pr-6">{formatCurrency(trialBalance.totals.closingCredit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── PROFIT & LOSS TAB ─── */}
        <TabsContent value="profitloss" className="mt-4">
          {plLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading Profit & Loss...</div>
          ) : plReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Income Panel */}
              <Card>
                <CardHeader className="pb-3 border-b border-border bg-emerald-500/5">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" /> Incomes / Revenue
                    </CardTitle>
                    <Badge variant="outline" className="border-emerald-600/30 text-emerald-600 font-bold font-mono">
                      {formatCurrency(plReport.totalIncome)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {plReport.incomes.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-xs">No income accounts registered.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-6 h-8 text-[11px]">Ledger Account</TableHead>
                          <TableHead className="h-8 text-[11px]">Category Group</TableHead>
                          <TableHead className="text-right pr-6 h-8 text-[11px]">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plReport.incomes.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="pl-6 font-medium text-xs">{item.name}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{item.groupName}</TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold pr-6">{formatCurrency(item.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Expense Panel */}
              <Card>
                <CardHeader className="pb-3 border-b border-border bg-red-500/5">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500" /> Expenses / Cost
                    </CardTitle>
                    <Badge variant="outline" className="border-red-600/30 text-red-600 font-bold font-mono">
                      {formatCurrency(plReport.totalExpense)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {plReport.expenses.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-xs">No expense accounts registered.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-6 h-8 text-[11px]">Ledger Account</TableHead>
                          <TableHead className="h-8 text-[11px]">Category Group</TableHead>
                          <TableHead className="text-right pr-6 h-8 text-[11px]">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plReport.expenses.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="pl-6 font-medium text-xs">{item.name}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{item.groupName}</TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold pr-6">{formatCurrency(item.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Net Result Card */}
              <Card className="md:col-span-2 border-l-4 border-l-primary">
                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold">Statement of Profit & Loss Result</h3>
                    <p className="text-xs text-muted-foreground">Computed using revenue minus indirect expenditures.</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${plReport.netProfit >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {plReport.netProfit >= 0 ? "Net Profit:" : "Net Loss:"} {formatCurrency(plReport.netProfit)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ─── BALANCE SHEET TAB ─── */}
        <TabsContent value="balancesheet" className="mt-4">
          {bsLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading Balance Sheet...</div>
          ) : bsReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Liabilities Panel */}
              <Card>
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-bold">Capital & Liabilities</CardTitle>
                    <Badge variant="outline" className="font-bold font-mono">
                      {formatCurrency(bsReport.totalLiabilities)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6 h-8 text-[11px]">Source of Fund / Account</TableHead>
                        <TableHead className="h-8 text-[11px]">Group</TableHead>
                        <TableHead className="text-right pr-6 h-8 text-[11px]">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bsReport.liabilities.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="pl-6 font-medium text-xs">{item.name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{item.groupName}</TableCell>
                          <TableCell className={`text-right font-mono text-xs font-semibold pr-6 ${item.id === -1 && item.balance < 0 ? "text-red-500" : ""}`}>
                            {formatCurrency(item.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Assets Panel */}
              <Card>
                <CardHeader className="pb-3 border-b border-border bg-primary/5">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-bold text-primary">Assets & Resources</CardTitle>
                    <Badge variant="outline" className="font-bold font-mono border-primary/30 text-primary">
                      {formatCurrency(bsReport.totalAssets)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6 h-8 text-[11px]">Application of Fund / Account</TableHead>
                        <TableHead className="h-8 text-[11px]">Group</TableHead>
                        <TableHead className="text-right pr-6 h-8 text-[11px]">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bsReport.assets.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="pl-6 font-medium text-xs text-primary">{item.name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{item.groupName}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold pr-6">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Validation Check */}
              <Card className="md:col-span-2 border-l-4 border-l-emerald-600 bg-emerald-500/5">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold">Balance Sheet Check</h3>
                    <p className="text-xs text-muted-foreground">Assets must equal Capital & Liabilities (Double-entry compliance)</p>
                  </div>
                  <div>
                    {Math.abs(bsReport.totalAssets - bsReport.totalLiabilities) <= 0.01 ? (
                      <Badge className="bg-emerald-600 px-3 py-1 text-xs">✓ Perfectly Balanced</Badge>
                    ) : (
                      <Badge variant="destructive" className="px-3 py-1 text-xs">
                        Discrepancy: {formatCurrency(Math.abs(bsReport.totalAssets - bsReport.totalLiabilities))}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── CREATE LEDGER DIALOG ─── */}
      <Dialog open={isLedgerDialogOpen} onOpenChange={setIsLedgerDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Account Ledger</DialogTitle>
            <DialogDescription>Define a ledger account under standard Tally groups.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateLedger} className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label>Ledger Name</Label>
              <Input
                placeholder="e.g. Office Rent A/c, HDFC Bank Account"
                value={newLedgerName}
                onChange={(e) => setNewLedgerName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Group Class</Label>
              <Select value={newLedgerGroup} onValueChange={setNewLedgerGroup}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash-in-hand">Cash-in-hand</SelectItem>
                  <SelectItem value="Bank Accounts">Bank Accounts</SelectItem>
                  <SelectItem value="Indirect Expenses">Indirect Expenses</SelectItem>
                  <SelectItem value="Indirect Incomes">Indirect Incomes</SelectItem>
                  <SelectItem value="Capital Account">Capital Account</SelectItem>
                  <SelectItem value="Loans & Liabilities">Loans & Liabilities</SelectItem>
                  <SelectItem value="Sundry Debtors">Sundry Debtors</SelectItem>
                  <SelectItem value="Sundry Creditors">Sundry Creditors</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Opening Balance (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newLedgerOpBal}
                  onChange={(e) => setNewLedgerOpBal(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Balance Type</Label>
                <Select
                  value={newLedgerOpType}
                  onValueChange={(val: any) => setNewLedgerOpType(val)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit (Dr)</SelectItem>
                    <SelectItem value="credit">Credit (Cr)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                placeholder="Optional notes..."
                value={newLedgerDesc}
                onChange={(e) => setNewLedgerDesc(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsLedgerDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createLedgerMutation.isPending}>
                {createLedgerMutation.isPending ? "Creating..." : "Create Ledger"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── LEDGER STATEMENT DIALOG ─── */}
      <Dialog open={isStatementDialogOpen} onOpenChange={setIsStatementDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>Account Statement: {statementData?.ledger?.name}</span>
              <Badge variant="outline">{statementData?.ledger?.groupName}</Badge>
            </DialogTitle>
            <DialogDescription>List of transactions and running balance summary.</DialogDescription>
          </DialogHeader>

          {statementLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading statement...</div>
          ) : statementData && (
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center text-xs bg-muted/40 p-3 rounded-lg border border-border border-dashed font-mono">
                <div>
                  <strong>Opening Balance:</strong> {formatCurrency(statementData.openingBalance)} ({statementData.openingBalanceType})
                </div>
                <div>
                  <strong>Current Balance:</strong> {formatCurrency(statementData.ledger?.netBalance || 0)} ({statementData.ledger?.balanceType})
                </div>
              </div>

              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 h-9 text-xs">Date</TableHead>
                      <TableHead className="h-9 text-xs">Voucher No.</TableHead>
                      <TableHead className="h-9 text-xs">Type</TableHead>
                      <TableHead className="h-9 text-xs">Narration / Description</TableHead>
                      <TableHead className="text-right h-9 text-xs">Debit (Dr)</TableHead>
                      <TableHead className="text-right h-9 text-xs">Credit (Cr)</TableHead>
                      <TableHead className="text-right pr-4 h-9 text-xs">Running Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statementData.entries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                          No transactions recorded in this ledger account.
                        </TableCell>
                      </TableRow>
                    ) : (
                      statementData.entries.map((entry) => (
                        <TableRow key={entry.postingId} className="text-xs">
                          <TableCell className="pl-4 py-2 font-medium">
                            {new Date(entry.date).toLocaleDateString("en-IN", { dateStyle: "short" })}
                          </TableCell>
                          <TableCell className="py-2 font-semibold text-primary">{entry.voucherNumber}</TableCell>
                          <TableCell className="py-2 uppercase font-bold text-[10px] text-muted-foreground">
                            {entry.voucherType}
                          </TableCell>
                          <TableCell className="py-2 italic max-w-xs truncate">{entry.narration || "-"}</TableCell>
                          <TableCell className="text-right py-2 font-mono text-emerald-600 font-semibold">
                            {entry.entryType === "debit" ? formatCurrency(entry.amount) : ""}
                          </TableCell>
                          <TableCell className="text-right py-2 font-mono text-amber-600 font-semibold">
                            {entry.entryType === "credit" ? formatCurrency(entry.amount) : ""}
                          </TableCell>
                          <TableCell className="text-right pr-4 py-2 font-mono font-bold">
                            {formatCurrency(entry.runningBalance)}
                            <span className="text-[9px] text-muted-foreground font-normal ml-1">({entry.runningBalanceType})</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetCustomer, 
  useGetCustomerPassbook, 
  useGetCustomerHistory 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  User, 
  Phone, 
  MapPin, 
  CreditCard, 
  Briefcase, 
  Wallet,
  Sparkles,
  Gift,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Search,
  Users,
  Banknote,
  TrendingUp,
  Calendar
} from "lucide-react";
import { format } from "date-fns";

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = parseInt(params.id || "0");
  const [collectionFilter, setCollectionFilter] = useState("");

  const { data: customer, isLoading: customerLoading } = useGetCustomer(customerId);
  const { data: passbook } = useGetCustomerPassbook(customerId);
  const { data: history, isLoading: historyLoading } = useGetCustomerHistory(customerId);

  if (customerLoading) return <div className="p-8">Loading customer details...</div>;
  if (!customer) return <div className="p-8">Customer not found</div>;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const summary = (history as any)?.summary;
  const memberships = (history as any)?.memberships || [];
  const tokens = (history as any)?.tokens || [];
  const collections = (history as any)?.collections || [];
  const loans = (history as any)?.loans || [];
  const gifts = (history as any)?.gifts || [];
  const interestAccounts = (history as any)?.interestAccounts || [];
  const recoveryTasks = (history as any)?.recoveryTasks || [];

  // Filter collections by search
  const filteredCollections = collections.filter((c: any) => {
    if (!collectionFilter) return true;
    const q = collectionFilter.toLowerCase();
    return (c.notes?.toLowerCase().includes(q)) || 
           (c.date?.includes(q)) ||
           (String(c.amount).includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center shrink-0">
            {customer.photoUrl ? (
              <img src={customer.photoUrl} alt={customer.name} className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
              <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                {customer.status}
              </Badge>
            </div>
            <p className="text-muted-foreground font-mono text-sm">{customer.referenceNumber}</p>
          </div>
        </div>
      </div>

      {/* Personal Details + Summary Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Personal Details - Left column */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{customer.mobile}</span>
            </div>
            {customer.alternateMobile && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground/60" />
                <span>Alt: {customer.alternateMobile}</span>
              </div>
            )}
            {(customer.address || customer.city) && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{[customer.address, customer.city].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {customer.referenceName && (
              <div className="flex items-center gap-3 text-sm">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span>Ref: {customer.referenceName}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span>Branch: {customer.branchName}</span>
            </div>
            {customer.recoveryNotes && (
              <div className="mt-2 p-2 rounded-lg bg-orange-50 border border-orange-200">
                <p className="text-xs text-orange-700">{customer.recoveryNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats - 3 columns of cards */}
        <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-emerald-500" />
                <p className="text-xs text-muted-foreground">Total Paid</p>
              </div>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary?.totalPaid || 0)}</p>
              <p className="text-[10px] text-muted-foreground">{summary?.totalCollections || 0} transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-muted-foreground">Committees</p>
              </div>
              <p className="text-xl font-bold text-blue-600">{summary?.committeesJoined || 0}</p>
              <p className="text-[10px] text-muted-foreground">{summary?.totalTokens || 0} tokens</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Gift className="h-4 w-4 text-amber-500" />
                <p className="text-xs text-muted-foreground">Gifts</p>
              </div>
              <p className="text-xl font-bold text-amber-600">{summary?.totalGifts || 0}</p>
              <p className="text-[10px] text-muted-foreground">received</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="h-4 w-4 text-purple-500" />
                <p className="text-xs text-muted-foreground">Loans</p>
              </div>
              <p className="text-xl font-bold text-purple-600">{summary?.totalLoans || 0}</p>
              <p className="text-[10px] text-muted-foreground">{formatCurrency(summary?.totalLoanAmount || 0)}</p>
            </CardContent>
          </Card>
          {interestAccounts.length > 0 && (
            <Card className="col-span-2">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-rose-500" />
                  <p className="text-xs text-muted-foreground">Byaj (Interest) Account</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-lg font-bold text-rose-600">{formatCurrency(interestAccounts[0].monthlyInterest)}/mo</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Principal</p>
                    <p className="text-sm font-semibold">{formatCurrency(interestAccounts[0].principalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rate</p>
                    <p className="text-sm font-semibold">{interestAccounts[0].interestRate}%/mo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {recoveryTasks.filter((r: any) => r.status === "pending").length > 0 && (
            <Card className="col-span-2 border-red-200">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm font-semibold">{recoveryTasks.filter((r: any) => r.status === "pending").length} Pending Recovery Tasks</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="committees" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="committees">
            <Users className="h-3.5 w-3.5 mr-1.5" />Committees ({memberships.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            <Wallet className="h-3.5 w-3.5 mr-1.5" />Payments ({collections.length})
          </TabsTrigger>
          <TabsTrigger value="loans">
            <Banknote className="h-3.5 w-3.5 mr-1.5" />Loans ({loans.length})
          </TabsTrigger>
          <TabsTrigger value="gifts">
            <Gift className="h-3.5 w-3.5 mr-1.5" />Gifts ({gifts.length})
          </TabsTrigger>
          <TabsTrigger value="interest">
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />Interest ({interestAccounts.length})
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-3.5 w-3.5 mr-1.5" />Documents
          </TabsTrigger>
        </TabsList>

        {/* ─── COMMITTEES TAB ────────────────────────────── */}
        <TabsContent value="committees" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Committee Memberships & Tokens</CardTitle></CardHeader>
            <CardContent>
              {!memberships.length ? (
                <p className="text-sm text-muted-foreground py-4">Not a member of any committee.</p>
              ) : (
                <div className="space-y-3">
                  {memberships.map((m: any) => (
                    <div key={m.committeeId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-semibold text-sm">{m.committeeName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{m.type} · ₹{m.installment?.toLocaleString("en-IN")}/month</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {m.tokens.sort((a: string, b: string) => parseInt(a)-parseInt(b)).map((t: string) => (
                          <span key={t} className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">{t}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── PAYMENTS TAB ──────────────────────────────── */}
        <TabsContent value="payments" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search payments by date, amount, notes..." 
                value={collectionFilter}
                onChange={(e) => setCollectionFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="secondary">{filteredCollections.length} records</Badge>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Mode</th>
                      <th className="text-left p-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCollections.slice(0, 100).map((c: any) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="p-3 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {c.date ? format(new Date(c.date), 'dd MMM yyyy') : '—'}
                          </div>
                        </td>
                        <td className="p-3 text-right font-semibold text-emerald-600 whitespace-nowrap">
                          ₹{c.amount.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] uppercase">{c.paymentMode}</Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{c.notes || '—'}</td>
                      </tr>
                    ))}
                    {!filteredCollections.length && (
                      <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No payment records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── LOANS TAB ─────────────────────────────────── */}
        <TabsContent value="loans" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Loan History</CardTitle></CardHeader>
            <CardContent>
              {!loans.length ? (
                <p className="text-sm text-muted-foreground py-4">No loan records.</p>
              ) : (
                <div className="space-y-3">
                  {loans.map((l: any) => (
                    <div key={l.id} className="p-4 rounded-lg border bg-muted/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Banknote className="h-4 w-4 text-purple-500" />
                          <span className="font-bold text-lg">{formatCurrency(l.principalAmount)}</span>
                        </div>
                        <Badge variant={l.status === 'active' ? 'default' : l.status === 'closed' ? 'secondary' : 'destructive'}>
                          {l.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">Interest Rate</p>
                          <p className="font-semibold">{l.interestRate}% ({l.interestType})</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Tenure</p>
                          <p className="font-semibold">{l.tenure} months</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Paid</p>
                          <p className="font-semibold text-emerald-600">{formatCurrency(l.paidAmount)}</p>
                        </div>
                        {l.purpose && (
                          <div>
                            <p className="text-muted-foreground">Purpose</p>
                            <p className="font-semibold">{l.purpose}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── GIFTS TAB ─────────────────────────────────── */}
        <TabsContent value="gifts" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Gift className="h-4 w-4" /> Gift History</CardTitle></CardHeader>
            <CardContent>
              {!gifts.length ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No gifts recorded yet.</div>
              ) : (
                <div className="space-y-2">
                  {gifts.map((g: any) => (
                    <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎁</span>
                        <div>
                          <p className="text-sm font-medium">{g.giftName}</p>
                          <p className="text-xs text-muted-foreground">
                            Qty: {g.quantity} · {g.date ? format(new Date(g.date), 'dd MMM yyyy') : '—'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={g.status === "given" ? "default" : "secondary"}>{g.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── INTEREST TAB ──────────────────────────────── */}
        <TabsContent value="interest" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> Interest (Byaj) Accounts</CardTitle></CardHeader>
            <CardContent>
              {!interestAccounts.length ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No interest accounts.</div>
              ) : (
                <div className="space-y-4">
                  {interestAccounts.map((acc: any) => (
                    <div key={acc.id} className="p-4 rounded-lg border bg-amber-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Monthly Interest</p>
                          <p className="text-2xl font-bold text-amber-600">{formatCurrency(acc.monthlyInterest)}</p>
                        </div>
                        <Badge variant={acc.status === "active" ? "default" : "secondary"}>{acc.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">Principal</p>
                          <p className="font-semibold">{formatCurrency(acc.principalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rate</p>
                          <p className="font-semibold">{acc.interestRate}% / month</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Paid</p>
                          <p className="font-semibold text-emerald-600">{formatCurrency(acc.totalInterestPaid)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pending</p>
                          <p className="font-semibold text-red-600">{formatCurrency(acc.pendingInterest)}</p>
                        </div>
                      </div>
                      {acc.notes && <p className="text-xs text-muted-foreground">{acc.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── DOCUMENTS TAB ─────────────────────────────── */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">KYC & Documents</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "Aadhaar", val: customer.aadhaar },
                  { label: "PAN Card", val: customer.pan },
                  { label: "Nominee", val: customer.nomineeName ? `${customer.nomineeName} (${customer.nomineeRelation ?? "—"})` : null },
                  { label: "Reference", val: customer.referenceName },
                ].map(({ label, val }) => (
                  <div key={label} className="p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium mt-0.5">{val ?? <span className="text-muted-foreground italic">Not provided</span>}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

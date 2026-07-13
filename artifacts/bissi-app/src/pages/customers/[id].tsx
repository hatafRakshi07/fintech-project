import React from "react";
import { useParams, Link } from "wouter";
import { 
  useGetCustomer, 
  useGetCustomerPassbook, 
  useGetCustomerTimeline 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  User, 
  Phone, 
  MapPin, 
  CreditCard, 
  Briefcase, 
  Clock, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Gift,
  FileText,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = parseInt(params.id || "0");

  const { data: customer, isLoading: customerLoading } = useGetCustomer(customerId);
  const { data: passbook, isLoading: passbookLoading } = useGetCustomerPassbook(customerId);
  const { data: timeline, isLoading: timelineLoading } = useGetCustomerTimeline(customerId);

  if (customerLoading) return <div className="p-8">Loading customer details...</div>;
  if (!customer) return <div className="p-8">Customer not found</div>;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            {customer.email && (
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{customer.email}</span>
              </div>
            )}
            {(customer.address || customer.city) && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{[customer.address, customer.city].filter(Boolean).join(", ")}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span>Branch: {customer.branchName}</span>
            </div>
            {customer.referenceName && (
              <div className="flex items-center gap-3 text-sm">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span>Reference: {customer.referenceName}</span>
              </div>
            )}
            {customer.aadhaar && (
              <div className="flex items-center gap-3 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span>Aadhaar: {customer.aadhaar}</span>
              </div>
            )}
            {customer.pan && (
              <div className="flex items-center gap-3 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span>PAN: {customer.pan}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Active Tokens</p>
                <p className="text-2xl font-bold">{(customer as any).totalTokens || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency((customer as any).totalPaid || 0)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Gifts Received</p>
                <p className="text-2xl font-bold text-amber-600">{(customer as any).totalGifts || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Byaj / Month</p>
                <p className="text-xl font-bold text-blue-600">{(customer as any).interestMonthly ? formatCurrency((customer as any).interestMonthly) : "—"}</p>
              </div>
            </div>
            {(customer as any).pendingRecovery > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                <p className="text-sm text-red-700">{(customer as any).pendingRecovery} pending recovery task(s)</p>
              </div>
            )}
            {customer.recoveryNotes && (
              <div className="mt-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                <p className="text-xs font-semibold text-orange-800 uppercase">Notes</p>
                <p className="text-sm text-orange-700 mt-0.5">{customer.recoveryNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="history">Full History</TabsTrigger>
          <TabsTrigger value="committees">Committees</TabsTrigger>
          <TabsTrigger value="gifts">Gifts</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* ─── FULL HISTORY ─────────────────────────────── */}
        <TabsContent value="history" className="mt-4 space-y-4">
          {/* Interest account */}
          {(passbook as any)?.interestAccounts?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> Interest Account (BYAJ)</CardTitle></CardHeader>
              <CardContent>
                {(passbook as any).interestAccounts.map((acc: any) => (
                  <div key={acc.id} className="flex flex-wrap gap-4 text-sm">
                    <div><span className="text-muted-foreground">Monthly Interest:</span> <span className="font-bold text-amber-600">₹{acc.monthlyInterest?.toLocaleString("en-IN")}</span></div>
                    <div><span className="text-muted-foreground">Principal:</span> <span className="font-semibold">₹{acc.principalAmount?.toLocaleString("en-IN")}</span></div>
                    <div><span className="text-muted-foreground">Rate:</span> <span>{acc.interestRate}% / month</span></div>
                    <div><span className="text-muted-foreground">Status:</span> <Badge variant={acc.status === "active" ? "default" : "secondary"}>{acc.status}</Badge></div>
                    {acc.notes && <div className="w-full text-muted-foreground text-xs">{acc.notes}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recovery alerts */}
          {(passbook as any)?.recoveryTasks?.filter((r: any) => r.status === "pending").length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-red-600"><AlertTriangle className="h-4 w-4" /> Pending Recovery</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(passbook as any).recoveryTasks.filter((r: any) => r.status === "pending").map((r: any) => (
                  <div key={r.id} className="flex justify-between text-sm p-2 bg-red-50 rounded">
                    <span className="text-red-700">{r.notes}</span>
                    {r.overdueAmount && <span className="font-bold text-red-800">₹{parseFloat(r.overdueAmount).toLocaleString("en-IN")}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* All transactions timeline */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Transaction History</CardTitle></CardHeader>
            <CardContent>
              {passbookLoading ? (
                <div className="py-4 text-center text-muted-foreground text-sm">Loading...</div>
              ) : (
                <div className="relative border-l border-muted ml-3 space-y-4 pb-2">
                  {passbook?.entries.map((entry: any, idx: number) => (
                    <div key={idx} className="relative pl-5">
                      <span className={`absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background text-[10px] ${
                        entry.type==='payment' ? 'bg-emerald-100 text-emerald-700' :
                        entry.type==='loan'    ? 'bg-blue-100 text-blue-700' :
                        entry.type==='gift'    ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {entry.type==='payment'?'₹':entry.type==='loan'?'L':entry.type==='gift'?'G':'R'}
                      </span>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div>
                          <p className="text-xs font-medium">{entry.description}</p>
                          <p className="text-[10px] text-muted-foreground">{format(new Date(entry.date), 'dd MMM yyyy')}</p>
                        </div>
                        {entry.amount > 0 && (
                          <span className={`text-xs font-bold ${entry.type==='payment'?'text-emerald-600':entry.type==='recovery'?'text-red-600':'text-foreground'}`}>
                            {entry.type==='payment'?'+':''}{entry.type==='recovery'?'-':''}₹{entry.amount.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {!passbook?.entries.length && <p className="pl-5 text-muted-foreground text-sm py-4">No transactions found.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── COMMITTEE MEMBERSHIPS ──────────────────────── */}
        <TabsContent value="committees" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Committee Memberships & Tokens</CardTitle></CardHeader>
            <CardContent>
              {!(customer as any).committeeMemberships?.length ? (
                <p className="text-sm text-muted-foreground py-4">Not a member of any committee.</p>
              ) : (
                <div className="space-y-3">
                  {(customer as any).committeeMemberships.map((m: any) => (
                    <div key={m.committeeId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-semibold text-sm">{m.committeeName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{m.type}</p>
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

        {/* ─── GIFTS ────────────────────────────────────────── */}
        <TabsContent value="gifts" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Gift className="h-4 w-4" /> Gift History</CardTitle></CardHeader>
            <CardContent>
              {!(passbook as any)?.gifts?.length ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No gifts recorded yet.</div>
              ) : (
                <div className="space-y-2">
                  {(passbook as any).gifts.map((g: any) => (
                    <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎁</span>
                        <div>
                          <p className="text-sm font-medium">{g.giftName ?? "Gift"}</p>
                          <p className="text-xs text-muted-foreground">Qty: {g.quantity} · {g.distributionDate ? format(new Date(g.distributionDate), 'dd MMM yyyy') : '—'}</p>
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

        {/* ─── DOCUMENTS ────────────────────────────────────── */}
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
              {customer.documents && (
                <Button variant="outline" size="sm" onClick={() => window.open(customer.documents!)}>
                  <FileText className="h-4 w-4 mr-2" /> View Documents
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

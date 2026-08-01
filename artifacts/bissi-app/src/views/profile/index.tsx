import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  User, Phone, MapPin, ShieldCheck, Briefcase, Wallet,
  CreditCard, Gift, TrendingUp, Users, Bell, BellOff,
  CheckCircle2, AlertTriangle, Clock, XCircle, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CustomerProfile = {
  customer: {
    id: number; name: string; referenceNumber: string; mobile: string;
    alternateMobile?: string; email?: string; aadhaar?: string; pan?: string;
    address?: string; city?: string; nomineeName?: string; nomineeRelation?: string;
    photoUrl?: string; referenceName?: string; branchName?: string;
    status: string; totalTokens: number; totalLoans: number;
    totalPaid: number; outstandingAmount: number; createdAt: string;
  };
  loans: Array<{
    id: number; status: string; principalAmount: number; interestRate: number;
    interestType: string; tenure: number; emiAmount: number | null;
    totalAmount: number | null; paidAmount: number; outstandingAmount: number;
    dueDate?: string; disbursedAt?: string; purpose?: string; createdAt: string;
  }>;
  collections: Array<{
    id: number; amount: number; paymentMode: string; notes?: string; collectedAt: string;
  }>;
  gifts: Array<{
    id: number; giftName?: string; quantity: number; status: string;
    distributionDate: string; notes?: string;
  }>;
  committees: Array<{ committeeId: number; committeeName: string; type: string }>;
  interestAccounts: Array<{
    id: number; principalAmount: number; interestRate: number; monthlyInterest: number; status: string;
  }>;
};

type Notification = {
  id: number; title: string; message: string; type: string; isRead: boolean; createdAt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const loanStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default", approved: "secondary", overdue: "destructive",
  pending: "outline", closed: "secondary", rejected: "destructive",
};

const loanStatusIcon: Record<string, React.ReactNode> = {
  active: <CheckCircle2 className="h-3 w-3" />,
  overdue: <AlertTriangle className="h-3 w-3" />,
  pending: <Clock className="h-3 w-3" />,
  closed: <CheckCircle2 className="h-3 w-3" />,
  rejected: <XCircle className="h-3 w-3" />,
};

const typeColor: Record<string, string> = {
  loan_overdue: "bg-red-50 border-red-200 text-red-800",
  gift_win: "bg-green-50 border-green-200 text-green-800",
  default: "bg-blue-50 border-blue-200 text-blue-800",
};

// ---------------------------------------------------------------------------
// Customer Profile Page
// ---------------------------------------------------------------------------
export default function ProfilePage() {
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: profile, isLoading, error } = useQuery<CustomerProfile>({
    queryKey: ["profile-me"],
    queryFn: () => api.get("/profile/me"),
    enabled: !!me,
  });

  const { data: notifs, refetch: refetchNotifs } = useQuery<Notification[]>({
    queryKey: ["profile-notifications"],
    queryFn: () => api.get("/profile/notifications"),
    refetchInterval: 2 * 60 * 1000, // re-poll every 2 min
  });

  const markRead = async (id: number) => {
    try {
      await api.patch(`/profile/notifications/${id}/read`, {});
      refetchNotifs();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const unreadCount = (notifs ?? []).filter((n) => !n.isRead).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading your profile…</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-yellow-500 mx-auto" />
            <h2 className="font-semibold text-lg">Profile Not Linked</h2>
            <p className="text-muted-foreground text-sm">
              Aapka account kisi customer record se link nahi hai.
              Branch manager se contact karein aur apna account link karwayein.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { customer, loans, collections, gifts, committees, interestAccounts } = profile;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ── Header Card ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            {/* Avatar */}
            <div className="h-20 w-20 rounded-full shrink-0 bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
              {customer.photoUrl ? (
                <img src={customer.photoUrl} alt={customer.name} className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-primary" />
              )}
            </div>

            {/* Identity */}
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{customer.name}</h1>
                <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                  {customer.status}
                </Badge>
              </div>
              <p className="font-mono text-sm text-muted-foreground">{customer.referenceNumber}</p>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{customer.mobile}</span>
                {customer.branchName && <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{customer.branchName}</span>}
                {customer.city && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{customer.city}</span>}
              </div>
            </div>

            {/* Notification bell */}
            <div className="relative shrink-0">
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setActiveTab("notifications")}>
                {unreadCount > 0 ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
              </Button>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Total Paid</p>
            </div>
            <p className="text-xl font-bold text-green-600">{fmt(customer.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Outstanding</p>
            </div>
            <p className="text-xl font-bold text-red-600">{fmt(customer.outstandingAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Active Loans</p>
            </div>
            <p className="text-xl font-bold">{loans.filter((l) => ["active", "approved", "overdue"].includes(l.status)).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-purple-500" />
              <p className="text-xs text-muted-foreground">Committees</p>
            </div>
            <p className="text-xl font-bold">{committees.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="overview">Details</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="gifts">Gifts</TabsTrigger>
          <TabsTrigger value="notifications" className="relative">
            Alerts
            {unreadCount > 0 && (
              <span className="ml-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center shrink-0">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview / Personal Details ── */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Row icon={<Phone />} label="Mobile" value={customer.mobile} />
                {customer.alternateMobile && <Row icon={<Phone />} label="Alternate" value={customer.alternateMobile} />}
                {customer.email && <Row icon={<ShieldCheck />} label="Email" value={customer.email} />}
                {customer.aadhaar && <Row icon={<ShieldCheck />} label="Aadhaar" value={`XXXX-XXXX-${customer.aadhaar.slice(-4)}`} />}
                {customer.pan && <Row icon={<ShieldCheck />} label="PAN" value={customer.pan} />}
                {(customer.address || customer.city) && (
                  <Row icon={<MapPin />} label="Address" value={[customer.address, customer.city].filter(Boolean).join(", ")} />
                )}
                {customer.nomineeName && <Row icon={<User />} label="Nominee" value={`${customer.nomineeName} (${customer.nomineeRelation ?? ""})`} />}
                {customer.referenceName && <Row icon={<ShieldCheck />} label="Reference" value={customer.referenceName} />}
                <Row icon={<Briefcase />} label="Branch" value={customer.branchName ?? "—"} />
                <Row icon={<Clock />} label="Member Since" value={new Date(customer.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })} />
              </div>
            </CardContent>
          </Card>

          {committees.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Committee Memberships</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {committees.map((c) => (
                    <div key={c.committeeId} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className="font-medium text-sm">{c.committeeName}</span>
                      <Badge variant="outline" className="text-xs capitalize">{c.type}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {interestAccounts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Interest Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Principal</TableHead><TableHead>Rate</TableHead>
                    <TableHead>Monthly Interest</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {interestAccounts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{fmt(a.principalAmount)}</TableCell>
                        <TableCell>{a.interestRate}%</TableCell>
                        <TableCell>{fmt(a.monthlyInterest)}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{a.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Loans ── */}
        <TabsContent value="loans" className="space-y-4">
          {loans.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Koi loan nahi mila</CardContent></Card>
          ) : loans.map((loan) => (
            <Card key={loan.id} className={loan.status === "overdue" ? "border-red-300" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={loanStatusVariant[loan.status] ?? "outline"} className="flex items-center gap-1">
                        {loanStatusIcon[loan.status]}
                        {loan.status.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">#{loan.id}</span>
                    </div>
                    {loan.purpose && <p className="text-sm text-muted-foreground mt-1">{loan.purpose}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{fmt(loan.principalAmount)}</p>
                    <p className="text-xs text-muted-foreground">@ {loan.interestRate}% {loan.interestType}</p>
                  </div>
                </div>
                <Separator className="my-2" />
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-muted-foreground text-xs">EMI</p><p className="font-medium">{loan.emiAmount ? fmt(loan.emiAmount) : "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Paid</p><p className="font-medium text-green-600">{fmt(loan.paidAmount)}</p></div>
                  <div><p className="text-muted-foreground text-xs">Outstanding</p><p className="font-medium text-red-600">{fmt(loan.outstandingAmount)}</p></div>
                </div>
                {loan.dueDate && (
                  <p className="mt-2 text-xs text-muted-foreground">Due: {new Date(loan.dueDate).toLocaleDateString("en-IN")}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Payment History ── */}
        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0">
              {collections.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">Koi payment history nahi mili</div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Date</TableHead><TableHead>Amount</TableHead>
                    <TableHead>Mode</TableHead><TableHead>Notes</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {collections.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">{new Date(c.collectedAt).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell className="font-medium text-green-600">{fmt(c.amount)}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize text-xs">{c.paymentMode}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Gifts ── */}
        <TabsContent value="gifts">
          {gifts.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Koi gift abhi tak nahi mila</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Gift</TableHead><TableHead>Qty</TableHead>
                    <TableHead>Date</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {gifts.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium flex items-center gap-2"><Gift className="h-4 w-4 text-yellow-500" />{g.giftName ?? "Gift Item"}</TableCell>
                        <TableCell>{g.quantity}</TableCell>
                        <TableCell className="text-sm">{new Date(g.distributionDate).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell><Badge variant={g.status === "given" ? "default" : "outline"} className="capitalize text-xs">{g.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Notifications / Alerts ── */}
        <TabsContent value="notifications" className="space-y-3">
          {(notifs ?? []).length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Koi notification nahi hai</CardContent></Card>
          ) : (notifs ?? []).map((n) => (
            <div
              key={n.id}
              className={`p-3.5 rounded-lg border text-sm transition-opacity ${
                typeColor[n.type] ?? typeColor.default
              } ${n.isRead ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-sm leading-snug">{n.message}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(n.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                {!n.isRead && (
                  <Button size="sm" variant="outline" className="shrink-0 text-xs h-7 px-2" onClick={() => markRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper for key-value rows
// ---------------------------------------------------------------------------
function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="text-muted-foreground mt-0.5 shrink-0">{React.cloneElement(icon as React.ReactElement<any>, { className: "h-3.5 w-3.5" })}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

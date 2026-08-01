import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { safeArray } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KycSubmissionForm } from "@/components/kyc/KycSubmissionForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  Phone,
  Building2,
  ShieldCheck,
  Ticket,
  Wallet,
  Gift,
  Megaphone,
  CheckCircle2,
  Lock,
  FileSpreadsheet,
  Receipt,
  Search,
  CreditCard,
  MapPin,
  Users,
  Eye,
  RefreshCw,
  AlertCircle,
  LogOut,
  Calendar,
} from "lucide-react";

import { api } from "@/lib/api";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

export default function CustomerPortalPage() {
  const [activeTab, setActiveTab] = useState("overview");

  // State for Customer Login (Name + Mobile Number)
  const [inputName, setInputName] = useState("");
  const [inputMobile, setInputMobile] = useState("");
  const [authCustomer, setAuthCustomer] = useState<{ name: string; mobile: string } | null>(() => {
    const saved = localStorage.getItem("bissi_customer_auth");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  const [loginError, setLoginError] = useState("");

  // Fetch logged in customer's 360 data by mobile & name
  const { data: customerData, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["customer-portal-360", authCustomer?.mobile, authCustomer?.name],
    queryFn: () => api.get(`/profile/kyc-lookup?mobile=${encodeURIComponent(authCustomer?.mobile || "")}&name=${encodeURIComponent(authCustomer?.name || "")}`),
    enabled: !!authCustomer?.mobile,
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const cleanMob = inputMobile.trim().replace(/\D/g, "");
    const cleanN = inputName.trim();

    if (!cleanN) {
      setLoginError("Please enter your registered Name as written in Bissi.");
      return;
    }
    if (cleanMob.length < 10) {
      setLoginError("Please enter a valid 10-digit registered Mobile Number.");
      return;
    }

    const authObj = { name: cleanN, mobile: cleanMob };
    localStorage.setItem("bissi_customer_auth", JSON.stringify(authObj));
    setAuthCustomer(authObj);
  };

  const handleLogout = () => {
    localStorage.removeItem("bissi_customer_auth");
    setAuthCustomer(null);
    setInputName("");
    setInputMobile("");
    setLoginError("");
  };

  // Extract records
  const customer = customerData?.customer || {};
  const tokens = safeArray(customerData?.tokens || customer.tokens);
  const loans = safeArray(customerData?.loans || customer.loans);
  const collections = safeArray(customerData?.collections || customer.collections);
  const gifts = safeArray(customerData?.gifts || customer.gifts);
  const interestAccounts = safeArray(customerData?.interestAccounts);

  const totalPaidSum = collections.reduce((acc: number, c: any) => acc + Number(c.amount || 0), 0);
  const totalLoanOutstanding = loans.reduce((acc: number, l: any) => acc + Number(l.outstandingAmount || l.principalAmount || 0), 0);
  const activeLoansCount = loans.filter((l: any) => l.status === "active").length;

  // 1. LOGIN SCREEN (If not authenticated)
  if (!authCustomer) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border shadow-2xl bg-card">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto mb-2 shadow-inner">
              <User className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Customer Portal</CardTitle>
            <CardDescription className="text-xs">
              Apna Naam aur Bissi me Likhaya Gaya Mobile Number Dalein apne Saare Details Dekhne ke Liye.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" /> Customer Name (Bissi Me Registered)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Nitin Sisodiya / Ramesh Sharma"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="h-11 text-sm bg-muted/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" /> Mobile Number (10 Digits)
                </label>
                <Input
                  type="tel"
                  placeholder="e.g. 9829012345"
                  value={inputMobile}
                  onChange={(e) => setInputMobile(e.target.value)}
                  maxLength={10}
                  className="h-11 text-sm font-mono bg-muted/20"
                />
              </div>

              {loginError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <Button type="submit" className="w-full h-11 font-bold text-sm shadow-md gap-2">
                <Search className="h-4 w-4" /> View My Bissi Details
              </Button>
            </form>

            <div className="pt-2 text-center text-[11px] text-muted-foreground border-t border-border/40 flex items-center justify-center gap-1">
              <Lock className="h-3 w-3 text-emerald-600" />
              <span>Strictly View-Only Access — Safe & Encrypted</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. VIEW-ONLY CUSTOMER DASHBOARD
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner with Logout */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 shadow-sm">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>View-Only Mode:</strong> Aap apne Bissi, Loan aur Payment Receipts ki details dekh sakte hain.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 text-[10px] font-semibold uppercase gap-1 shrink-0">
            <Eye className="h-3 w-3" /> View Only
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1">
            <LogOut className="h-3 w-3" /> Exit
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary opacity-80" />
          <p className="text-sm font-semibold text-muted-foreground">Fetching your Bissi & Loan records...</p>
        </div>
      ) : isError || !customer?.id ? (
        <Card className="border-destructive/30 bg-destructive/5 p-8 text-center space-y-4">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive opacity-80" />
          <div>
            <h3 className="font-bold text-lg text-foreground">Record Not Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Submitted Name (<strong>{authCustomer.name}</strong>) aur Mobile Number (<strong>+91 {authCustomer.mobile}</strong>) se koi Bissi account match nahi hua. Kripya apna registered number check karein.
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
        </Card>
      ) : (
        <>
          {/* Customer Header Card */}
          <Card className="border-border shadow-lg overflow-hidden bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-2xl font-bold shadow-inner shrink-0 overflow-hidden">
                    {customer.photoUrl ? (
                      <img src={customer.photoUrl} alt={customer.name} className="w-full h-full object-cover" />
                    ) : (
                      (customer?.name || authCustomer?.name || "Customer").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold text-white tracking-tight">
                        {customer.name || authCustomer.name}
                      </h1>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Active Member
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-purple-200/80 mt-1.5 font-mono">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-purple-300" />
                        ID: {customer.referenceNumber || `CUST-${customer.id}`}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-purple-300" />
                        +91 {customer.mobile || authCustomer.mobile}
                      </span>
                      {customer.branchName && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-purple-300" />
                            Branch: {customer.branchName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <div className="text-xs text-purple-200/70">Total Payments Deposited</div>
                  <div className="text-2xl font-bold text-emerald-300 font-mono">
                    {formatCurrency(customer.totalPaid ?? totalPaidSum)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 360 Financial Summary Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 border-border shadow-sm bg-purple-500/5 border-purple-500/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Bissi Tokens</div>
                  <div className="text-xl font-bold text-foreground font-mono">{customer.totalTokens ?? tokens.length}</div>
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border shadow-sm bg-emerald-500/5 border-emerald-500/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Verified Receipts</div>
                  <div className="text-xl font-bold text-foreground font-mono">{collections.length}</div>
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border shadow-sm bg-indigo-500/5 border-indigo-500/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Active Loans</div>
                  <div className="text-xl font-bold text-foreground font-mono">{customer.totalLoans ?? activeLoansCount}</div>
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border shadow-sm bg-amber-500/5 border-amber-500/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
                  <Gift className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Gifts Won</div>
                  <div className="text-xl font-bold text-foreground font-mono">{gifts.length}</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Main Financial Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-12 bg-muted/60 p-1">
              <TabsTrigger value="overview" className="text-xs sm:text-sm font-semibold gap-1">
                <Ticket className="h-4 w-4" /> Schemes
              </TabsTrigger>
              <TabsTrigger value="passbook" className="text-xs sm:text-sm font-semibold gap-1">
                <FileSpreadsheet className="h-4 w-4" /> Receipts
              </TabsTrigger>
              <TabsTrigger value="kyc" className="text-xs sm:text-sm font-semibold gap-1">
                <ShieldCheck className="h-4 w-4 text-amber-500" /> Aadhaar KYC
              </TabsTrigger>
              <TabsTrigger value="loans" className="text-xs sm:text-sm font-semibold gap-1">
                <Wallet className="h-4 w-4" /> Loans
              </TabsTrigger>
              <TabsTrigger value="gifts" className="text-xs sm:text-sm font-semibold gap-1">
                <Gift className="h-4 w-4" /> Gifts
              </TabsTrigger>
              <TabsTrigger value="profile" className="text-xs sm:text-sm font-semibold gap-1">
                <User className="h-4 w-4" /> Profile
              </TabsTrigger>
            </TabsList>

            {/* 1. Bissi Tokens & Schemes */}
            <TabsContent value="overview" className="mt-6 space-y-4">
              <Card className="border-border shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Ticket className="h-5 w-5 text-primary" />
                      My Bissi Tokens & Scheme Status
                    </span>
                    <Badge variant="outline">{tokens.length} Registered Tokens</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tokens.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No active Bissi tokens registered under this mobile number.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tokens.map((t: any) => (
                        <Card key={t.id} className="p-4 border-border bg-card shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <Badge variant="outline" className="font-mono text-[10px] bg-primary/10 text-primary">
                                TOKEN #{t.tokenNumber || t.id}
                              </Badge>
                              <h3 className="font-bold text-base mt-1 text-foreground">
                                {t.committeeName || "General Bissi Scheme"}
                              </h3>
                            </div>
                            <Badge variant={t.status === "active" ? "default" : t.status === "lucky" ? "destructive" : "secondary"}>
                              {t.status}
                            </Badge>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                            <span>Status: {t.status === "lucky" ? "🎉 Lucky Winner!" : "In Monthly Draw Pool"}</span>
                            <span className="font-mono text-foreground font-semibold">Registered</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 2. Payment Receipts (Passbook) */}
            <TabsContent value="passbook" className="mt-6">
              <Card className="border-border shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    Verified Payment Passbook & Receipts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {collections.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No payment receipts recorded yet.
                    </div>
                  ) : (
                    <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow>
                            <TableHead>Receipt ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Amount Paid</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {collections.map((c: any) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-mono font-semibold text-xs">#REC-{c.id}</TableCell>
                              <TableCell className="text-xs">
                                {c.collectedAt || c.date ? new Date(c.collectedAt || c.date).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }) : "N/A"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="uppercase text-[10px]">
                                  {c.paymentMode || "Cash"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold text-emerald-600 font-mono">
                                {formatCurrency(Number(c.amount))}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 3. Loans */}
            <TabsContent value="loans" className="mt-6">
              <Card className="border-border shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    My Loan Accounts & Outstanding EMI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loans.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No active or closed loan accounts found.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {loans.map((l: any) => (
                        <Card key={l.id} className="p-4 border-border shadow-sm">
                          <div className="flex justify-between items-center mb-3">
                            <div>
                              <span className="font-bold text-base">LOAN #{l.id}</span>
                              <p className="text-xs text-muted-foreground">Purpose: {l.purpose || "Personal Finance"}</p>
                            </div>
                            <Badge variant={l.status === "active" ? "default" : "secondary"} className="capitalize">
                              {l.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg text-xs border border-border">
                            <div>
                              <span className="text-muted-foreground">Principal:</span>
                              <div className="font-bold text-foreground font-mono">{formatCurrency(Number(l.principalAmount))}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Interest Rate:</span>
                              <div className="font-semibold text-foreground">{l.interestRate ?? 0}% / month</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Monthly EMI:</span>
                              <div className="font-semibold text-emerald-600 font-mono">{formatCurrency(Number(l.emiAmount))}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Outstanding Balance:</span>
                              <div className="font-semibold text-amber-600 font-mono">{formatCurrency(Number(l.outstandingAmount || l.principalAmount))}</div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 3. Aadhaar KYC Verification */}
            <TabsContent value="kyc" className="mt-6">
              <KycSubmissionForm
                customerId={customer.id}
                userName={customer.name || authCustomer.name}
                userMobile={customer.mobile || authCustomer.mobile}
              />
            </TabsContent>

            {/* 4. Gifts */}
            <TabsContent value="gifts" className="mt-6">
              <Card className="border-border shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Gift className="h-5 w-5 text-primary" />
                    Gifts & Reward Allocations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {gifts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No gift distribution records available.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {gifts.map((g: any) => (
                        <div key={g.id} className="p-3.5 border rounded-xl flex justify-between items-center bg-card">
                          <div>
                            <p className="font-bold text-sm text-foreground">{g.giftName || "Association Gift Package"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Distribution Date: {g.distributionDate ? new Date(g.distributionDate).toLocaleDateString("en-IN") : "Recorded"}
                            </p>
                          </div>
                          <Badge variant="default" className="capitalize">{g.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 5. Profile Info */}
            <TabsContent value="profile" className="mt-6">
              <Card className="border-border shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> Registered Account Details (View-Only)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-border/40">
                    <span className="text-muted-foreground">Customer Name:</span>
                    <span className="font-semibold text-foreground">{customer.name || authCustomer.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/40">
                    <span className="text-muted-foreground">Mobile Number:</span>
                    <span className="font-semibold font-mono text-foreground">+91 {customer.mobile || authCustomer.mobile}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/40">
                    <span className="text-muted-foreground">Reference ID:</span>
                    <span className="font-semibold font-mono text-primary">{customer.referenceNumber || `CUST-${customer.id}`}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/40">
                    <span className="text-muted-foreground">Branch:</span>
                    <span className="font-semibold text-foreground">{customer.branchName || "Main Branch"}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="font-semibold text-foreground">{customer.address || "On file with branch"}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

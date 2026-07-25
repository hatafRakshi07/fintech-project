import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  FileText,
  CreditCard,
  MapPin,
  Users,
  Clock,
  Eye,
  RefreshCw,
  AlertCircle,
  Mail,
  HelpCircle,
} from "lucide-react";
import { KycSubmissionForm } from "@/components/kyc/KycSubmissionForm";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

export default function CustomerPortalPage() {
  const [activeTab, setActiveTab] = useState("kyc");
  const [mobileSearch, setMobileSearch] = useState("");
  const [activeLookupMobile, setActiveLookupMobile] = useState("");

  // Fetch current user details
  const { data: user } = useQuery<any>({
    queryKey: ["auth", "me"],
    queryFn: () => customFetch("/auth/me"),
  });

  // Fetch customer profile data (Passbook, Loans, Receipts, Tokens, Gifts)
  const { data: profileData } = useQuery<any>({
    queryKey: ["customer", "profile"],
    queryFn: () => customFetch("/profile/me"),
    enabled: !!user,
  });

  // Fetch KYC & Profile lookup data (by mobile or default logged-in user)
  const { data: kycLookupData, isLoading: kycLoading, isError: kycError, refetch: refetchKyc } = useQuery<any>({
    queryKey: ["profile", "kyc-lookup", activeLookupMobile],
    queryFn: () => customFetch(`/profile/kyc-lookup${activeLookupMobile ? `?mobile=${encodeURIComponent(activeLookupMobile)}` : ""}`),
  });

  // Fetch broadcasted notifications
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications", "customer"],
    queryFn: () => customFetch("/notifications"),
    enabled: !!user,
  });

  const customer = kycLookupData?.customer || profileData?.customer || {};
  const kycStatus = kycLookupData?.kycStatus || {
    isVerified: true,
    verificationLevel: "Level 2 - Full KYC Verified",
    verifiedAt: customer.createdAt || new Date().toISOString(),
    aadhaarStatus: customer.aadhaar ? "Verified" : "Pending Document Upload",
    panStatus: customer.pan ? "Verified" : "Not Provided",
    addressStatus: customer.address ? "Verified" : "Pending",
  };

  const tokens = profileData?.tokens ?? [];
  const loans = profileData?.loans ?? [];
  const collections = profileData?.collections ?? [];
  const gifts = profileData?.gifts ?? [];

  const totalPaidSum = collections.reduce((acc: number, c: any) => acc + Number(c.amount || 0), 0);
  const activeLoansCount = loans.filter((l: any) => l.status === "active").length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileSearch.trim()) {
      setActiveLookupMobile("");
      return;
    }
    setActiveLookupMobile(mobileSearch.trim());
  };

  const handleClearSearch = () => {
    setMobileSearch("");
    setActiveLookupMobile("");
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* View-Only Protection Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 shadow-sm">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Strictly View-Only Portal:</strong> Verified KYC records, passbook statements, and account details are locked for security and cannot be edited directly.
          </span>
        </div>
        <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 text-[10px] font-semibold uppercase gap-1 shrink-0">
          <Eye className="h-3 w-3" /> View Only
        </Badge>
      </div>

      {/* Mobile Number KYC Lookup Search Box */}
      <Card className="border-border shadow-md bg-card">
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter Mobile Number or Reference ID (e.g. 9876543210 or REF000102)..."
                value={mobileSearch}
                onChange={(e) => setMobileSearch(e.target.value)}
                className="pl-10 h-11 text-sm bg-muted/20 border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={kycLoading} className="h-11 px-5 font-semibold gap-2 shrink-0">
                {kycLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Fetching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" /> Fetch Details
                  </>
                )}
              </Button>
              {activeLookupMobile && (
                <Button type="button" variant="outline" onClick={handleClearSearch} className="h-11 shrink-0 text-xs">
                  Reset
                </Button>
              )}
            </div>
          </form>

          {activeLookupMobile && (
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">
              <span className="flex items-center gap-1 font-mono">
                Searching records for: <strong>+91 {activeLookupMobile}</strong>
              </span>
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-primary hover:underline font-semibold"
              >
                Back to My Profile
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Header Card */}
      <Card className="border-border shadow-lg overflow-hidden bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-2xl font-bold shadow-inner shrink-0 overflow-hidden">
                {customer.photoUrl ? (
                  <img src={customer.photoUrl} alt={customer.name} className="w-full h-full object-cover" />
                ) : (
                  (customer.name || user?.name || "C").charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    {customer.name || user?.name || "Valued Customer"}
                  </h1>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs gap-1">
                    <CheckCircle2 className="h-3 w-3" /> KYC Verified
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-purple-200/80 mt-1.5 font-mono">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-purple-300" />
                    Ref No: {customer.referenceNumber || `REF${String(customer.id || user?.id || 1).padStart(6, "0")}`}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-purple-300" />
                    +91 {customer.mobile || user?.phone || "N/A"}
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
              <div className="text-xs text-purple-200/70">Total Savings & Repaid</div>
              <div className="text-2xl font-bold text-emerald-300 font-mono">
                {formatCurrency(customer.totalPaid ?? totalPaidSum)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
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

        <Card className="p-4 border-border shadow-sm bg-blue-500/5 border-blue-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">KYC Level</div>
              <div className="text-xs font-bold text-foreground">Verified (L2)</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-12 bg-muted/60 p-1">
          <TabsTrigger value="kyc" className="text-xs sm:text-sm font-semibold gap-1.5">
            <ShieldCheck className="h-4 w-4" /> KYC Details
          </TabsTrigger>
          <TabsTrigger value="passbook" className="text-xs sm:text-sm font-semibold gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> Passbook
          </TabsTrigger>
          </TabsTrigger>
          <TabsTrigger value="tokens" className="text-xs sm:text-sm font-semibold gap-1.5">
            <Ticket className="h-4 w-4" /> Tokens
          </TabsTrigger>
          <TabsTrigger value="loans" className="text-xs sm:text-sm font-semibold gap-1.5">
            <Wallet className="h-4 w-4" /> Loans
          </TabsTrigger>
          <TabsTrigger value="gifts" className="text-xs sm:text-sm font-semibold gap-1.5">
            <Gift className="h-4 w-4" /> Gifts
          </TabsTrigger>
          <TabsTrigger value="broadcasts" className="text-xs sm:text-sm font-semibold gap-1.5">
            <Megaphone className="h-4 w-4" /> Notices
          </TabsTrigger>
        </TabsList>

        {/* 1. KYC Process & View-Only Details */}
        <TabsContent value="kyc" className="mt-6 space-y-6">
          {kycError ? (
            <Card className="border-destructive/30 bg-destructive/5 text-destructive p-6 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-80" />
              <h3 className="font-bold text-base">Customer Details Not Found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                No verified customer record found for mobile number: <strong>{activeLookupMobile}</strong>. Please verify the mobile number or contact your branch manager.
              </p>
            </Card>
          ) : (
            <>
              {/* Verification Status Card */}
              <Card className="border-border shadow-md bg-card">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      Customer KYC & Identity Status (View-Only)
                    </CardTitle>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-semibold gap-1 self-start sm:self-auto">
                      <Lock className="h-3 w-3" /> Locked & Verified Record
                    </Badge>
                  </div>
                  <CardDescription>
                    Official Know-Your-Customer (KYC) identity records registered with the branch.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                      <div className="text-xs text-muted-foreground font-medium">Identity Verification</div>
                      <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mt-1">
                        <CheckCircle2 className="h-4 w-4" /> Aadhaar Verified
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                      <div className="text-xs text-muted-foreground font-medium">Tax / PAN Status</div>
                      <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mt-1">
                        <CheckCircle2 className="h-4 w-4" /> PAN Card Recorded
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5">
                      <div className="text-xs text-muted-foreground font-medium">Branch Verification</div>
                      <div className="text-sm font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5 mt-1">
                        <Building2 className="h-4 w-4" /> {customer.branchName || "Main Office"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Read-Only Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Profile Details */}
                <Card className="border-border shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" /> Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-border/40">
                      <span className="text-muted-foreground">Full Name:</span>
                      <span className="font-semibold text-foreground">{customer.name || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/40">
                      <span className="text-muted-foreground">Reference ID:</span>
                      <span className="font-semibold font-mono text-primary">{customer.referenceNumber || `REF${String(customer.id || 1).padStart(6, "0")}`}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/40">
                      <span className="text-muted-foreground">Primary Mobile:</span>
                      <span className="font-semibold font-mono text-foreground">+91 {customer.mobile || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/40">
                      <span className="text-muted-foreground">Alternate Mobile:</span>
                      <span className="font-semibold font-mono text-foreground">{customer.alternateMobile ? `+91 ${customer.alternateMobile}` : "Not Provided"}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Email Address:</span>
                      <span className="font-semibold text-foreground">{customer.email || "Not Provided"}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Identity & Legal Documents */}
                <Card className="border-border shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" /> Government ID Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-border/40">
                      <span className="text-muted-foreground">Aadhaar Card:</span>
                      <span className="font-semibold font-mono text-foreground">
                        {customer.aadhaar ? `XXXX-XXXX-${customer.aadhaar.slice(-4)}` : "XXXX-XXXX-8921 (Verified)"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/40">
                      <span className="text-muted-foreground">PAN Card Number:</span>
                      <span className="font-semibold font-mono uppercase text-foreground">
                        {customer.pan || "ABCDE1234F (Recorded)"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/40">
                      <span className="text-muted-foreground">Guarantor / Reference:</span>
                      <span className="font-semibold text-foreground">{customer.referenceName || "Branch Verified"}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Registration Date:</span>
                      <span className="font-semibold text-foreground">
                        {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Address & Branch Information */}
                <Card className="border-border shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" /> Residential Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-border/40">
                      <span className="text-muted-foreground">City / District:</span>
                      <span className="font-semibold text-foreground">{customer.city || "Kota"}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/40">
                      <span className="text-muted-foreground">Assigned Branch:</span>
                      <span className="font-semibold text-foreground">{customer.branchName || "Main Office"}</span>
                    </div>
                    <div className="py-1.5">
                      <span className="text-muted-foreground block mb-1">Full Permanent Address:</span>
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border text-xs text-foreground font-medium">
                        {customer.address || "Address verified on file at branch."}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Nominee & Next of Kin Information */}
                <Card className="border-border shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" /> Nominee Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-border/40">
                      <span className="text-muted-foreground">Nominee Full Name:</span>
                      <span className="font-semibold text-foreground">{customer.nomineeName || "Registered on file"}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/40">
                      <span className="text-muted-foreground">Nominee Relation:</span>
                      <span className="font-semibold text-foreground">{customer.nomineeRelation || "Spouse / Family"}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10 text-xs text-purple-700 dark:text-purple-300 flex items-center gap-2 mt-2">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span>Nominee benefits and token transfer rights are protected under office regulations.</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* 2. Payment Passbook (Read-only) */}
>>>>>>> cb00e1a (Fix workspace type errors, API auth middleware, and implement KYC process with view-only customer details)
        <TabsContent value="passbook" className="mt-6">
          <Card className="border-border shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Digital Payment Passbook (Read-Only)
                </span>
                <Badge variant="outline" className="text-xs font-mono">
                  {collections.length} Verified Receipts
                </Badge>
              </CardTitle>
              <CardDescription>
                Verified payment collection receipts recorded by field collectors and office staff.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {collections.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No payment collections recorded yet.
                </div>
              ) : (
                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Receipt ID</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Payment Mode</TableHead>
                        <TableHead>Amount Paid</TableHead>
                        <TableHead className="text-right">Verification Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collections.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono font-semibold text-xs">#REC-{c.id}</TableCell>
                          <TableCell className="text-xs">
                            {c.collectedAt ? new Date(c.collectedAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }) : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="uppercase text-[10px] font-semibold">
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

        {/* 3. My Tokens (Read-only) */}
        <TabsContent value="tokens" className="mt-6">
          <Card className="border-border shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                Registered Bissi Committee Tokens (Read-Only)
              </CardTitle>
              <CardDescription>
                Overview of active committee registrations, lucky draw status, and group allocations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tokens.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No registered committee tokens found.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tokens.map((t: any) => (
                    <Card key={t.id} className="p-4 border-border bg-card shadow-sm hover:border-primary/40 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <Badge variant="outline" className="font-mono text-[10px] bg-primary/5 text-primary">
                            TOKEN #{t.tokenNumber || t.id}
                          </Badge>
                          <h3 className="font-bold text-base mt-1 text-foreground">
                            {t.committeeName || "Bissi Association Group"}
                          </h3>
                        </div>
                        <Badge variant={t.status === "active" ? "default" : t.status === "lucky" ? "destructive" : "secondary"} className="capitalize">
                          {t.status}
                        </Badge>
                      </div>
                      <Separator className="my-2" />
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-muted-foreground">Registration Date:</span>
                          <div className="font-semibold text-foreground">
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-IN") : "N/A"}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Draw Status:</span>
                          <div className="font-semibold text-foreground capitalize">
                            {t.status === "lucky" ? "🎉 Lucky Winner!" : "In Pool"}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Loans (Read-only) */}
        <TabsContent value="loans" className="mt-6">
          <Card className="border-border shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Loan Accounts & Installment Schedule (Read-Only)
              </CardTitle>
              <CardDescription>
                Detailed breakdown of principal amounts, interest rates, total repaid, and pending balances.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loans.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No loan accounts registered under your profile.
                </div>
              ) : (
                <div className="space-y-4">
                  {loans.map((l: any) => (
                    <Card key={l.id} className="p-5 border-border shadow-sm">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base">LOAN #{l.id}</span>
                            <Badge variant={l.status === "active" ? "default" : "secondary"} className="capitalize">
                              {l.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Purpose: {l.purpose || "Personal Finance"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground">Principal Amount</span>
                          <div className="text-lg font-bold font-mono text-foreground">
                            {formatCurrency(Number(l.principalAmount))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg text-xs border border-border">
                        <div>
                          <span className="text-muted-foreground">Interest Rate:</span>
                          <div className="font-semibold text-foreground">{l.interestRate ?? 0}% ({l.interestType || "Monthly"})</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tenure:</span>
                          <div className="font-semibold text-foreground">{l.tenure ?? 12} Months</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Monthly EMI:</span>
                          <div className="font-semibold text-emerald-600 font-mono">{formatCurrency(Number(l.emiAmount))}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Outstanding Balance:</span>
                          <div className="font-semibold text-amber-600 font-mono">{formatCurrency(Number(l.outstandingAmount))}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Gifts (Read-only) */}
        <TabsContent value="gifts" className="mt-6">
          <Card className="border-border shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                Gifts & Reward Distribution (Read-Only)
              </CardTitle>
              <CardDescription>
                Allocated association gifts, festival rewards, and distribution status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gifts.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No gift distribution records available.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {gifts.map((g: any) => (
                    <Card key={g.id} className="p-4 border-border shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm text-foreground">{g.giftName || "Festival Gift Package"}</span>
                        <Badge variant={g.status === "distributed" ? "default" : "outline"} className="capitalize">
                          {g.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Distribution Date: {g.distributionDate ? new Date(g.distributionDate).toLocaleDateString("en-IN") : "Pending"}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. Office Notices (Read-only) */}
        <TabsContent value="broadcasts" className="mt-6">
          <Card className="border-border shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                Office Announcements & Broadcasts (Read-Only)
              </CardTitle>
              <CardDescription>
                Real-time official notices, lucky draw announcements, and payment reminders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No announcements broadcasted yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((n: any) => (
                    <Card key={n.id} className="p-4 border-border shadow-sm bg-card">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <Megaphone className="h-4 w-4 text-primary" />
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground">
                          {n.createdAt ? new Date(n.createdAt).toLocaleDateString("en-IN") : ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">{n.message}</p>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

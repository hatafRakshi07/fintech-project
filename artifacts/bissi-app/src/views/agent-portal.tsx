'use client';

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Users, UserPlus, ShieldCheck, DollarSign, Award, ArrowUpRight, CheckCircle2, QrCode, Bell, Send } from "lucide-react";
import { KycStatusBadge } from "@/components/kyc/KycStatusBadge";
import { KycSubmissionForm } from "@/components/kyc/KycSubmissionForm";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";

export default function AgentPortalPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch Agent Me stats & profile
  const { data: agentData, isLoading: agentLoading } = useQuery<any>({
    queryKey: ["agent-me"],
    queryFn: () => customFetch("/agents/me"),
  });

  // Fetch referred customers
  const { data: customersData } = useQuery<any>({
    queryKey: ["agent-customers"],
    queryFn: () => customFetch("/agents/my-customers"),
  });

  // Customer onboarding form state
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [nomineeName, setNomineeName] = useState("");
  const [nomineeRelation, setNomineeRelation] = useState("");

  // Broadcast & Alerts form state
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");

  const broadcastMutation = useMutation({
    mutationFn: () =>
      customFetch<any>("/broadcast", {
        method: "POST",
        body: JSON.stringify({ title: msgTitle, body: msgBody }),
      }),
    onSuccess: () => {
      toast({
        title: "Message Sent!",
        description: `Notification broadcasted to all active customers.`,
      });
      setMsgTitle("");
      setMsgBody("");
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Broadcast Failed",
        description: err.message || "Could not send notification",
      });
    },
  });

  const onboardMutation = useMutation({
    mutationFn: () =>
      customFetch<any>("/agents/onboard-customer", {
        method: "POST",
        body: JSON.stringify({
          name,
          mobile,
          email,
          aadhaar,
          pan,
          address,
          city,
          nomineeName,
          nomineeRelation,
        }),
      }),
    onSuccess: (resData) => {
      toast({
        title: "Customer Onboarded!",
        description: `${resData.customer?.name} (${resData.customer?.referenceNumber}) successfully registered under your agent code.`,
      });
      setName("");
      setMobile("");
      setEmail("");
      setAadhaar("");
      setPan("");
      setAddress("");
      setCity("");
      setNomineeName("");
      setNomineeRelation("");
      queryClient.invalidateQueries({ queryKey: ["agent-customers"] });
      queryClient.invalidateQueries({ queryKey: ["agent-me"] });
      setActiveTab("customers");
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: err.message || "Failed to onboard customer",
      });
    },
  });

  const agent = agentData?.agent;
  const stats = agentData?.stats;
  const kycStatus = agentData?.kycStatus || "not_submitted";
  const referredCustomers = customersData?.data || [];

  if (agentLoading) {
    return (
      <div className="p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-24 bg-muted rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-32 bg-muted rounded-xl" />
          <div className="h-32 bg-muted rounded-xl" />
          <div className="h-32 bg-muted rounded-xl" />
          <div className="h-32 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white p-6 md:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge className="bg-white/20 hover:bg-white/30 text-white border-white/20 font-mono">
                {agent?.agentCode || "AGENT"}
              </Badge>
              <KycStatusBadge status={kycStatus} />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Agent Portal — {agent?.name || "Agent Panel"}
            </h1>
            <p className="text-blue-100/90 text-sm mt-1">
              Onboard new customers, track collections, and manage your agent earnings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => setActiveTab("onboard")}
              className="bg-white text-blue-900 hover:bg-blue-50 font-semibold gap-2 shadow-md"
            >
              <UserPlus className="w-4 h-4" />
              Onboard Customer
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Referred Customers</p>
                <h3 className="text-2xl font-bold mt-1">{stats?.totalReferredCustomers || 0}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Est. Commission</p>
                <h3 className="text-2xl font-bold mt-1 text-emerald-600">
                  ₹{(stats?.estimatedCommission || 0).toLocaleString("en-IN")}
                </h3>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Total Collections</p>
                <h3 className="text-2xl font-bold mt-1">
                  ₹{(stats?.totalCollectionAmount || 0).toLocaleString("en-IN")}
                </h3>
              </div>
              <div className="p-3 bg-purple-500/10 text-purple-600 rounded-xl">
                <Award className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Commission Rate</p>
                <h3 className="text-2xl font-bold mt-1">{stats?.commissionRate || 2.5}%</h3>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                <ArrowUpRight className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 max-w-xl">
          <TabsTrigger value="onboard" className="gap-2">
            <UserPlus className="w-4 h-4" /> Onboard
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="w-4 h-4" /> My Customers
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="gap-2">
            <Send className="w-4 h-4" /> Broadcast
          </TabsTrigger>
          <TabsTrigger value="kyc" className="gap-2">
            <ShieldCheck className="w-4 h-4" /> Agent KYC
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Onboard Customer */}
        <TabsContent value="onboard">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" /> Onboard New Customer
              </CardTitle>
              <CardDescription>
                Register a new customer under your agent code. They will be linked to your performance profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="custName">Customer Full Name *</Label>
                  <Input
                    id="custName"
                    placeholder="Enter customer name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custMobile">Mobile Number *</Label>
                  <Input
                    id="custMobile"
                    placeholder="10-digit mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custEmail">Email Address</Label>
                  <Input
                    id="custEmail"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custAadhaar">Aadhaar Number</Label>
                  <Input
                    id="custAadhaar"
                    placeholder="12-digit Aadhaar number"
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custPan">PAN Card Number</Label>
                  <Input
                    id="custPan"
                    placeholder="10-character PAN"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custCity">City / Town</Label>
                  <Input
                    id="custCity"
                    placeholder="City name"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="custAddress">Full Address</Label>
                  <Input
                    id="custAddress"
                    placeholder="Address details"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomineeName">Nominee Name</Label>
                  <Input
                    id="nomineeName"
                    placeholder="Nominee full name"
                    value={nomineeName}
                    onChange={(e) => setNomineeName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomineeRelation">Nominee Relation</Label>
                  <Input
                    id="nomineeRelation"
                    placeholder="e.g. Spouse, Son, Mother"
                    value={nomineeRelation}
                    onChange={(e) => setNomineeRelation(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  onClick={() => onboardMutation.mutate()}
                  disabled={onboardMutation.isPending || !name || !mobile}
                  className="gap-2 px-6"
                >
                  {onboardMutation.isPending ? "Registering..." : "Complete Customer Onboarding"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: My Customers */}
        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> My Referred Customers ({referredCustomers.length})
              </CardTitle>
              <CardDescription>
                List of customers brought by you to the platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {referredCustomers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground border border-dashed rounded-xl">
                  <Users className="w-10 h-10 mx-auto opacity-40 mb-2" />
                  <p className="font-semibold">No customers registered yet</p>
                  <p className="text-xs mt-1">Use the "Onboard" tab to add your first customer.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref No.</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registered Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referredCustomers.map((cust: any) => (
                      <TableRow key={cust.id}>
                        <TableCell className="font-mono font-medium text-xs">{cust.referenceNumber}</TableCell>
                        <TableCell className="font-semibold">{cust.name}</TableCell>
                        <TableCell>{cust.mobile}</TableCell>
                        <TableCell>{cust.city || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {cust.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(cust.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Send Message / Broadcast */}
        <TabsContent value="broadcast">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" /> Send Message to Customers
              </CardTitle>
              <CardDescription>
                Broadcast announcements, collection alerts, or custom messages directly to your assigned customer base.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="msgTitle">Notification Title *</Label>
                <Input
                  id="msgTitle"
                  placeholder="e.g. Monthly Due Payment Reminder"
                  value={msgTitle}
                  onChange={(e) => setMsgTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="msgBody">Message Content *</Label>
                <textarea
                  id="msgBody"
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Type your message to customers..."
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => broadcastMutation.mutate()}
                  disabled={broadcastMutation.isPending || !msgTitle || !msgBody}
                  className="gap-2 px-6"
                >
                  <Send className="w-4 h-4" />
                  {broadcastMutation.isPending ? "Sending..." : "Send Broadcast"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Agent KYC */}
        <TabsContent value="kyc">
          <KycSubmissionForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KycStatusBadge } from "./KycStatusBadge";
import { ShieldCheck, Upload, CreditCard, Building2, UserCheck, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function KycSubmissionForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["kyc-me"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/kyc/me", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch KYC data");
      return res.json();
    },
  });

  const kyc = data?.kyc;
  const status = data?.status || "not_submitted";

  const [aadhaarNumber, setAadhaarNumber] = useState(kyc?.aadhaarNumber || "");
  const [panNumber, setPanNumber] = useState(kyc?.panNumber || "");
  const [bankAccountNo, setBankAccountNo] = useState(kyc?.bankAccountNo || "");
  const [bankIfsc, setBankIfsc] = useState(kyc?.bankIfsc || "");
  const [bankName, setBankName] = useState(kyc?.bankName || "");
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState(kyc?.aadhaarFrontUrl || "");
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState(kyc?.aadhaarBackUrl || "");
  const [panCardUrl, setPanCardUrl] = useState(kyc?.panCardUrl || "");
  const [selfieUrl, setSelfieUrl] = useState(kyc?.selfieUrl || "");

  // Update local state when query finishes loading
  React.useEffect(() => {
    if (kyc) {
      setAadhaarNumber(kyc.aadhaarNumber || "");
      setPanNumber(kyc.panNumber || "");
      setBankAccountNo(kyc.bankAccountNo || "");
      setBankIfsc(kyc.bankIfsc || "");
      setBankName(kyc.bankName || "");
      setAadhaarFrontUrl(kyc.aadhaarFrontUrl || "");
      setAadhaarBackUrl(kyc.aadhaarBackUrl || "");
      setPanCardUrl(kyc.panCardUrl || "");
      setSelfieUrl(kyc.selfieUrl || "");
    }
  }, [kyc]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          aadhaarNumber,
          panNumber,
          bankAccountNo,
          bankIfsc,
          bankName,
          aadhaarFrontUrl,
          aadhaarBackUrl,
          panCardUrl,
          selfieUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "KYC Documents Submitted",
        description: "Your verification request has been sent to admin for review.",
      });
      queryClient.invalidateQueries({ queryKey: ["kyc-me"] });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: err.message || "Failed to submit KYC",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20" />
          <div className="h-4 w-40 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-primary/10">
      <CardHeader className="bg-muted/30 pb-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">KYC Verification</CardTitle>
              <CardDescription>Verify your identity and bank details for secure transactions</CardDescription>
            </div>
          </div>
          <KycStatusBadge status={status} />
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {status === "rejected" && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Verification Rejected</p>
              <p className="text-sm opacity-90">{kyc?.rejectionReason || "Please check your document details and resubmit."}</p>
            </div>
          </div>
        )}

        {status === "approved" && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">KYC Verification Completed</p>
              <p className="text-sm opacity-90">Your account is fully verified. You can update your bank details below if needed.</p>
            </div>
          </div>
        )}

        {/* Identity Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> Identity Documents
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aadhaar">Aadhaar Number (12 Digits)</Label>
              <Input
                id="aadhaar"
                placeholder="e.g. 1234 5678 9012"
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(e.target.value)}
                disabled={status === "approved"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pan">PAN Card Number (10 Characters)</Label>
              <Input
                id="pan"
                placeholder="e.g. ABCDE1234F"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                disabled={status === "approved"}
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Bank Account Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                placeholder="e.g. State Bank of India"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNo">Account Number</Label>
              <Input
                id="accountNo"
                placeholder="Account No."
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ifsc">IFSC Code</Label>
              <Input
                id="ifsc"
                placeholder="e.g. SBIN0001234"
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </div>

        {/* Document URLs / Photo Attachments */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" /> Document Attachments / Photo URLs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aadhaarFront">Aadhaar Card Front (Image URL)</Label>
              <Input
                id="aadhaarFront"
                placeholder="https://..."
                value={aadhaarFrontUrl}
                onChange={(e) => setAadhaarFrontUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aadhaarBack">Aadhaar Card Back (Image URL)</Label>
              <Input
                id="aadhaarBack"
                placeholder="https://..."
                value={aadhaarBackUrl}
                onChange={(e) => setAadhaarBackUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="panCard">PAN Card (Image URL)</Label>
              <Input
                id="panCard"
                placeholder="https://..."
                value={panCardUrl}
                onChange={(e) => setPanCardUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="selfie">Selfie / Photo (Image URL)</Label>
              <Input
                id="selfie"
                placeholder="https://..."
                value={selfieUrl}
                onChange={(e) => setSelfieUrl(e.target.value)}
              />
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-muted/20 border-t px-6 py-4 flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          All data is encrypted and used strictly for identity verification.
        </p>
        <Button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending}
          className="gap-2"
        >
          {submitMutation.isPending ? "Submitting..." : status === "approved" ? "Update Details" : "Submit KYC Request"}
        </Button>
      </CardFooter>
    </Card>
  );
}

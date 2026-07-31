import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KycStatusBadge } from "./KycStatusBadge";
import { ShieldCheck, Upload, AlertTriangle, CheckCircle, Camera, Image as ImageIcon, FileCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface KycSubmissionFormProps {
  customerId?: number;
  userName?: string;
  userMobile?: string;
  onSuccessCallback?: () => void;
}

export function KycSubmissionForm({ customerId, userName, userMobile, onSuccessCallback }: KycSubmissionFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["kyc-status", customerId, userMobile],
    queryFn: async () => {
      const query = customerId ? `customerId=${customerId}` : userMobile ? `mobile=${encodeURIComponent(userMobile)}` : "";
      const res = await fetch(`/api/kyc/me?${query}`);
      if (!res.ok) throw new Error("Failed to fetch KYC data");
      return res.json();
    },
  });

  const kyc = data?.kyc;
  const status = data?.status || "not_submitted";

  const [aadhaarNumber, setAadhaarNumber] = useState(kyc?.aadhaarNumber || "");
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState(kyc?.aadhaarFrontUrl || "");
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState(kyc?.aadhaarBackUrl || "");

  React.useEffect(() => {
    if (kyc) {
      setAadhaarNumber(kyc.aadhaarNumber || "");
      setAadhaarFrontUrl(kyc.aadhaarFrontUrl || "");
      setAadhaarBackUrl(kyc.aadhaarBackUrl || "");
    }
  }, [kyc]);

  // Handle image file selection (converts image file to Base64 data URL)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: "front" | "back") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Image size must be under 8MB" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (side === "front") setAadhaarFrontUrl(base64);
      else setAadhaarBackUrl(base64);
      toast({ title: `Aadhaar ${side === "front" ? "Front" : "Back"} Photo Uploaded` });
    };
    reader.readAsDataURL(file);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!aadhaarNumber || aadhaarNumber.replace(/\D/g, "").length < 12) {
        throw new Error("Please enter a valid 12-digit Aadhaar Card Number");
      }
      if (!aadhaarFrontUrl) {
        throw new Error("Please upload or attach Aadhaar Card Front Photo");
      }
      if (!aadhaarBackUrl) {
        throw new Error("Please upload or attach Aadhaar Card Back Photo");
      }

      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          userName: userName || "Customer",
          userMobile: userMobile || "",
          userRole: "customer",
          aadhaarNumber,
          aadhaarFrontUrl,
          aadhaarBackUrl,
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
        title: "Aadhaar KYC Submitted 🎉",
        description: "Your Aadhaar verification request has been sent for approval.",
      });
      queryClient.invalidateQueries({ queryKey: ["kyc-status"] });
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "KYC Submission Error",
        description: err.message || "Failed to submit Aadhaar KYC",
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
    <Card className="shadow-lg border border-primary/10 bg-card">
      <CardHeader className="bg-muted/30 pb-5 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Aadhaar Card KYC Verification</CardTitle>
              <CardDescription className="text-xs">Upload Aadhaar card front & back photos for identity verification</CardDescription>
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
              <p className="font-semibold text-sm">Verification Rejected</p>
              <p className="text-xs opacity-90">{kyc?.rejectionReason || "Please upload clear photos of your Aadhaar card and resubmit."}</p>
            </div>
          </div>
        )}

        {status === "approved" && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Aadhaar KYC Verification Verified ✓</p>
              <p className="text-xs opacity-90">Your Aadhaar card has been verified successfully.</p>
            </div>
          </div>
        )}

        {/* Aadhaar Number Input */}
        <div className="space-y-2">
          <Label htmlFor="aadhaar" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-primary" /> Aadhaar Card Number (12 Digits)
          </Label>
          <Input
            id="aadhaar"
            placeholder="e.g. 1234 5678 9012"
            value={aadhaarNumber}
            maxLength={14}
            onChange={(e) => setAadhaarNumber(e.target.value)}
            disabled={status === "approved"}
            className="font-mono font-bold text-base h-11"
          />
        </div>

        {/* Aadhaar Card Photos Upload (Front & Back) */}
        <div className="space-y-4 pt-2 border-t">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" /> Aadhaar Card Photos (Front & Back Image Only)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Front Photo Picker */}
            <div className="p-4 border-2 border-dashed rounded-xl border-muted-foreground/20 hover:border-primary/50 transition-colors bg-muted/10 flex flex-col items-center justify-center text-center space-y-3">
              {aadhaarFrontUrl ? (
                <div className="w-full space-y-2">
                  <div className="relative aspect-video rounded-lg overflow-hidden border bg-background flex items-center justify-center">
                    <img src={aadhaarFrontUrl} alt="Aadhaar Front" className="object-contain max-h-40 w-full" />
                  </div>
                  <Label htmlFor="front-file" className="cursor-pointer text-xs text-primary hover:underline font-semibold block text-center">
                    Change Front Photo
                  </Label>
                </div>
              ) : (
                <>
                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Aadhaar Card FRONT Photo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Take photo or upload image file</p>
                  </div>
                  <Label htmlFor="front-file" className="cursor-pointer">
                    <Button variant="outline" size="sm" type="button" className="pointer-events-none gap-1.5 text-xs font-semibold">
                      <Upload className="w-3.5 h-3.5" /> Choose / Take Photo
                    </Button>
                  </Label>
                </>
              )}
              <input
                id="front-file"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={status === "approved"}
                onChange={(e) => handleFileChange(e, "front")}
              />
            </div>

            {/* Back Photo Picker */}
            <div className="p-4 border-2 border-dashed rounded-xl border-muted-foreground/20 hover:border-primary/50 transition-colors bg-muted/10 flex flex-col items-center justify-center text-center space-y-3">
              {aadhaarBackUrl ? (
                <div className="w-full space-y-2">
                  <div className="relative aspect-video rounded-lg overflow-hidden border bg-background flex items-center justify-center">
                    <img src={aadhaarBackUrl} alt="Aadhaar Back" className="object-contain max-h-40 w-full" />
                  </div>
                  <Label htmlFor="back-file" className="cursor-pointer text-xs text-primary hover:underline font-semibold block text-center">
                    Change Back Photo
                  </Label>
                </div>
              ) : (
                <>
                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Aadhaar Card BACK Photo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Take photo or upload image file</p>
                  </div>
                  <Label htmlFor="back-file" className="cursor-pointer">
                    <Button variant="outline" size="sm" type="button" className="pointer-events-none gap-1.5 text-xs font-semibold">
                      <Upload className="w-3.5 h-3.5" /> Choose / Take Photo
                    </Button>
                  </Label>
                </>
              )}
              <input
                id="back-file"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={status === "approved"}
                onChange={(e) => handleFileChange(e, "back")}
              />
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-muted/20 border-t px-6 py-4 flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          Only Aadhaar Card photo is required for KYC.
        </p>
        <Button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending || status === "approved"}
          className="gap-2 font-bold"
        >
          {submitMutation.isPending ? "Submitting..." : status === "approved" ? "Verified ✓" : "Submit Aadhaar KYC"}
        </Button>
      </CardFooter>
    </Card>
  );
}

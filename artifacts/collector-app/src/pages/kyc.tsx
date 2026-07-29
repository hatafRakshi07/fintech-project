import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStoredToken } from "@/lib/api";
import { ShieldCheck, CheckCircle2, Clock, Camera, Upload, Image as ImageIcon } from "lucide-react";
import Header from "@/components/Header";

export default function CollectorKycPage() {
  const queryClient = useQueryClient();
  const token = getStoredToken();

  const { data } = useQuery({
    queryKey: ["collector-kyc"],
    queryFn: async () => {
      const res = await fetch("/api/kyc/me", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch KYC");
      return res.json();
    },
  });

  const kyc = data?.kyc;
  const status = data?.status || "not_submitted";

  const [aadhaarNumber, setAadhaarNumber] = useState(kyc?.aadhaarNumber || "");
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState(kyc?.aadhaarFrontUrl || "");
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState(kyc?.aadhaarBackUrl || "");
  const [message, setMessage] = useState("");

  React.useEffect(() => {
    if (kyc) {
      setAadhaarNumber(kyc.aadhaarNumber || "");
      setAadhaarFrontUrl(kyc.aadhaarFrontUrl || "");
      setAadhaarBackUrl(kyc.aadhaarBackUrl || "");
    }
  }, [kyc]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: "front" | "back") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (side === "front") setAadhaarFrontUrl(base64);
      else setAadhaarBackUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!aadhaarNumber || aadhaarNumber.replace(/\D/g, "").length < 12) {
        throw new Error("Enter valid 12-digit Aadhaar Card Number");
      }
      if (!aadhaarFrontUrl || !aadhaarBackUrl) {
        throw new Error("Please upload both Aadhaar Front & Back photos");
      }

      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userRole: "collector",
          userName: "Collector Staff",
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
      setMessage("Aadhaar KYC submitted successfully! Pending admin approval.");
      queryClient.invalidateQueries({ queryKey: ["collector-kyc"] });
    },
    onError: (err: any) => {
      setMessage(`Error: ${err.message || "Failed to submit"}`);
    },
  });

  return (
    <>
      <Header title="KYC Verification" />

      <div className="p-4 space-y-5 max-w-lg mx-auto float-up">
        {/* Banner */}
        <div
          className="p-5 rounded-2xl relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(212, 160, 23, 0.15) 0%, rgba(20, 10, 8, 0.05) 50%, rgba(20, 10, 8, 0.02) 100%)",
            border: "1px solid rgba(212, 160, 23, 0.25)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/15 rounded-xl border border-amber-500/20">
              <ShieldCheck className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-foreground dark:text-white">Collector Aadhaar KYC</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Upload Aadhaar card front & back photos</p>
            </div>
          </div>
        </div>

        {status === "approved" && (
          <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 flex items-center gap-2.5 text-xs font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            Collector Aadhaar KYC is verified and active.
          </div>
        )}

        {status === "pending" && (
          <div className="p-4 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 flex items-center gap-2.5 text-xs font-semibold">
            <Clock className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
            Aadhaar KYC application under review by office admins.
          </div>
        )}

        {message && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-550 dark:text-amber-400 rounded-xl text-xs font-medium">
            {message}
          </div>
        )}

        <div className="glass-card rounded-2xl p-5 space-y-4 bg-card">
          <h3 className="text-xs font-extrabold text-foreground dark:text-white flex items-center gap-2 border-b border-border dark:border-slate-700/40 pb-2.5 uppercase tracking-wider">
            <Camera className="w-4 h-4 text-amber-500 dark:text-amber-400" /> Aadhaar Verification
          </h3>
          
          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
              Aadhaar Number (12 digits)
            </label>
            <input
              className="w-full px-3 h-10 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white rounded-lg text-sm font-mono focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              placeholder="1234 5678 9012"
              maxLength={14}
              value={aadhaarNumber}
              disabled={status === "approved"}
              onChange={(e) => setAadhaarNumber(e.target.value)}
            />
          </div>

          {/* Photo Pickers */}
          <div className="space-y-3 pt-2">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">
              Aadhaar Card Photos (Front & Back)
            </label>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Front */}
              <label className="cursor-pointer border border-dashed border-amber-500/30 rounded-xl p-3 flex flex-col items-center justify-center text-center bg-slate-100 dark:bg-slate-800/30 hover:border-amber-500/60 transition-all">
                {aadhaarFrontUrl ? (
                  <img src={aadhaarFrontUrl} alt="Front" className="max-h-24 object-contain rounded" />
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-amber-500 mb-1" />
                    <span className="text-[11px] font-bold text-foreground">Front Photo</span>
                    <span className="text-[9px] text-slate-400">Tap to Take/Upload</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={status === "approved"}
                  onChange={(e) => handleFileChange(e, "front")}
                />
              </label>

              {/* Back */}
              <label className="cursor-pointer border border-dashed border-amber-500/30 rounded-xl p-3 flex flex-col items-center justify-center text-center bg-slate-100 dark:bg-slate-800/30 hover:border-amber-500/60 transition-all">
                {aadhaarBackUrl ? (
                  <img src={aadhaarBackUrl} alt="Back" className="max-h-24 object-contain rounded" />
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-amber-500 mb-1" />
                    <span className="text-[11px] font-bold text-foreground">Back Photo</span>
                    <span className="text-[9px] text-slate-400">Tap to Take/Upload</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={status === "approved"}
                  onChange={(e) => handleFileChange(e, "back")}
                />
              </label>
            </div>
          </div>

          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || status === "approved"}
            className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
          >
            {submitMutation.isPending ? "Submitting..." : status === "approved" ? "Verified ✓" : "Submit Aadhaar KYC"}
          </button>
        </div>
      </div>
    </>
  );
}

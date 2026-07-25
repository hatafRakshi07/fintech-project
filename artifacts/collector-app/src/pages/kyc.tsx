import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStoredToken } from "@/lib/api";
import { ShieldCheck, CreditCard, Building2, CheckCircle2, Clock } from "lucide-react";
import Header from "@/components/Header";

export default function CollectorKycPage() {
  const queryClient = useQueryClient();
  const token = getStoredToken();

  const { data, isLoading } = useQuery({
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
  const [panNumber, setPanNumber] = useState(kyc?.panNumber || "");
  const [bankAccountNo, setBankAccountNo] = useState(kyc?.bankAccountNo || "");
  const [bankIfsc, setBankIfsc] = useState(kyc?.bankIfsc || "");
  const [bankName, setBankName] = useState(kyc?.bankName || "");
  const [aadhaarFrontUrl] = useState(kyc?.aadhaarFrontUrl || "");
  const [aadhaarBackUrl] = useState(kyc?.aadhaarBackUrl || "");
  const [panCardUrl] = useState(kyc?.panCardUrl || "");
  const [selfieUrl] = useState(kyc?.selfieUrl || "");

  const [message, setMessage] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => {
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
      setMessage("KYC details submitted successfully! Pending admin approval.");
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
              <h2 className="text-lg font-extrabold text-foreground dark:text-white">Collector KYC Verification</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Submit your identity & bank verification</p>
            </div>
          </div>
        </div>

        {status === "approved" && (
          <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 flex items-center gap-2.5 text-xs font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            Your Collector KYC is verified and active.
          </div>
        )}

        {status === "pending" && (
          <div className="p-4 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 flex items-center gap-2.5 text-xs font-semibold">
            <Clock className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
            KYC application under review by office admins.
          </div>
        )}

        {message && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-550 dark:text-amber-400 rounded-xl text-xs font-medium">
            {message}
          </div>
        )}

        <div className="glass-card rounded-2xl p-5 space-y-4 bg-card">
          <h3 className="text-xs font-extrabold text-foreground dark:text-white flex items-center gap-2 border-b border-border dark:border-slate-700/40 pb-2.5 uppercase tracking-wider">
            <CreditCard className="w-4 h-4 text-amber-500 dark:text-amber-400" /> Identity Details
          </h3>
          
          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
              Aadhaar Number (12 digits)
            </label>
            <input
              className="w-full px-3 h-10 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              placeholder="1234 5678 9012"
              value={aadhaarNumber}
              onChange={(e) => setAadhaarNumber(e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
              PAN Card Number
            </label>
            <input
              className="w-full px-3 h-10 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              placeholder="ABCDE1234F"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
            />
          </div>

          <h3 className="text-xs font-extrabold text-foreground dark:text-white flex items-center gap-2 border-b border-border dark:border-slate-700/40 pb-2.5 pt-2 uppercase tracking-wider">
            <Building2 className="w-4 h-4 text-amber-500 dark:text-amber-400" /> Bank Details
          </h3>
          
          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
              Bank Name
            </label>
            <input
              className="w-full px-3 h-10 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              placeholder="State Bank of India"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
                Account No.
              </label>
              <input
                className="w-full px-3 h-10 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                placeholder="Account No."
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
                IFSC Code
              </label>
              <input
                className="w-full px-3 h-10 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                placeholder="SBIN0001234"
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-550 text-slate-950 font-extrabold py-3 rounded-xl shadow-lg shadow-amber-500/20 text-xs transition-all active:scale-[0.98] mt-4"
          >
            {submitMutation.isPending ? "Submitting..." : "Submit KYC Request"}
          </button>
        </div>
      </div>
    </>
  );
}

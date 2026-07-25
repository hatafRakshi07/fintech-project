import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStoredToken } from "@/lib/api";
import { ShieldCheck, Upload, CreditCard, Building2, CheckCircle2, Clock, XCircle } from "lucide-react";

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
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState(kyc?.aadhaarFrontUrl || "");
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState(kyc?.aadhaarBackUrl || "");
  const [panCardUrl, setPanCardUrl] = useState(kyc?.panCardUrl || "");
  const [selfieUrl, setSelfieUrl] = useState(kyc?.selfieUrl || "");

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
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-5 rounded-2xl shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/20 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Collector KYC Verification</h1>
            <p className="text-xs text-blue-100">Submit your identity & bank verification</p>
          </div>
        </div>
      </div>

      {status === "approved" && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          Your Collector KYC is verified and active.
        </div>
      )}

      {status === "pending" && (
        <div className="p-4 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 flex items-center gap-2 text-sm font-medium">
          <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
          KYC application under review by office admins.
        </div>
      )}

      {message && (
        <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-xs font-medium">{message}</div>
      )}

      <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2 border-b pb-2">
          <CreditCard className="w-4 h-4 text-blue-600" /> Identity Details
        </h3>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Aadhaar Number (12 digits)</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="1234 5678 9012"
            value={aadhaarNumber}
            onChange={(e) => setAadhaarNumber(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">PAN Card Number</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="ABCDE1234F"
            value={panNumber}
            onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
          />
        </div>

        <h3 className="text-sm font-bold flex items-center gap-2 border-b pb-2 pt-2">
          <Building2 className="w-4 h-4 text-blue-600" /> Bank Details
        </h3>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Bank Name</label>
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="Bank Name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Account No.</label>
            <input
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Account No."
              value={bankAccountNo}
              onChange={(e) => setBankAccountNo(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">IFSC Code</label>
            <input
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="IFSC"
              value={bankIfsc}
              onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        <button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl shadow-sm text-sm mt-4"
        >
          {submitMutation.isPending ? "Submitting..." : "Submit KYC Request"}
        </button>
      </div>
    </div>
  );
}

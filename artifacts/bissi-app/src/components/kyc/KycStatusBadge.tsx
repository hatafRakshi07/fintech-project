import React from "react";
import { CheckCircle2, Clock, XCircle, AlertCircle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface KycStatusBadgeProps {
  status?: "pending" | "under_review" | "approved" | "rejected" | "not_submitted" | string;
  showIcon?: boolean;
}

export function KycStatusBadge({ status = "not_submitted", showIcon = true }: KycStatusBadgeProps) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 px-3 py-1 font-medium">
          {showIcon && <CheckCircle2 className="w-3.5 h-3.5" />}
          KYC Verified
        </Badge>
      );
    case "pending":
    case "under_review":
      return (
        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1.5 px-3 py-1 font-medium">
          {showIcon && <Clock className="w-3.5 h-3.5 animate-pulse" />}
          Verification Pending
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1.5 px-3 py-1 font-medium">
          {showIcon && <XCircle className="w-3.5 h-3.5" />}
          KYC Rejected
        </Badge>
      );
    case "not_submitted":
    default:
      return (
        <Badge className="bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30 gap-1.5 px-3 py-1 font-medium">
          {showIcon && <AlertCircle className="w-3.5 h-3.5" />}
          KYC Not Submitted
        </Badge>
      );
  }
}

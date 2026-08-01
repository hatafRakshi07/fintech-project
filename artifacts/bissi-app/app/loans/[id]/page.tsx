'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import LoanDetailPage from "@/views/loans/[id]";

export default function Page() {
  return (
    <Shell>
      <LoanDetailPage />
    </Shell>
  );
}

'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import CashbookPage from "@/pages/ledgers/cashbook";

export default function Page() {
  return (
    <Shell>
      <CashbookPage />
    </Shell>
  );
}

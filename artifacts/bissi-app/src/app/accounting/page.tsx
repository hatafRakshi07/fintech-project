'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import AccountingPage from "@/views/accounting";

export default function Page() {
  return (
    <Shell>
      <AccountingPage />
    </Shell>
  );
}

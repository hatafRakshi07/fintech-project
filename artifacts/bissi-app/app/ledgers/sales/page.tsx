'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import SalesLedgerPage from "@/views/ledgers/sales";

export default function Page() {
  return (
    <Shell>
      <SalesLedgerPage />
    </Shell>
  );
}

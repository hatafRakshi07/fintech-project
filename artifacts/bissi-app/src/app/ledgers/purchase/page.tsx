'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import PurchaseLedgerPage from "@/views/ledgers/purchase";

export default function Page() {
  return (
    <Shell>
      <PurchaseLedgerPage />
    </Shell>
  );
}

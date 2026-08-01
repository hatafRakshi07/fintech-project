'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import InvoicesPage from "@/pages/invoices";

export default function Page() {
  return (
    <Shell>
      <InvoicesPage />
    </Shell>
  );
}

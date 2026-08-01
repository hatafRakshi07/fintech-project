'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import CustomerDetailPage from "@/pages/customers/[id]";

export default function Page() {
  return (
    <Shell>
      <CustomerDetailPage />
    </Shell>
  );
}

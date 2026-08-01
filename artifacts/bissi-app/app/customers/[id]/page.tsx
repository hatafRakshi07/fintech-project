'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import CustomerDetailPage from "@/views/customers/[id]";

export default function Page() {
  return (
    <Shell>
      <CustomerDetailPage />
    </Shell>
  );
}

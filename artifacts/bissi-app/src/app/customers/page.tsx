'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import CustomersPage from "@/views/customers";

export default function Page() {
  return (
    <Shell>
      <CustomersPage />
    </Shell>
  );
}

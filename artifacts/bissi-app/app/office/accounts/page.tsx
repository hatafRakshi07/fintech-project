'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import BankAccountsPage from "@/views/office/accounts";

export default function Page() {
  return (
    <Shell>
      <BankAccountsPage />
    </Shell>
  );
}

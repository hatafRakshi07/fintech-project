'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import BankAccountsPage from "@/pages/office/accounts";

export default function Page() {
  return (
    <Shell>
      <BankAccountsPage />
    </Shell>
  );
}

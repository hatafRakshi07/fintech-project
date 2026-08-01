'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import BranchDetailPage from "@/pages/branches/[id]";

export default function Page() {
  return (
    <Shell>
      <BranchDetailPage />
    </Shell>
  );
}

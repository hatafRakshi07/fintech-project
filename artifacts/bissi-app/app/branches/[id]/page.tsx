'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import BranchDetailPage from "@/views/branches/[id]";

export default function Page() {
  return (
    <Shell>
      <BranchDetailPage />
    </Shell>
  );
}

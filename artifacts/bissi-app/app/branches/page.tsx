'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import BranchesPage from "@/views/branches";

export default function Page() {
  return (
    <Shell>
      <BranchesPage />
    </Shell>
  );
}

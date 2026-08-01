'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import CommitteeDetailPage from "@/pages/committees/[id]";

export default function Page() {
  return (
    <Shell>
      <CommitteeDetailPage />
    </Shell>
  );
}

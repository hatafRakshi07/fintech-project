'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import CommitteesPage from "@/views/committees";

export default function Page() {
  return (
    <Shell>
      <CommitteesPage />
    </Shell>
  );
}

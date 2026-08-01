'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import CollectorDetailPage from "@/views/collectors/[id]";

export default function Page() {
  return (
    <Shell>
      <CollectorDetailPage />
    </Shell>
  );
}

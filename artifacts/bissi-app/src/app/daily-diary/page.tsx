'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import DailyDiaryDashboard from "@/views/daily-diary/index";

export default function Page() {
  return (
    <Shell>
      <DailyDiaryDashboard />
    </Shell>
  );
}

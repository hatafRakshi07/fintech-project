'use client';

import React from "react";
import { Shell } from "@/components/layout/Shell";
import DashboardPage from "@/views/dashboard";

export default function Home() {
  return (
    <Shell>
      <DashboardPage />
    </Shell>
  );
}

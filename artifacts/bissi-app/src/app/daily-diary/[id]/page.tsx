import React from "react";
import { Shell } from "@/components/layout/Shell";
import DailyDiaryCustomerDetail from "@/views/daily-diary/[id]";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function Page() {
  return (
    <Shell>
      <DailyDiaryCustomerDetail />
    </Shell>
  );
}

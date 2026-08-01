import React from "react";
import { Shell } from "@/components/layout/Shell";
import LoanDetailPage from "@/views/loans/[id]";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function Page() {
  return (
    <Shell>
      <LoanDetailPage />
    </Shell>
  );
}

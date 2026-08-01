import React from "react";
import { Shell } from "@/components/layout/Shell";
import BranchDetailPage from "@/views/branches/[id]";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function Page() {
  return (
    <Shell>
      <BranchDetailPage />
    </Shell>
  );
}

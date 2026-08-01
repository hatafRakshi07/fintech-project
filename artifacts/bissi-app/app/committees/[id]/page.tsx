import React from "react";
import { Shell } from "@/components/layout/Shell";
import CommitteeDetailPage from "@/views/committees/[id]";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function Page() {
  return (
    <Shell>
      <CommitteeDetailPage />
    </Shell>
  );
}

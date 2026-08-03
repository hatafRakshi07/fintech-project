import React from "react";
import { Shell } from "@/components/layout/Shell";
import CustomerDetailPage from "@/views/customers/[id]";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function Page() {
  return (
    <Shell>
      <CustomerDetailPage />
    </Shell>
  );
}

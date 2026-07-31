import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-9xl font-bold text-primary/20 mb-4">404</div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Page not found</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link href="/">
        <Button size="lg">Return to Dashboard</Button>
      </Link>
    </div>
  );
}

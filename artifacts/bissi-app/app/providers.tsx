'use client';

import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error: any) => {
          if (error?.status === 401 || error?.response?.status === 401) return false;
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
      },
    },
  }));

  useEffect(() => {
    // Set API Base URL
    setBaseUrl("/api");

    // Register token getter
    setAuthTokenGetter(() => typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null);

    // Pre-set demo presentation token if missing
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem("auth_token")) {
        localStorage.setItem("auth_token", "demo-presentation-token");
      }
      if (!localStorage.getItem("collector_token")) {
        localStorage.setItem("collector_token", "demo-presentation-token");
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

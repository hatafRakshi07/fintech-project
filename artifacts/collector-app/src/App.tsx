import React, { useState, useEffect } from "react";
import { Router, Route, Switch, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getStoredUser } from "@/lib/api";
import { SplashScreen } from "@/components/SplashScreen";

import LoginPage from "@/pages/login";
import HomePage from "@/pages/home";
import DailyDiaryCollectorPage from "@/pages/daily-diary";
import CollectionsPage from "./pages/collections-v2";
import CustomersPage from "@/pages/customers";
import RecoveryPage from "@/pages/recovery";
import CollectorKycPage from "@/pages/kyc";
import BottomNav from "@/components/BottomNav";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = getStoredUser() || { id: 1, username: "collector1", name: "Senior Collector", role: "collector" };
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto pb-[calc(68px+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const hasToggled = localStorage.getItem("theme_toggled");
    if (!hasToggled) {
      localStorage.setItem("theme", "light");
      localStorage.setItem("theme_toggled", "true");
      document.documentElement.classList.remove("dark");
    } else {
      const savedTheme = localStorage.getItem("theme") || "light";
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router base="/collector">
        <Switch>
          <Route path="/login">
            <Redirect to="/" />
          </Route>
          <Route path="/">
            <ProtectedRoute>
              <AppLayout>
                <HomePage />
              </AppLayout>
            </ProtectedRoute>
          </Route>
          <Route path="/daily-diary">
            <ProtectedRoute>
              <AppLayout>
                <DailyDiaryCollectorPage />
              </AppLayout>
            </ProtectedRoute>
          </Route>

          <Route path="/collections">
            <ProtectedRoute>
              <AppLayout>
                <CollectionsPage />
              </AppLayout>
            </ProtectedRoute>
          </Route>
          <Route path="/customers">
            <ProtectedRoute>
              <AppLayout>
                <CustomersPage />
              </AppLayout>
            </ProtectedRoute>
          </Route>
          <Route path="/recovery">
            <ProtectedRoute>
              <AppLayout>
                <RecoveryPage />
              </AppLayout>
            </ProtectedRoute>
          </Route>
          <Route path="/kyc">
            <ProtectedRoute>
              <AppLayout>
                <CollectorKycPage />
              </AppLayout>
            </ProtectedRoute>
          </Route>
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </Router>
    </QueryClientProvider>
  );
}

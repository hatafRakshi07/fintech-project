import React from "react";
import { Router, Route, Switch, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getStoredUser } from "@/lib/api";

import LoginPage from "@/pages/login";
import HomePage from "@/pages/home";
import CollectionsPage from "@/pages/collections";
import CustomersPage from "@/pages/customers";
import RecoveryPage from "@/pages/recovery";
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
  const user = getStoredUser();
  const [location] = useLocation();

  if (!user && location !== "/login") {
    return <Redirect to="/login" />;
  }
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto pb-[calc(64px+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router base="/collector">
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/">
            <ProtectedRoute>
              <AppLayout>
                <HomePage />
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
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </Router>
    </QueryClientProvider>
  );
}

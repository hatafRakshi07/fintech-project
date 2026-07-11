import React, { useState } from "react";
import { Route, Switch, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useRole, type UserRole } from "@/hooks/use-role";
import { SplashScreen } from "@/components/SplashScreen";

// Register localStorage auth token getter for all API requests
setAuthTokenGetter(() => localStorage.getItem("auth_token"));

// Pages
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customers/[id]";
import BranchesPage from "@/pages/branches";
import BranchDetailPage from "@/pages/branches/[id]";
import CollectorsPage from "@/pages/collectors";
import CollectorDetailPage from "@/pages/collectors/[id]";
import CommitteesPage from "@/pages/committees";
import CommitteeDetailPage from "@/pages/committees/[id]";
import TokensPage from "@/pages/tokens";
import LoansPage from "@/pages/loans";
import LoanDetailPage from "@/pages/loans/[id]";
import CollectionsPage from "@/pages/collections";
import LotteriesPage from "@/pages/lotteries";
import ReportsPage from "@/pages/reports";
import GiftsPage from "@/pages/gifts";
import InterestsPage from "@/pages/interests";
import RecoveryPage from "@/pages/recovery";
import OfficePage from "@/pages/office";
import ImportPage from "@/pages/import";
import NotFound from "@/pages/not-found";
import { Shell } from "@/components/layout/Shell";

/**
 * Wraps a route so that only users with one of the given roles can access it.
 * Anyone else is silently redirected to "/".
 */
function RoleGate({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { role } = useRole();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (role && !roles.includes(role)) {
      setLocation("/");
    }
  }, [role, roles, setLocation]);

  if (!role || !roles.includes(role)) return null;
  return <>{children}</>;
}

const ADMINS: UserRole[]          = ["super_admin", "owner"];
const MANAGERS: UserRole[]        = ["super_admin", "owner", "branch_manager"];
const FINANCE: UserRole[]         = ["super_admin", "owner", "branch_manager", "accountant"];
const COLLECTOR_UP: UserRole[]    = ["super_admin", "owner", "branch_manager", "collector"];
const CUSTOMER_SELF: UserRole[]   = ["super_admin", "owner", "branch_manager", "accountant", "customer"];
const ALL_EXCEPT_CUSTOMER: UserRole[] = ["super_admin", "owner", "branch_manager", "collector", "accountant"];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const [location] = useLocation();

  // Login page renders outside Shell
  if (location === "/login") {
    return <LoginPage />;
  }

  return (
    <Shell>
      <Switch>
        <Route path="/" component={DashboardPage} />

            {/* Customers — all except pure customer role */}
            <Route path="/customers">
              <RoleGate roles={COLLECTOR_UP}>
                <CustomersPage />
              </RoleGate>
            </Route>
            <Route path="/customers/:id">
              {() => (
                <RoleGate roles={COLLECTOR_UP}>
                  <CustomerDetailPage />
                </RoleGate>
              )}
            </Route>

            {/* Branches — admins only */}
            <Route path="/branches">
              <RoleGate roles={ADMINS}>
                <BranchesPage />
              </RoleGate>
            </Route>
            <Route path="/branches/:id">
              {() => (
                <RoleGate roles={ADMINS}>
                  <BranchDetailPage />
                </RoleGate>
              )}
            </Route>

            {/* Collectors — managers and above */}
            <Route path="/collectors">
              <RoleGate roles={MANAGERS}>
                <CollectorsPage />
              </RoleGate>
            </Route>
            <Route path="/collectors/:id">
              {() => (
                <RoleGate roles={MANAGERS}>
                  <CollectorDetailPage />
                </RoleGate>
              )}
            </Route>

            {/* Committees & tokens — managers and above */}
            <Route path="/committees">
              <RoleGate roles={MANAGERS}>
                <CommitteesPage />
              </RoleGate>
            </Route>
            <Route path="/committees/:id">
              {() => (
                <RoleGate roles={MANAGERS}>
                  <CommitteeDetailPage />
                </RoleGate>
              )}
            </Route>
            <Route path="/tokens">
              <RoleGate roles={[...MANAGERS, "customer"]}>
                <TokensPage />
              </RoleGate>
            </Route>

            {/* Loans — finance roles + customers (own data) */}
            <Route path="/loans">
              <RoleGate roles={[...FINANCE, "customer"]}>
                <LoansPage />
              </RoleGate>
            </Route>
            <Route path="/loans/:id">
              {() => (
                <RoleGate roles={[...FINANCE, "customer"]}>
                  <LoanDetailPage />
                </RoleGate>
              )}
            </Route>

            {/* Collections — everyone authenticated */}
            <Route path="/collections" component={CollectionsPage} />

            {/* Lotteries — managers and above */}
            <Route path="/lotteries">
              <RoleGate roles={MANAGERS}>
                <LotteriesPage />
              </RoleGate>
            </Route>

            {/* Reports — finance roles */}
            <Route path="/reports">
              <RoleGate roles={FINANCE}>
                <ReportsPage />
              </RoleGate>
            </Route>

            {/* Gifts — finance roles */}
            <Route path="/gifts">
              <RoleGate roles={FINANCE}>
                <GiftsPage />
              </RoleGate>
            </Route>

            {/* Interests — finance roles */}
            <Route path="/interests">
              <RoleGate roles={FINANCE}>
                <InterestsPage />
              </RoleGate>
            </Route>

            {/* Recovery — collectors and above */}
            <Route path="/recovery">
              <RoleGate roles={[...FINANCE, "collector"]}>
                <RecoveryPage />
              </RoleGate>
            </Route>

            {/* Office — managers and above */}
            <Route path="/office">
              <RoleGate roles={FINANCE}>
                <OfficePage />
              </RoleGate>
            </Route>

            {/* Import — managers only */}
            <Route path="/import">
              <RoleGate roles={MANAGERS}>
                <ImportPage />
              </RoleGate>
            </Route>

        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  // Show splash only once per session
  const [showSplash, setShowSplash] = useState(
    () => !sessionStorage.getItem("ska_splash_done")
  );

  function handleSplashDone() {
    sessionStorage.setItem("ska_splash_done", "1");
    setShowSplash(false);
  }

  if (showSplash) {
    return <SplashScreen onDone={handleSplashDone} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

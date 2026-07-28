import React, { useState } from "react";
import { Route, Switch, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useRole, type UserRole } from "@/hooks/use-role";
import { SplashScreen } from "@/components/SplashScreen";

// Register localStorage auth token getter for all API requests
setAuthTokenGetter(() => localStorage.getItem("auth_token"));

// Pages
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
import GiftsPage from "@/pages/gifts";
import InterestsPage from "@/pages/interests";
import RecoveryPage from "@/pages/recovery";
import OfficePage from "@/pages/office";
import BankAccountsPage from "@/pages/office/accounts";
import ImportPage from "@/pages/import";
import InvoicesPage from "@/pages/invoices";
import AccountingPage from "@/pages/accounting";
import ProfilePage from "@/pages/profile";
import BroadcastPage from "@/pages/broadcast";
import CustomerPortalPage from "@/pages/customer-portal";
import AgentPortalPage from "@/pages/agent-portal";
import AdminKycManagementPage from "@/pages/admin-kyc";
import SalesLedgerPage from "@/pages/ledgers/sales";
import PurchaseLedgerPage from "@/pages/ledgers/purchase";
import CashbookPage from "@/pages/ledgers/cashbook";
import CalendarPage from "@/pages/calendar";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.response?.status === 401) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const [location] = useLocation();

  if (location === "/customer-portal") {
    return <CustomerPortalPage />;
  }

  if (location === "/login") {
    return <Redirect to="/" />;
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

        {/* Office & Accounts — managers and above */}
        <Route path="/office">
          <RoleGate roles={FINANCE}>
            <OfficePage />
          </RoleGate>
        </Route>
        <Route path="/office/accounts">
          <RoleGate roles={FINANCE}>
            <BankAccountsPage />
          </RoleGate>
        </Route>

        {/* Import — managers only */}
        <Route path="/import">
          <RoleGate roles={MANAGERS}>
            <ImportPage />
          </RoleGate>
        </Route>

        {/* Invoices — finance roles */}
        <Route path="/invoices">
          <RoleGate roles={FINANCE}>
            <InvoicesPage />
          </RoleGate>
        </Route>

        {/* Accounting / Tally — finance roles */}
        <Route path="/accounting">
          <RoleGate roles={FINANCE}>
            <AccountingPage />
          </RoleGate>
        </Route>

        {/* Profile — customer self-service */}
        <Route path="/profile" component={ProfilePage} />

        {/* Broadcast — managers and above */}
        <Route path="/broadcast">
          <RoleGate roles={MANAGERS}>
            <BroadcastPage />
          </RoleGate>
        </Route>

        {/* Read-Only Customer Portal */}
        <Route path="/customer-portal" component={CustomerPortalPage} />

        {/* Agent Portal */}
        <Route path="/agent-portal">
          <RoleGate roles={["super_admin", "owner", "branch_manager", "agent"]}>
            <AgentPortalPage />
          </RoleGate>
        </Route>

        {/* Admin KYC Management */}
        <Route path="/admin/kyc">
          <RoleGate roles={MANAGERS}>
            <AdminKycManagementPage />
          </RoleGate>
        </Route>

        <Route path="/ledgers/sales">
          <RoleGate roles={FINANCE}>
            <SalesLedgerPage />
          </RoleGate>
        </Route>
        <Route path="/ledgers/purchase">
          <RoleGate roles={FINANCE}>
            <PurchaseLedgerPage />
          </RoleGate>
        </Route>
        <Route path="/ledgers/cashbook">
          <RoleGate roles={FINANCE}>
            <CashbookPage />
          </RoleGate>
        </Route>
        <Route path="/calendar" component={CalendarPage} />

        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
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

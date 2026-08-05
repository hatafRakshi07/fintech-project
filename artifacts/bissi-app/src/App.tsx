import React, { useState } from "react";
import { Route, Switch, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useRole, type UserRole } from "@/hooks/use-role";
import { SplashScreen } from "@/components/SplashScreen";

// Register localStorage auth token getter for all API requests
setAuthTokenGetter(() => typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);

// Pages & Views
import DashboardPage from "@/views/dashboard";
import CustomersPage from "@/views/customers";
import CustomerDetailPage from "@/views/customers/[id]";
import BranchesPage from "@/views/branches";
import BranchDetailPage from "@/views/branches/[id]";
import CollectorsPage from "@/views/collectors";
import CollectorDetailPage from "@/views/collectors/[id]";
import CommitteesPage from "@/views/committees";
import CommitteeDetailPage from "@/views/committees/[id]";
import TokensPage from "@/views/tokens";
import LoansPage from "@/views/loans";
import LoanDetailPage from "@/views/loans/[id]";
import CollectionsPage from "@/views/collections";
import LotteriesPage from "@/views/lotteries";
import LotteryReportsPage from "@/views/lotteries/reports";
import GiftsPage from "@/views/gifts";
import InterestsPage from "@/views/interests";
import RecoveryPage from "@/views/recovery";
import OfficePage from "@/views/office";
import BankAccountsPage from "@/views/office/accounts";
import ImportPage from "@/views/import";
import InvoicesPage from "@/views/invoices";
import AccountingPage from "@/views/accounting";
import ProfilePage from "@/views/profile";
import BroadcastPage from "@/views/broadcast";
import CustomerPortalPage from "@/views/customer-portal";
import AgentPortalPage from "@/views/agent-portal";
import AdminKycManagementPage from "@/views/admin-kyc";
import SalesLedgerPage from "@/views/ledgers/sales";
import PurchaseLedgerPage from "@/views/ledgers/purchase";
import CashbookPage from "@/views/ledgers/cashbook";
import CalendarPage from "@/views/calendar";
import NotFound from "@/views/not-found";




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
  const [location, setLocation] = useLocation();

  React.useEffect(() => {
    const onUnauthorized = () => {
      setLocation("/login");
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, [setLocation]);

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
        <Route path="/lotteries/reports">
          <RoleGate roles={MANAGERS}>
            <LotteryReportsPage />
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
  const [showSplash, setShowSplash] = useState(true);

  React.useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("ska_splash_done")) {
      setShowSplash(false);
    }
  }, []);

  function handleSplashDone() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("ska_splash_done", "1");
    }
    setShowSplash(false);
  }

  if (showSplash) {
    return <SplashScreen onDone={handleSplashDone} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={(process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

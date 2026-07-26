import { useGetMe } from "@workspace/api-client-react";

export type UserRole =
  | "super_admin"
  | "owner"
  | "branch_manager"
  | "collector"
  | "accountant"
  | "customer"
  | "agent";

/**
 * Routes each role may access. "all" means every authenticated role.
 * Routes not listed for a role are forbidden (redirect to /).
 */
export const ROLE_ALLOWED_ROUTES: Record<UserRole, string[]> = {
  super_admin: ["/", "/customers", "/branches", "/collectors", "/committees", "/tokens", "/loans", "/collections", "/lotteries", "/reports", "/admin/kyc", "/agents"],
  owner:        ["/", "/customers", "/branches", "/collectors", "/committees", "/tokens", "/loans", "/collections", "/lotteries", "/reports", "/admin/kyc", "/agents"],
  branch_manager: ["/", "/customers", "/collectors", "/committees", "/tokens", "/loans", "/collections", "/lotteries", "/reports", "/admin/kyc", "/agents"],
  collector:    ["/", "/customers", "/collections"],
  accountant:   ["/", "/loans", "/collections", "/reports"],
  customer:     ["/", "/tokens", "/loans", "/collections", "/customer-portal"],
  agent:        ["/", "/agent-portal", "/collections"],
};

export function useRole() {
  const { data: user } = useGetMe();
  const role = (user?.role ?? "super_admin") as UserRole;

  function hasAnyRole(...roles: UserRole[]): boolean {
    if (!role) return false;
    return roles.includes(role);
  }

  function canAccess(path: string): boolean {
    if (!role) return false;
    const allowed = ROLE_ALLOWED_ROUTES[role] ?? [];
    // Check exact match or prefix for nested routes (e.g. /customers/123)
    return allowed.some((r) => path === r || (r !== "/" && path.startsWith(r)));
  }

  return {
    role,
    user,
    hasAnyRole,
    canAccess,
    isAdmin: hasAnyRole("super_admin", "owner"),
    isBranchManager: hasAnyRole("branch_manager"),
    isCollector: hasAnyRole("collector"),
    isAccountant: hasAnyRole("accountant"),
    isCustomer: hasAnyRole("customer"),
    isAgent: hasAnyRole("agent"),
  };
}

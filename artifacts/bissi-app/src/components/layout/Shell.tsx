import React from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import NotificationBell from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Users,
  Building2,
  UserSquare2,
  ShieldAlert,
  Ticket,
  Wallet,
  CreditCard,
  Gift,
  BarChart3,
  LogOut,
  Settings,
  Menu,
  TrendingUp,
  AlertTriangle,
  Briefcase,
  Upload,
  Moon,
  Sun,
  ChevronRight,
  FileText,
  UserCircle,
  Megaphone,
} from "lucide-react";


const ROLE_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  super_admin: "default",
  owner: "default",
  branch_manager: "secondary",
  collector: "outline",
  accountant: "secondary",
  customer: "outline",
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  owner: "Owner",
  branch_manager: "Branch Manager",
  collector: "Collector",
  accountant: "Accountant",
  customer: "Customer",
};

type NavItem = {
  icon: React.ElementType;
  label: string;
  href: string;
  roles?: string[];
};

const ALL_NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Customers", href: "/customers", roles: ["super_admin","owner","branch_manager","collector"] },
  { icon: Building2, label: "Branches", href: "/branches", roles: ["super_admin","owner"] },
  { icon: UserSquare2, label: "Collectors", href: "/collectors", roles: ["super_admin","owner","branch_manager"] },
  { icon: ShieldAlert, label: "Committees", href: "/committees", roles: ["super_admin","owner","branch_manager"] },
  { icon: Ticket, label: "Tokens", href: "/tokens", roles: ["super_admin","owner","branch_manager","customer"] },
  { icon: Wallet, label: "Loans", href: "/loans", roles: ["super_admin","owner","branch_manager","accountant","customer"] },
  { icon: CreditCard, label: "Collections", href: "/collections", roles: ["super_admin","owner","branch_manager","collector","accountant","customer"] },
  { icon: Gift, label: "Lotteries", href: "/lotteries", roles: ["super_admin","owner","branch_manager"] },
  { icon: Gift, label: "Gifts", href: "/gifts", roles: ["super_admin","owner","branch_manager","accountant"] },
  { icon: TrendingUp, label: "Interests", href: "/interests", roles: ["super_admin","owner","branch_manager","accountant"] },
  { icon: AlertTriangle, label: "Recovery", href: "/recovery", roles: ["super_admin","owner","branch_manager","accountant","collector"] },
  { icon: Briefcase, label: "Office", href: "/office", roles: ["super_admin","owner","branch_manager","accountant"] },
  { icon: Upload, label: "Import", href: "/import", roles: ["super_admin","owner","branch_manager"] },
  { icon: FileText, label: "Invoices", href: "/invoices", roles: ["super_admin","owner","branch_manager","accountant"] },
  { icon: FileText, label: "Accounting (Tally)", href: "/accounting", roles: ["super_admin","owner","branch_manager","accountant"] },
  { icon: Megaphone, label: "Message Broadcast", href: "/broadcast", roles: ["super_admin","owner","branch_manager"] },
  { icon: BarChart3, label: "Reports", href: "/reports", roles: ["super_admin","owner","branch_manager","accountant"] },

  // Customer self-service — only shown to customer role
  { icon: UserCircle, label: "My Profile", href: "/profile", roles: ["customer"] },
];

function useDarkMode() {
  const [dark, setDark] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark") ||
      localStorage.getItem("theme") === "dark";
  });

  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return next;
    });
  };

  React.useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    } else if (saved === "light") {
      document.documentElement.classList.remove("dark");
      setDark(false);
    }
  }, []);

  return { dark, toggle };
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe();
  const { role } = useRole();
  const logout = useLogout();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const { dark, toggle: toggleDark } = useDarkMode();

  React.useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  if (!user) return null;

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("auth_token");
        setLocation("/login");
      },
    });
  };

  const navItems = ALL_NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  const badgeVariant = ROLE_BADGE_VARIANT[role ?? ""] ?? "outline";
  const roleLabel = ROLE_LABEL[role ?? ""] ?? (role ?? "");

  // Bottom nav shows the first 4 accessible items + "More"
  const bottomNavItems = navItems.slice(0, 4);

  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href));

  return (
    <div className="flex h-dvh bg-background overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-full shrink-0">
        <div className="p-4 border-b border-sidebar-border flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">K</div>
          <span className="font-semibold text-sm text-sidebar-foreground flex-1 truncate">Krishna Assoc.</span>
          <NotificationBell />
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-0.5 px-2">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}>
                    <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 h-auto p-2">
                <Avatar className="h-8 w-8 bg-primary/10 shrink-0">
                  <AvatarFallback className="text-primary text-xs">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left flex-1 min-w-0">
                  <span className="text-sm font-medium truncate w-full">{user.name}</span>
                  <Badge variant={badgeVariant} className="mt-0.5 text-[10px] h-4 px-1.5">{roleLabel}</Badge>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleDark}>
                {dark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                <span>{dark ? "Light Mode" : "Dark Mode"}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ── Mobile top header ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border z-40 flex items-center justify-between px-4 safe-top">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">K</div>
          <span className="font-semibold text-sm text-sidebar-foreground truncate">Krishna Assoc.</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleDark} className="h-9 w-9">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <NotificationBell />
          {/* Full nav sheet */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
              <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
                <Avatar className="h-10 w-10 bg-primary/10">
                  <AvatarFallback className="text-primary font-bold">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-sidebar-foreground truncate">{user.name}</p>
                  <Badge variant={badgeVariant} className="text-[10px] h-4 px-1.5 mt-0.5">{roleLabel}</Badge>
                </div>
              </div>
              <nav className="py-2 overflow-y-auto flex-1">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setSheetOpen(false)}>
                      <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-r-2 border-primary"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      }`}>
                        <item.icon className={`h-5 w-5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-sm">{item.label}</span>
                        {active && <ChevronRight className="h-4 w-4 ml-auto text-primary" />}
                      </div>
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-sidebar-border space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => { toggleDark(); }}>
                  {dark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  {dark ? "Light Mode" : "Dark Mode"}
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col min-w-0 bg-background md:pt-0 pt-14 h-full overflow-y-auto">
        <div className="flex-1 p-3 sm:p-4 md:p-8 max-w-7xl mx-auto w-full pb-20 md:pb-8">
          {children}
        </div>
      </main>

      {/* ── Mobile bottom navigation bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border z-40 flex items-stretch safe-bottom">
        {bottomNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} className="flex-1 min-w-0">
              <div className={`flex flex-col items-center justify-center gap-0.5 py-2 px-0.5 min-h-14 transition-colors relative ${
                active ? "text-primary" : "text-muted-foreground"
              }`}>
                {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b" />}
                <item.icon className={`h-5 w-5 shrink-0 ${active ? "text-primary" : ""}`} />
                <span className={`text-[9px] leading-tight text-center truncate w-full ${active ? "text-primary font-medium" : ""}`}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
        {/* "More" button opens the full sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger className="flex-1 min-w-0">
            <div className="flex flex-col items-center justify-center gap-0.5 py-2 px-0.5 min-h-14 text-muted-foreground">
              <Menu className="h-5 w-5 shrink-0" />
              <span className="text-[9px] leading-tight">More</span>
            </div>
          </SheetTrigger>
        </Sheet>
      </nav>

    </div>
  );
}

import React from "react";
import { Link, useLocation } from "wouter";
import { Home, CreditCard, Users, AlertTriangle, ShieldCheck } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/collections", icon: CreditCard, label: "Collections" },
  { href: "/customers", icon: Users, label: "Customers" },
  { href: "/recovery", icon: AlertTriangle, label: "Recovery" },
  { href: "/kyc", icon: ShieldCheck, label: "KYC" },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border flex z-50 shadow-2xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? location === "/" : location.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] font-semibold transition-all relative ${
              active
                ? "text-amber-500 dark:text-amber-400 bg-amber-500/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 dark:bg-amber-400 rounded-b-full shadow-sm shadow-amber-500/50" />
            )}
            <Icon
              size={20}
              className={active ? "text-amber-500 dark:text-amber-400 drop-shadow-sm" : "opacity-70"}
              strokeWidth={active ? 2.3 : 1.8}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

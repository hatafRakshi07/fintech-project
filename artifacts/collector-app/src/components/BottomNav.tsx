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
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Top accent line */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

      <div
        className="flex"
        style={{
          background: "linear-gradient(180deg, rgba(20, 10, 8, 0.96) 0%, rgba(12, 6, 5, 0.99) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-semibold transition-all relative ${
                active
                  ? "text-amber-500 dark:text-amber-400"
                  : "text-slate-500 hover:text-slate-400"
              }`}
            >
              {/* Active top indicator */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-gradient-to-r from-amber-400 to-amber-600 shadow-lg shadow-amber-500/50" />
              )}

              {/* Icon container */}
              <div className={`relative p-1.5 rounded-xl transition-all ${
                active
                  ? "bg-amber-500/15 shadow-lg shadow-amber-500/10"
                  : ""
              }`}>
                <Icon
                  size={20}
                  strokeWidth={active ? 2.3 : 1.6}
                  className={active ? "drop-shadow-sm text-amber-500 dark:text-amber-400" : ""}
                />
                {/* Active glow */}
                {active && (
                  <span className="absolute inset-0 rounded-xl bg-amber-500/10 blur-sm" />
                )}
              </div>

              <span className={`tracking-wide ${active ? "font-bold" : ""}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

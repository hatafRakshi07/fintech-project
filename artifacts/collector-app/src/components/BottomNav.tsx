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
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-amber-500/20 flex z-50 px-2 shadow-2xl"
         style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? location === "/" : location.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 my-1 gap-1 text-xs font-semibold transition-all rounded-xl
              ${active ? "text-amber-400 bg-amber-500/15 shadow-sm border border-amber-500/20" : "text-slate-400 hover:text-slate-200"}`}>
            <Icon
              size={20}
              className={active ? "text-amber-400 animate-pulse" : "text-slate-400"}
              strokeWidth={active ? 2.5 : 1.8}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

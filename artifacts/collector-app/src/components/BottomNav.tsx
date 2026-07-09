import React from "react";
import { Link, useLocation } from "wouter";
import { Home, CreditCard, Users, AlertTriangle } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/collections", icon: CreditCard, label: "Collections" },
  { href: "/customers", icon: Users, label: "Customers" },
  { href: "/recovery", icon: AlertTriangle, label: "Recovery" },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50"
         style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? location === "/" : location.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors
              ${active ? "text-indigo-600" : "text-gray-500"}`}>
            <Icon
              size={22}
              className={active ? "text-indigo-600" : "text-gray-400"}
              strokeWidth={active ? 2.5 : 1.8}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

import React, { useState, useEffect } from "react";
import { SkaAppLogo } from "@/components/SkaAppLogo";
import { clearToken, getStoredUser } from "@/lib/api";
import { useLocation } from "wouter";
import { LogOut, ChevronLeft, Bell, Sun, Moon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  title: string;
  back?: boolean;
};

export default function Header({ title, back }: Props) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      localStorage.setItem("theme_toggled", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      localStorage.setItem("theme_toggled", "true");
    }
  }, [isDark]);

  function handleLogout() {
    clearToken();
    qc.clear();
    setLocation("/login");
  }

  const user = getStoredUser();

  return (
    <header
      className="sticky top-0 z-40 safe-top border-b border-border transition-colors duration-200"
      style={{
        background: "linear-gradient(135deg, hsl(20 10% 8% / 97%) 0%, hsl(20 10% 12% / 97%) 100%)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Golden accent line at top */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-secondary to-transparent opacity-80" />

      <div className="flex items-center h-[60px] px-4 gap-3">
        {back ? (
          <button
            onClick={() => window.history.back()}
            className="p-2 -ml-1 rounded-xl text-secondary-foreground hover:text-white hover:bg-secondary/15 transition-all active:scale-95"
          >
            <ChevronLeft size={22} className="text-amber-500" />
          </button>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-secondary/30 flex items-center justify-center shadow-lg">
            <SkaAppLogo size={28} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate tracking-tight text-white">{title}</h1>
          {user && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-semibold text-amber-100/90 truncate">
                {user.name}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary border border-secondary/35 uppercase tracking-wider">
                {user.role || "Collector"}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Theme Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
            title="Toggle theme"
          >
            {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-300" />}
          </button>

          <button
            className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-all relative"
            title="Notifications"
          >
            <Bell size={18} className="text-slate-300" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-secondary rounded-full border border-slate-900" />
          </button>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={18} className="text-slate-300" />
          </button>
        </div>
      </div>
    </header>
  );
}

import React, { useState, useEffect } from "react";
import { SkaAppLogo } from "@/components/SkaAppLogo";
import { clearToken, getStoredUser } from "@/lib/api";
import { useLocation } from "wouter";
import { LogOut, ChevronLeft, Sun, Moon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  title: string;
  back?: boolean;
};

export default function Header({ title, back }: Props) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return true;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  function handleLogout() {
    clearToken();
    qc.clear();
    setLocation("/login");
  }

  const user = getStoredUser();

  return (
    <header className="bg-card/95 backdrop-blur-md text-foreground border-b border-border px-4 pt-safe-top sticky top-0 z-40">
      <div className="flex items-center h-14 gap-3">
        {back ? (
          <button
            onClick={() => window.history.back()}
            className="p-1.5 -ml-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          <SkaAppLogo size={32} />
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate tracking-tight text-foreground">{title}</h1>
          {user && (
            <p className="text-amber-500/90 dark:text-amber-400/90 text-[11px] font-medium truncate">
              {user.name}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-xl text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
            title="Toggle theme"
          >
            {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
          </button>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

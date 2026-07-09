import React from "react";
import { clearToken, getStoredUser } from "@/lib/api";
import { useLocation } from "wouter";
import { LogOut, ChevronLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  title: string;
  back?: boolean;
};

export default function Header({ title, back }: Props) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  function handleLogout() {
    clearToken();
    qc.clear();
    setLocation("/login");
  }

  const user = getStoredUser();

  return (
    <header className="bg-indigo-600 text-white px-4 pt-safe-top sticky top-0 z-40">
      <div className="flex items-center h-14 gap-3">
        {back && (
          <button onClick={() => window.history.back()}
            className="p-1 -ml-1 rounded-full active:bg-indigo-500">
            <ChevronLeft size={24} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{title}</h1>
          {user && (
            <p className="text-indigo-200 text-xs truncate">{user.name}</p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-full active:bg-indigo-500"
          aria-label="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

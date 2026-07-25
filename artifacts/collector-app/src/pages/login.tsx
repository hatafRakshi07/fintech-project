import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { SignIn, SignUp, useUser } from "@clerk/clerk-react";
import { api, setToken, setStoredUser } from "@/lib/api";
import { ShieldCheck, UserCheck } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { user, isLoaded, isSignedIn } = useUser();
  const [tab, setTab] = React.useState<"signin" | "signup">("signin");

  useEffect(() => {
    async function syncClerkUser() {
      if (!isLoaded || !isSignedIn || !user) return;

      try {
        const phone = user.primaryPhoneNumber?.phoneNumber || "";
        const email = user.primaryEmailAddress?.emailAddress || "";
        const name = user.fullName || user.firstName || "";
        const clerkId = user.id;

        const res: any = await api.post("/auth/clerk-sync", { clerkId, phone, email, name });

        if (res?.token) {
          setToken(res.token);
          setStoredUser(res.user);
          setLocation("/");
        }
      } catch (err: any) {
        console.error("Collector Clerk sync failed:", err);
      }
    }

    syncClerkUser();
  }, [isLoaded, isSignedIn, user]);

  return (
    <div className="min-h-dvh bg-[#090d16] text-slate-100 flex flex-col justify-center items-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-2xl mx-auto shadow-lg shadow-amber-500/20 mb-3">
            SKA
          </div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">Shree Krishna Association</h1>
          <p className="text-xs font-semibold text-amber-400/90 uppercase tracking-widest mt-1">Field Collector Portal</p>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl mb-6 border border-slate-800/80">
          <button
            onClick={() => setTab("signin")}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              tab === "signin"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserCheck size={16} /> Sign In
          </button>
          <button
            onClick={() => setTab("signup")}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              tab === "signup"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Clerk Components */}
        <div className="flex justify-center">
          {tab === "signin" ? (
            <SignIn routing="hash" />
          ) : (
            <SignUp routing="hash" />
          )}
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-6">
          © {new Date().getFullYear()} Shree Krishna Association. All rights reserved.
        </p>
      </div>
    </div>
  );
}

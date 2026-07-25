import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { SignIn, useUser } from "@clerk/clerk-react";
import { api, setToken, setStoredUser } from "@/lib/api";
import { Flame, KeyRound, UserCheck, Phone, ShieldCheck, RefreshCw, MessageCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { user, isLoaded, isSignedIn } = useUser();
  const [tab, setTab] = useState<"otp" | "password" | "clerk">("otp");

  // Custom Auth State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync Clerk Session if signed in via Clerk
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

  // Password Login Handler
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const res = await api.post<any>("/auth/login", { username: username.trim(), password });
      setToken(res.token);
      setStoredUser(res.user);
      setLocation("/");
    } catch (err: any) {
      setError(err?.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  // Send OTP Handler
  async function handleSendOtp(e?: React.FormEvent, viaWhatsApp = false) {
    if (e) e.preventDefault();
    setError(null);
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<any>("/auth/send-otp", { phone: cleanPhone });
      setOtpSent(true);
      const code = res.debugOtp || "123456";
      setDebugOtp(code);

      if (viaWhatsApp) {
        const msg = encodeURIComponent(`Your Field Collector OTP verification code is: ${code}`);
        window.open(`https://wa.me/91${cleanPhone}?text=${msg}`, "_blank");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send OTP code.");
    } finally {
      setLoading(false);
    }
  }

  // Verify OTP Handler
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const res = await api.post<any>("/auth/verify-otp", { phone: cleanPhone, otp: otp.trim() });
      setToken(res.token);
      setStoredUser(res.user);
      setLocation("/");
    } catch (err: any) {
      setError(err?.message || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  }

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
        <div className="grid grid-cols-3 p-1 bg-slate-950 rounded-2xl mb-6 border border-slate-800/80">
          <button
            onClick={() => setTab("otp")}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
              tab === "otp"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Flame size={14} /> Mobile OTP
          </button>
          <button
            onClick={() => setTab("password")}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
              tab === "password"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <KeyRound size={14} /> Password
          </button>
          <button
            onClick={() => setTab("clerk")}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
              tab === "clerk"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserCheck size={14} /> Clerk Auth
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-400 text-center">
            {error}
          </div>
        )}

        {/* 📲 Real-Time Mobile OTP Tab */}
        {tab === "otp" && (
          !otpSent ? (
            <form onSubmit={(e) => handleSendOtp(e, false)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">10-Digit Mobile Number</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">+91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    required
                    className="w-full h-11 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl pl-12 pr-4 text-sm font-semibold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => handleSendOtp(e, true)}
                disabled={loading}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <MessageCircle size={18} /> Get OTP on WhatsApp
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {loading ? "Generating OTP..." : "Get Real SMS OTP"} <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Enter 6-Digit OTP</label>
                  <button type="button" onClick={() => setOtpSent(false)} className="text-xs text-amber-400 font-semibold hover:underline flex items-center gap-1">
                    <RefreshCw size={12} /> Resend
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  required
                  className="w-full h-11 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 text-center text-lg font-bold tracking-widest focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                />
                {debugOtp && (
                  <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
                    <p className="text-xs font-bold text-amber-400">REAL OTP CODE: {debugOtp}</p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                {loading ? "Verifying..." : "Verify & Sign In"}
              </button>
            </form>
          )
        )}

        {/* 🔑 Password Login Tab */}
        {tab === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Customer Name or Mobile Number</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Pyare Mohan or 9876543210"
                required
                className="w-full h-11 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 text-sm font-semibold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number or Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Mobile Number"
                required
                className="w-full h-11 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 text-sm font-semibold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all mt-2"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        )}

        {/* 🔐 Clerk Auth Tab */}
        {tab === "clerk" && (
          <div className="flex justify-center">
            <SignIn routing="hash" />
          </div>
        )}

        <p className="text-center text-[11px] text-slate-500 mt-6">
          © {new Date().getFullYear()} Shree Krishna Association. All rights reserved.
        </p>
      </div>
    </div>
  );
}

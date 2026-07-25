import React, { useState } from "react";
import { SkaAppLogo } from "@/components/SkaAppLogo";
import { useLocation } from "wouter";
import { api, setToken, setStoredUser } from "@/lib/api";
import { KeyRound, Phone, ShieldCheck, RefreshCw, MessageCircle, ArrowRight, LogIn, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"otp" | "password">("otp");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password Login Handler
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const res: any = await api.post("/auth/login", { username, password });
      if (res?.token) {
        setToken(res.token);
        setStoredUser(res.user);
        setLocation("/");
      }
    } catch (err: any) {
      setError(err?.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  }

  // Send OTP Handler
  async function handleSendOtp(e: React.FormEvent, isWhatsapp = false) {
    e.preventDefault();
    setError(null);
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res: any = await api.post("/auth/send-otp", { phone: cleanPhone, channel: isWhatsapp ? "whatsapp" : "sms" });
      setOtpSent(true);
      const code = res?.debugOtp || res?.code;
      setDebugOtp(code || null);
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
      const res: any = await api.post("/auth/verify-otp", { phone: cleanPhone, otp: otp.trim() });
      if (res?.token) {
        setToken(res.token);
        setStoredUser(res.user);
        setLocation("/");
      }
    } catch (err: any) {
      setError(err?.message || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen text-foreground flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden bg-background"
    >
      {/* Decorative ambient glow */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Brand logo & header */}
      <div className="mb-6 text-center z-10 float-up">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 shadow-xl border border-amber-550/20 flex items-center justify-center mx-auto mb-3">
          <SkaAppLogo size={42} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground dark:text-white">Shree Krishna Association</h1>
        <p className="text-amber-500 dark:text-amber-400 text-xs font-bold mt-1 tracking-wider uppercase">
          Field Collector Portal
        </p>
      </div>

      {/* Card */}
      <div className="glass-card rounded-2xl w-full max-w-sm p-6 z-10 float-up-delay-1 bg-card">
        {/* Tabs */}
        <div className="flex border-b border-border dark:border-slate-700/50 mb-5 pb-1">
          <button
            onClick={() => setTab("otp")}
            className={`flex-1 py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              tab === "otp"
                ? "border-amber-500 text-amber-550 dark:text-amber-400 font-black"
                : "border-transparent text-slate-500 hover:text-slate-400"
            }`}
          >
            <Phone size={15} /> Mobile OTP
          </button>
          <button
            onClick={() => setTab("password")}
            className={`flex-1 py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              tab === "password"
                ? "border-amber-500 text-amber-550 dark:text-amber-400 font-black"
                : "border-transparent text-slate-500 hover:text-slate-400"
            }`}
          >
            <KeyRound size={15} /> Password
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-200 rounded-xl px-4 py-3 text-xs font-medium">
            {error}
          </div>
        )}

        {/* 📲 Real-Time Mobile OTP Tab */}
        {tab === "otp" && (
          !otpSent ? (
            <form onSubmit={(e) => handleSendOtp(e, false)} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-550 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-500 dark:text-amber-400">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    required
                    className="w-full h-11 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white placeholder:text-slate-500 rounded-xl pl-12 pr-4 text-sm font-medium focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => handleSendOtp(e, true)}
                disabled={loading}
                className="w-full h-11 bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <MessageCircle size={18} /> Get OTP on WhatsApp
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-550 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Get OTP Code <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">
                    Enter 6-Digit OTP
                  </label>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-xs text-amber-500 dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={12} /> Resend
                  </button>
                </div>
                <div className="relative">
                  <ShieldCheck size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    required
                    className="w-full h-11 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white rounded-xl pl-10 pr-4 text-center text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
                  />
                </div>
                {debugOtp && (
                  <div className="mt-2.5 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center text-xs text-amber-500 dark:text-amber-400 font-mono font-bold">
                    [DEMO OTP: {debugOtp}]
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-550 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} /> Verify & Sign In
                  </>
                )}
              </button>
            </form>
          )
        )}

        {/* 🔑 Password Login Tab */}
        {tab === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-555 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. collector1"
                required
                className="w-full h-11 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white placeholder:text-slate-500 rounded-xl px-4 text-sm font-medium focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-555 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white placeholder:text-slate-500 rounded-xl px-4 pr-11 text-sm font-medium focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p: boolean) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-foreground"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-550 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={18} /> Sign In
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <p className="text-slate-500 text-xs mt-6 text-center font-medium z-10">
        © {new Date().getFullYear()} Shree Krishna Association. All rights reserved.
      </p>
    </div>
  );
}

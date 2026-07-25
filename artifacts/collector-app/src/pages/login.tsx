import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { api, setToken, setStoredUser } from "@/lib/api";
import { Flame, KeyRound, Phone, ShieldCheck, RefreshCw, MessageCircle, ArrowRight, LogIn, Eye, EyeOff } from "lucide-react";

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
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Gold ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Brand logo & header */}
      <div className="mb-6 text-center z-10">
        <div className="w-16 h-16 bg-amber-500 text-slate-950 font-extrabold text-2xl flex items-center justify-center rounded-2xl mx-auto mb-3 shadow-xl shadow-amber-500/25">
          SKA
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Shree Krishna Association</h1>
        <p className="text-amber-500 dark:text-amber-400 text-xs font-semibold mt-1 tracking-wide uppercase">
          Field Collector Portal
        </p>
      </div>

      {/* Card */}
      <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-sm p-6 z-10">
        {/* Tabs */}
        <div className="flex border-b border-border mb-5 pb-1">
          <button
            onClick={() => setTab("otp")}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              tab === "otp"
                ? "border-amber-500 text-amber-500 dark:text-amber-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Phone size={15} /> Mobile OTP
          </button>
          <button
            onClick={() => setTab("password")}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              tab === "password"
                ? "border-amber-500 text-amber-500 dark:text-amber-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <KeyRound size={15} /> Password
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-destructive/10 border border-destructive/30 text-destructive-foreground rounded-xl px-4 py-3 text-xs font-medium">
            {error}
          </div>
        )}

        {/* 📲 Real-Time Mobile OTP Tab */}
        {tab === "otp" && (
          !otpSent ? (
            <form onSubmit={(e) => handleSendOtp(e, false)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
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
                    className="w-full h-11 bg-muted/40 border border-border text-foreground rounded-xl pl-12 pr-4 text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
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
                className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 mt-2"
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
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
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
                  <ShieldCheck size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    required
                    className="w-full h-11 bg-muted/40 border border-border text-foreground rounded-xl pl-10 pr-4 text-center text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                </div>
                {debugOtp && (
                  <div className="mt-2.5 p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center text-xs text-amber-500 dark:text-amber-300 font-mono font-bold">
                    [DEMO OTP: {debugOtp}]
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 mt-2"
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
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Pyare Mohan or 9876543210"
                required
                className="w-full h-11 bg-muted/40 border border-border text-foreground rounded-xl px-4 text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
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
                  className="w-full h-11 bg-muted/40 border border-border text-foreground rounded-xl px-4 pr-11 text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 mt-2"
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

      <p className="text-muted-foreground text-xs mt-6 text-center font-medium z-10">
        © {new Date().getFullYear()} Shree Krishna Association. All rights reserved.
      </p>
    </div>
  );
}

import React, { useState } from "react";
import { useLocation } from "wouter";
import { api, setToken, setStoredUser, ApiError } from "@/lib/api";
import { Eye, EyeOff, LogIn, Phone, KeyRound, ArrowRight, ShieldCheck, RefreshCw, MessageCircle } from "lucide-react";

type LoginResponse = {
  token: string;
  user: { id: number; username: string; name: string; role: string; branchId: number | null; phone?: string | null };
};

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"otp" | "password">("password");

  // Password state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // OTP state
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>("/auth/login", { username: username.trim(), password });
      setToken(res.token);
      setStoredUser(res.user);
      setLocation("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
        const text = encodeURIComponent(`*Shree Krishna Association*\nYour OTP verification code for login is: *${code}*`);
        const waUrl = `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${text}`;
        window.open(waUrl, "_blank");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send OTP code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>("/auth/verify-otp", { phone: cleanPhone, otp: otp.trim() });
      setToken(res.token);
      setStoredUser(res.user);
      setLocation("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col items-center justify-center px-6 selection:bg-amber-500 selection:text-black">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />

      {/* Logo / brand */}
      <div className="mb-6 text-center z-10">
        <div className="w-20 h-20 rounded-2xl p-1 bg-gradient-to-tr from-amber-500 to-amber-300 mx-auto mb-3 shadow-xl shadow-amber-500/10">
          <img src="/collector/ska-logo.png" alt="SKA Logo" className="w-full h-full object-cover rounded-xl" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">Shree Krishna Association</h1>
        <p className="text-amber-400/90 font-medium text-sm mt-1">Field Collector Portal</p>
      </div>

      {/* Card */}
      <div className="bg-slate-900/90 border border-amber-500/20 rounded-2xl shadow-2xl backdrop-blur-xl w-full max-w-sm p-6 z-10">
        {/* Tabs */}
        <div className="flex border-b border-slate-800 mb-5 pb-1">
          <button
            type="button"
            onClick={() => setTab("otp")}
            className={`flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
              tab === "otp"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Phone size={16} /> Mobile OTP
          </button>
          <button
            type="button"
            onClick={() => setTab("password")}
            className={`flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
              tab === "password"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <KeyRound size={16} /> Password
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 text-xs font-medium">
            {error}
          </div>
        )}

        {tab === "otp" ? (
          !otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mobile Number</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-400/80">+91</span>
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

              <div className="space-y-2 mt-2">
                <button
                  type="button"
                  onClick={(e) => handleSendOtp(e, true)}
                  disabled={loading}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  <MessageCircle size={18} /> Get OTP on WhatsApp
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Get OTP Code <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Enter 6-Digit OTP</label>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-xs text-amber-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={12} /> Resend
                  </button>
                </div>
                <div className="relative">
                  <ShieldCheck size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400/80" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    required
                    className="w-full h-11 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-4 text-center text-lg font-bold tracking-widest focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                  />
                </div>
                {debugOtp && (
                  <div className="mt-2.5 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center text-xs text-amber-400 font-mono font-bold">
                    [DEMO OTP: {debugOtp}]
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all mt-2"
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
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Customer Name or Mobile Number</label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Pyare Mohan or 9876543210"
                required
                className="w-full h-11 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 text-sm font-semibold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number or Password</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter 10-digit Mobile Number"
                  required
                  className="w-full h-11 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 pr-11 text-sm font-semibold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all mt-2"
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

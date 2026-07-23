import React, { useState } from "react";
import { useLocation } from "wouter";
import { api, setToken, setStoredUser, ApiError } from "@/lib/api";
import { Eye, EyeOff, LogIn, Phone, KeyRound, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";

type LoginResponse = {
  token: string;
  user: { id: number; username: string; name: string; role: string; branchId: number | null; phone?: string | null };
};

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"otp" | "password">("otp");
  
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

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
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
      if (res.debugOtp) setDebugOtp(res.debugOtp);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send OTP code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!otp || otp.length < 6) {
      setError("Please enter the 6-digit OTP code.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>("/auth/verify-otp", { phone, otp });
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
    <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center px-6">
      {/* Logo / brand */}
      <div className="mb-6 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <span className="text-3xl font-bold text-indigo-600">B</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Bissi Collector</h1>
        <p className="text-indigo-200 text-sm mt-1">Field Collection Portal</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 mb-5 pb-1">
          <button
            type="button"
            onClick={() => setTab("otp")}
            className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              tab === "otp"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <Phone size={16} /> Mobile OTP
          </button>
          <button
            type="button"
            onClick={() => setTab("password")}
            className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              tab === "password"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <KeyRound size={16} /> Password
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs">
            {error}
          </div>
        )}

        {tab === "otp" ? (
          !otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">+91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    required
                    className="w-full h-11 border border-gray-300 rounded-xl pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors mt-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Enter 6-Digit OTP</label>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={12} /> Resend
                  </button>
                </div>
                <div className="relative">
                  <ShieldCheck size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    required
                    className="w-full h-11 border border-gray-300 rounded-xl pl-10 pr-4 text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {debugOtp && (
                  <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded text-center text-xs text-indigo-700 font-mono font-bold">
                    [DEMO OTP: {debugOtp}]
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors mt-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Username</label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="collector"
                required
                className="w-full h-11 border border-gray-300 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 border border-gray-300 rounded-xl px-4 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors mt-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={18} /> Sign In
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <p className="text-indigo-300 text-xs mt-6 text-center">
        © {new Date().getFullYear()} Shree Krishna Association. All rights reserved.
      </p>
    </div>
  );
}

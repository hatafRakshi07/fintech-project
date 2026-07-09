import React, { useState } from "react";
import { useLocation } from "wouter";
import { api, setToken, setStoredUser, ApiError } from "@/lib/api";
import { Eye, EyeOff, LogIn } from "lucide-react";

type LoginResponse = {
  token: string;
  user: { id: number; username: string; name: string; role: string; branchId: number | null; phone?: string | null };
};

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center px-6">
      {/* Logo / brand */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <span className="text-3xl font-bold text-indigo-600">B</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Bissi Collector</h1>
        <p className="text-indigo-200 text-sm mt-1">Field Collection App</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">Sign In</h2>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              className="w-full h-11 border border-gray-300 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full h-11 border border-gray-300 rounded-xl px-4 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPwd((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors mt-2">
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={18} />
                Sign In
              </>
            )}
          </button>
        </form>
      </div>

      <p className="text-indigo-300 text-xs mt-6 text-center">
        Contact your branch manager for login credentials
      </p>
    </div>
  );
}

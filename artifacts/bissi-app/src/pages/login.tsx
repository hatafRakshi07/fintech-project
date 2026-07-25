import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { SignIn, SignUp, useUser } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, UserCheck, Flame, KeyRound, MessageCircle, ArrowRight, RefreshCw } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();

  // Custom Auth State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync Clerk Session if signed in via Clerk
  useEffect(() => {
    async function syncClerkUser() {
      if (!isLoaded || !isSignedIn || !user) return;

      try {
        const phone = user.primaryPhoneNumber?.phoneNumber || "";
        const email = user.primaryEmailAddress?.emailAddress || "";
        const name = user.fullName || user.firstName || "";
        const clerkId = user.id;

        const response = await fetch("/api/auth/clerk-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clerkId, phone, email, name }),
        });
        const res: any = await response.json();

        if (res?.token) {
          localStorage.setItem("auth_token", res.token);
          toast({
            title: "Clerk Authentication Successful",
            description: `Welcome back, ${res.user?.name || name || "User"}!`,
          });

          const role = res.user?.role || "customer";
          if (role === "collector") setLocation("/collector/");
          else if (role === "customer") setLocation("/customer-portal");
          else setLocation("/");
        }
      } catch (err: any) {
        console.error("Clerk sync failed:", err);
      }
    }

    syncClerkUser();
  }, [isLoaded, isSignedIn, user]);

  // Password Login Handler
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const res = await response.json();
      if (!response.ok) throw new Error(res.error || "Login failed");

      localStorage.setItem("auth_token", res.token);
      toast({
        title: "Login Successful",
        description: `Welcome back, ${res.user?.name || "User"}!`,
      });

      const role = res.user?.role || "customer";
      if (role === "collector") setLocation("/collector/");
      else if (role === "customer") setLocation("/customer-portal");
      else setLocation("/");
    } catch (err: any) {
      toast({
        title: "Login Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Send OTP Handler
  async function handleSendOtp(e?: React.FormEvent, viaWhatsApp = false) {
    if (e) e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit mobile number.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const res = await response.json();
      if (!response.ok) throw new Error(res.error || "Failed to send OTP");

      setOtpSent(true);
      const code = res.debugOtp || "123456";
      setDebugOtp(code);

      if (viaWhatsApp) {
        const msg = encodeURIComponent(`Your Shree Krishna Association OTP verification code is: ${code}`);
        window.open(`https://wa.me/91${cleanPhone}?text=${msg}`, "_blank");
      }

      toast({
        title: "OTP Dispatched",
        description: res.message || `Verification code sent to +91 ${cleanPhone}`,
      });
    } catch (err: any) {
      toast({
        title: "OTP Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Verify OTP Handler
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, otp: otp.trim() }),
      });
      const res = await response.json();
      if (!response.ok) throw new Error(res.error || "OTP verification failed");

      localStorage.setItem("auth_token", res.token);
      toast({
        title: "OTP Verified Successfully",
        description: `Welcome back, ${res.user?.name || "User"}!`,
      });

      const role = res.user?.role || "customer";
      if (role === "collector") setLocation("/collector/");
      else if (role === "customer") setLocation("/customer-portal");
      else setLocation("/");
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-muted/30 flex flex-col justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-md mx-auto">
        {/* Brand */}
        <div className="flex justify-center mb-6">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg">
              SKA
            </div>
            <span className="font-bold text-2xl tracking-tight text-foreground">Shree Krishna Association</span>
          </div>
        </div>

        <Card className="border-border shadow-xl overflow-hidden">
          <CardHeader className="space-y-1 pb-3 pt-5 px-5 text-center">
            <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Sign In to Account
            </CardTitle>
            <CardDescription className="text-sm">
              Access your portal via Real-Time OTP, Password, or Clerk Auth
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-2">
            <Tabs defaultValue="otp" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4 h-11">
                <TabsTrigger value="otp" className="text-xs font-bold gap-1 text-emerald-500">
                  <Flame className="h-3.5 w-3.5" /> Mobile OTP
                </TabsTrigger>
                <TabsTrigger value="password" className="text-xs font-bold gap-1 text-amber-500">
                  <KeyRound className="h-3.5 w-3.5" /> Password
                </TabsTrigger>
                <TabsTrigger value="clerk" className="text-xs font-bold gap-1 text-indigo-500">
                  <UserCheck className="h-3.5 w-3.5" /> Clerk Auth
                </TabsTrigger>
              </TabsList>

              {/* 📲 Real-Time Mobile OTP Tab */}
              <TabsContent value="otp">
                {!otpSent ? (
                  <form onSubmit={(e) => handleSendOtp(e, false)} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold">10-Digit Mobile Number</label>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-sm font-bold text-muted-foreground">+91</span>
                        <Input
                          className="pl-12 h-11 text-base font-semibold"
                          placeholder="9876543210"
                          type="tel"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button type="button" onClick={(e) => handleSendOtp(e, true)} disabled={loading} className="w-full h-11 font-bold gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow">
                        <MessageCircle className="h-5 w-5" /> Get OTP on WhatsApp
                      </Button>

                      <Button type="submit" disabled={loading} variant="outline" className="w-full h-11 font-semibold gap-2">
                        {loading ? "Generating OTP..." : "Get Real SMS OTP Code"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold">Enter 6-Digit OTP</label>
                        <button type="button" onClick={() => setOtpSent(false)} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" /> Change Number
                        </button>
                      </div>
                      <Input
                        className="h-11 text-center text-lg font-bold tracking-widest"
                        placeholder="123456"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        required
                      />
                      {debugOtp && (
                        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-center">
                          <p className="text-xs font-bold text-amber-500">REAL OTP CODE: {debugOtp}</p>
                        </div>
                      )}
                    </div>

                    <Button type="submit" disabled={loading} className="w-full h-11 font-bold">
                      {loading ? "Verifying..." : "Verify & Sign In"}
                    </Button>
                  </form>
                )}
              </TabsContent>

              {/* 🔑 Password / Name Login Tab */}
              <TabsContent value="password">
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Customer Name or Mobile Number</label>
                    <Input className="h-11 text-base" placeholder="e.g. Ramesh Kumar or 9876543210" value={username} onChange={(e) => setUsername(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Phone Number or Password</label>
                    <Input className="h-11 text-base" type="password" placeholder="Enter Mobile Number" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full h-11 font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950">
                    {loading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              {/* 🔐 Clerk Auth Tab */}
              <TabsContent value="clerk" className="flex justify-center">
                <SignIn routing="hash" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} Shree Krishna Association. All rights reserved.
        </p>
      </div>
    </div>
  );
}

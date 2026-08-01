'use client';

import React, { useState } from "react";
import { SkaAppLogo } from "@/components/SkaAppLogo";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, KeyRound, MessageCircle, ArrowRight, RefreshCw } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Custom Auth State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRoleRedirect = (role: string) => {
    if (role === "collector") {
      setLocation("/collections");
    } else if (role === "customer") {
      setLocation("/customer-portal");
    } else {
      setLocation("/");
    }
  };

  const handleSendOtp = async (e: React.FormEvent, viaWhatsApp = false) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      toast({ title: "Invalid Phone Number", description: "Please enter a valid 10-digit mobile number.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const endpoint = viaWhatsApp ? "/auth/whatsapp-otp" : "/auth/send-otp";
      const res: any = await customFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ phone }),
      });

      setOtpSent(true);
      if (res.debugOtp) {
        setDebugOtp(res.debugOtp);
      }
      toast({
        title: viaWhatsApp ? "WhatsApp OTP Sent!" : "SMS OTP Sent!",
        description: res.message || "OTP code has been dispatched to your mobile number.",
      });
    } catch (err: any) {
      toast({ title: "Failed to Send OTP", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      toast({ title: "Invalid OTP", description: "Please enter the verification code.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res: any = await customFetch("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, otp }),
      });

      if (res.token) {
        localStorage.setItem("auth_token", res.token);
        if (res.user) {
          localStorage.setItem("current_user", JSON.stringify(res.user));
        }
        toast({ title: "Login Successful", description: `Welcome back, ${res.user?.name || "User"}!` });
        handleRoleRedirect(res.user?.role || "super_admin");
      }
    } catch (err: any) {
      toast({ title: "Verification Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res: any = await customFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (res.token) {
        localStorage.setItem("auth_token", res.token);
        if (res.user) {
          localStorage.setItem("current_user", JSON.stringify(res.user));
        }
        toast({ title: "Login Successful", description: `Welcome back, ${res.user?.name || "User"}!` });
        handleRoleRedirect(res.user?.role || "super_admin");
      }
    } catch (err: any) {
      toast({ title: "Login Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <SkaAppLogo size={64} className="mx-auto mb-2" />
          <h1 className="text-2xl font-black tracking-tight text-white">Shree Krishna Association</h1>
          <p className="text-xs text-muted-foreground">Bissi & Committee Management System</p>
        </div>

        <Card className="border-border shadow-2xl bg-card/90 backdrop-blur">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>Select authentication method to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="otp" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="otp" className="text-xs font-bold gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Mobile OTP
                </TabsTrigger>
                <TabsTrigger value="password" className="text-xs font-bold gap-1">
                  <KeyRound className="h-3.5 w-3.5" /> Name / Password
                </TabsTrigger>
              </TabsList>

              {/* 📲 Real-Time Mobile OTP Tab */}
              <TabsContent value="otp">
                {!otpSent ? (
                  <form onSubmit={(e) => handleSendOtp(e, false)} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">10-Digit Mobile Number</Label>
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
                        <Label className="text-sm font-medium">Enter 6-Digit OTP</Label>
                        <button
                          type="button"
                          onClick={() => setOtpSent(false)}
                          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                        >
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
                          <p className="text-xs font-bold text-amber-500">OTP VERIFICATION CODE: {debugOtp}</p>
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
                    <Label className="text-xs font-semibold">Customer Name or Mobile Number</Label>
                    <Input className="h-11 text-base" placeholder="e.g. Ramesh Kumar or 9876543210" value={username} onChange={(e) => setUsername(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Phone Number or Password</Label>
                    <Input className="h-11 text-base" type="password" placeholder="Enter Mobile Number" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full h-11 font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950">
                    {loading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
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

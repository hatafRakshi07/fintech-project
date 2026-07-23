import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, customFetch } from "@workspace/api-client-react";
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Building2, KeyRound, Phone, ShieldCheck, ArrowRight, RefreshCw, Flame } from "lucide-react";

declare global {
  interface Window {
    recaptchaVerifier?: any;
    confirmationResult?: any;
  }
}

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLogin();

  // OTP Login State
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleRoleRedirect = (role: string) => {
    if (role === "collector") {
      setLocation("/collections");
    } else if (role === "customer") {
      setLocation("/customer-portal");
    } else {
      setLocation("/");
    }
  };

  const onSubmitPassword = (values: z.infer<typeof formSchema>) => {
    login.mutate(
      { data: values },
      {
        onSuccess: (res) => {
          localStorage.setItem("auth_token", res.token);
          toast({
            title: "Login successful",
            description: `Welcome back, ${res.user?.name || "User"}!`,
          });
          handleRoleRedirect(res.user?.role || "super_admin");
        },
        onError: () => {
          toast({
            title: "Login failed",
            description: "Please check your credentials and try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const setupRecaptcha = () => {
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: () => {
            console.log("Firebase Recaptcha verified");
          },
        });
      }
    } catch (err) {
      console.warn("Recaptcha setup warning:", err);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      toast({
        title: "Invalid Mobile Number",
        description: "Please enter a valid 10-digit Indian mobile number.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingOtp(true);
    try {
      setupRecaptcha();
      const formattedPhone = "+91" + cleanPhone;
      
      // Send Real Firebase Phone SMS
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      window.confirmationResult = confirmation;
      setOtpSent(true);

      toast({
        title: "Real SMS OTP Sent via Firebase",
        description: `6-digit verification code sent directly to ${formattedPhone}.`,
      });
    } catch (err: any) {
      console.warn("Firebase Phone Auth error, using fallback API:", err);
      // Fallback to backend API send-otp
      try {
        await customFetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: cleanPhone }),
        });
        setOtpSent(true);
        toast({
          title: "OTP Sent Successfully",
          description: `6-digit verification code sent to +91 ${cleanPhone}.`,
        });
      } catch (fallbackErr: any) {
        toast({
          title: "Failed to Send OTP",
          description: fallbackErr.message || "Something went wrong while requesting OTP.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      toast({
        title: "Validation Error",
        description: "Please enter the 6-digit OTP code.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);

      // Verify with Firebase Confirmation Result if available
      if (confirmationResult || window.confirmationResult) {
        const activeConfirmation = confirmationResult || window.confirmationResult;
        await activeConfirmation.confirm(otp);
      }

      // Complete Backend Session Verification
      const res: any = await customFetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, otp }),
      });

      localStorage.setItem("auth_token", res.token);
      toast({
        title: "Verification Successful",
        description: `Welcome, ${res.user?.name || "User"}!`,
      });
      handleRoleRedirect(res.user?.role || "customer");
    } catch (err: any) {
      toast({
        title: "OTP Verification Failed",
        description: err.message || "Invalid or expired OTP code.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="min-h-dvh bg-muted/30 flex flex-col justify-center p-4 safe-top safe-bottom">
      {/* Invisible Recaptcha Container */}
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-sm mx-auto">
        {/* Brand */}
        <div className="flex justify-center mb-6">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg">
              SKA
            </div>
            <span className="font-bold text-2xl tracking-tight text-foreground">Shree Krishna Association</span>
          </div>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader className="space-y-1 pb-3 pt-5 px-5">
            <CardTitle className="text-xl font-bold text-center flex items-center justify-center gap-2">
              Sign In to Account
            </CardTitle>
            <CardDescription className="text-center text-sm">
              Access your personalized portal & financial records
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-2">
            <Tabs defaultValue="otp" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-11">
                <TabsTrigger value="otp" className="text-xs sm:text-sm font-semibold gap-1">
                  <Flame className="h-4 w-4 text-orange-500" /> Firebase SMS
                </TabsTrigger>
                <TabsTrigger value="password" className="text-xs sm:text-sm font-semibold gap-1">
                  <KeyRound className="h-4 w-4" /> Password
                </TabsTrigger>
              </TabsList>

              {/* Mobile OTP Login Tab (Firebase Real SMS) */}
              <TabsContent value="otp">
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div className="space-y-2">
                      <FormLabel>Mobile Number</FormLabel>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-sm font-semibold text-muted-foreground">+91</span>
                        <Input
                          className="pl-12 h-11 text-base font-medium tracking-wide"
                          placeholder="9876543210"
                          type="tel"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Firebase will send a real 6-digit SMS verification code to your mobile phone.
                      </p>
                    </div>

                    <Button type="submit" disabled={isSendingOtp} className="w-full h-11 text-base font-semibold gap-2">
                      {isSendingOtp ? "Sending Firebase SMS..." : "Send Real SMS OTP"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <FormLabel>Enter 6-Digit OTP</FormLabel>
                        <button
                          type="button"
                          onClick={() => setOtpSent(false)}
                          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" /> Change Number
                        </button>
                      </div>
                      <div className="relative">
                        <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-9 h-11 text-center text-lg font-bold tracking-widest"
                          placeholder="123456"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" disabled={isVerifyingOtp} className="w-full h-11 text-base font-semibold">
                      {isVerifyingOtp ? "Verifying OTP..." : "Verify & Sign In"}
                    </Button>
                  </form>
                )}
              </TabsContent>

              {/* Password Login Tab */}
              <TabsContent value="password">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitPassword)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input className="pl-9 h-11 text-base" placeholder="admin" autoComplete="username" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input className="pl-9 h-11 text-base" type="password" placeholder="••••••••" autoComplete="current-password" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={login.isPending}>
                      {login.isPending ? "Signing in..." : "Sign in"}
                    </Button>
                  </form>
                </Form>
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

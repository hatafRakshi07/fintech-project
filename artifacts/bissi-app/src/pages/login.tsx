import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { SignIn, SignUp, useUser } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customFetch } from "@/lib/customFetch";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, UserCheck } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    async function syncClerkUser() {
      if (!isLoaded || !isSignedIn || !user) return;

      try {
        const phone = user.primaryPhoneNumber?.phoneNumber || "";
        const email = user.primaryEmailAddress?.emailAddress || "";
        const name = user.fullName || user.firstName || "";
        const clerkId = user.id;

        const res: any = await customFetch("/api/auth/clerk-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clerkId, phone, email, name }),
        });

        if (res?.token) {
          localStorage.setItem("auth_token", res.token);
          toast({
            title: "Authentication Successful",
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
              Clerk Authentication
            </CardTitle>
            <CardDescription className="text-sm">
              Sign in or Create a New Account via Clerk SMS / Email / Socials
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex justify-center">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-11">
                <TabsTrigger value="signin" className="text-sm font-bold gap-1">
                  <UserCheck className="h-4 w-4" /> Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="text-sm font-bold gap-1">
                  Create Account
                </TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="flex justify-center">
                <SignIn routing="hash" />
              </TabsContent>
              <TabsContent value="signup" className="flex justify-center">
                <SignUp routing="hash" />
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

import React, { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, KeyRound } from "lucide-react";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLogin();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    login.mutate(
      { data: values },
      {
        onSuccess: (res) => {
          localStorage.setItem("auth_token", res.token);
          toast({
            title: "Login successful",
            description: "Welcome back to Bissi.",
          });
          setLocation("/");
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

  return (
    <div className="min-h-dvh bg-muted/30 flex flex-col justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-sm mx-auto">
        {/* Brand */}
        <div className="flex justify-center mb-6">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl shadow-lg">
              B
            </div>
            <span className="font-bold text-2xl tracking-tight text-foreground">Bissi.</span>
          </div>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader className="space-y-1 pb-4 pt-5 px-5">
            <CardTitle className="text-xl font-bold text-center">Welcome back</CardTitle>
            <CardDescription className="text-center text-sm">
              Enter your credentials to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <FormLabel>Password</FormLabel>
                        <a href="#" className="text-xs text-primary font-medium hover:underline">
                          Forgot password?
                        </a>
                      </div>
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

                <Button
                  type="submit"
                  className="w-full h-11 text-base mt-2"
                  disabled={login.isPending}
                >
                  {login.isPending ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} Bissi Management System. All rights reserved.
        </p>
      </div>
    </div>
  );
}

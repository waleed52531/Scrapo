"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Radar, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/auth-provider";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-300">
          Loading sign in…
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const next = params.get("next") ?? "/dashboard";

  useEffect(() => {
    if (!auth.loading && auth.authenticated) router.replace(next);
  }, [auth.loading, auth.authenticated, next, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await auth.signInWithPassword(email, password);
      router.replace(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function enterDemo() {
    auth.useDemo();
    router.replace(next);
  }

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <section className="hidden flex-col justify-between p-12 text-white lg:flex">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-500">
            <Radar className="h-5 w-5" />
          </span>
          Scrapo
        </div>
        <div className="max-w-lg">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
            Freelance pipeline
          </p>
          <h1 className="text-5xl font-semibold leading-tight">
            Focus on the prospects worth contacting.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            A clean, workspace-ready foundation for lead intelligence,
            qualification, and CRM workflows.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <ShieldCheck className="h-4 w-4" /> Supabase Auth · Independent REST
          API · Workspace isolation
        </div>
      </section>
      <section className="grid place-items-center bg-slate-50 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>
              Sign in with your Supabase account or enter the local demo
              workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              <Button className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
            {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
              <>
                <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />
                  or
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={enterDemo}
                >
                  Enter demo workspace
                </Button>
                <p className="mt-3 text-center text-xs text-slate-500">
                  Demo mode is development-only and requires DEMO_AUTH_ENABLED
                  on the API.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

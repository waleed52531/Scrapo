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
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [submitting, setSubmitting] = useState(false);
  const next = params.get("next") ?? "/dashboard";

  useEffect(() => {
    if (!auth.loading && auth.authenticated) router.replace(next);
  }, [auth.loading, auth.authenticated, next, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      if (mode === "sign-up") {
        const message = await auth.signUpWithPassword(email, password);
        setNotice(message);
        if (message.includes("signed in")) router.replace(next);
      } else {
        await auth.signInWithPassword(email, password);
        router.replace(next);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
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
              Sign in with your Supabase account or create your first user.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
              <button
                type="button"
                className={`rounded-md px-3 py-2 font-medium transition ${
                  mode === "sign-in"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => {
                  setMode("sign-in");
                  setError("");
                  setNotice("");
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-2 font-medium transition ${
                  mode === "sign-up"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => {
                  setMode("sign-up");
                  setError("");
                  setNotice("");
                }}
              >
                Create account
              </button>
            </div>
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
              {notice && (
                <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
                  {notice}
                </p>
              )}
              <Button className="w-full" disabled={submitting}>
                {submitting
                  ? mode === "sign-up"
                    ? "Creating account…"
                    : "Signing in…"
                  : mode === "sign-up"
                    ? "Create account"
                    : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

"use client";

import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type AuthContextValue = {
  loading: boolean;
  authenticated: boolean;
  isDemo: boolean;
  email: string | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const demoModeEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    const storedDemo = demoModeEnabled
      ? window.localStorage.getItem("scrapo.access-token") === "demo-token"
      : false;
    if (!demoModeEnabled) {
      window.localStorage.removeItem("scrapo.access-token");
    }
    if (!supabase) {
      void Promise.resolve().then(() => {
        setIsDemo(storedDemo);
        setLoading(false);
      });
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.access_token)
        window.localStorage.setItem(
          "scrapo.access-token",
          data.session.access_token,
        );
      setIsDemo(storedDemo && !data.session);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        if (nextSession?.access_token)
          window.localStorage.setItem(
            "scrapo.access-token",
            nextSession.access_token,
          );
        else if (
          window.localStorage.getItem("scrapo.access-token") !== "demo-token"
        )
          window.localStorage.removeItem("scrapo.access-token");
      },
    );
    return () => subscription.subscription.unsubscribe();
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase)
        throw new Error(
          "Supabase is not configured. Add the web environment variables.",
        );
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (data.session)
        window.localStorage.setItem(
          "scrapo.access-token",
          data.session.access_token,
        );
      setSession(data.session);
      setIsDemo(false);
    },
    [],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase)
        throw new Error(
          "Supabase is not configured. Add the web environment variables.",
        );
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) {
        window.localStorage.setItem(
          "scrapo.access-token",
          data.session.access_token,
        );
        setSession(data.session);
        setIsDemo(false);
        return "Account created. You are signed in.";
      }
      return "Account created. Check your email to confirm it, then sign in.";
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (session && supabase) await supabase.auth.signOut();
    window.localStorage.removeItem("scrapo.access-token");
    setSession(null);
    setIsDemo(false);
  }, [session]);

  const value = useMemo(
    () => ({
      loading,
      authenticated: Boolean(session || isDemo),
      isDemo,
      email: session?.user.email ?? (isDemo ? "demo@scrapo.local" : null),
      signInWithPassword,
      signUpWithPassword,
      signOut,
    }),
    [loading, session, isDemo, signInWithPassword, signUpWithPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}

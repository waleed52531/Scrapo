'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!auth.loading && !auth.authenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [auth.loading, auth.authenticated, pathname, router]);
  if (auth.loading || !auth.authenticated) return <div className="grid min-h-screen place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-blue-600" /></div>;
  return children;
}

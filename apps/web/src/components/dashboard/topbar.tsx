'use client';

import { LogOut, Menu, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/providers/auth-provider';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const auth = useAuth();
  const router = useRouter();
  async function signOut() { await auth.signOut(); router.replace('/login'); }
  return <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-7"><Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu}><Menu className="h-5 w-5" /></Button><div className="relative hidden max-w-md flex-1 md:block"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Search leads, companies, or contacts…" disabled title="Global search is planned for a later phase" /></div><div className="ml-auto flex items-center gap-3">{auth.isDemo && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">DEMO DATA</span>}<div className="hidden text-right sm:block"><p className="text-sm font-medium text-slate-800">{auth.email}</p><p className="text-xs text-slate-500">Scrapo Workspace</p></div><Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button></div></header>;
}

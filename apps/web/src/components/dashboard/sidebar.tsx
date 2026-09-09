"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  BarChart3,
  Bell,
  Bot,
  ClipboardCheck,
  ContactRound,
  FileText,
  LayoutDashboard,
  ListFilter,
  Mail,
  MailCheck,
  MessageSquareReply,
  Megaphone,
  ShieldCheck,
  Search,
  Radar,
  Settings,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const available = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lead-hunter", label: "Lead Hunter", icon: Radar },
  { href: "/search-queries", label: "Search Queries", icon: Search },
  { href: "/action-queue", label: "Action Queue", icon: ClipboardCheck },
  {
    href: "/integrations/telegram/sources",
    label: "Telegram Sources",
    icon: ContactRound,
  },
  { href: "/shortlist", label: "Weekly Shortlist", icon: Trophy },
  { href: "/automation", label: "Automation", icon: Bot },
  { href: "/automation/runs", label: "Automation Runs", icon: BarChart3 },
  { href: "/reports/weekly", label: "Weekly Reports", icon: FileText },
  { href: "/optimization", label: "Optimization", icon: Sparkles },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/system", label: "System Status", icon: ShieldCheck },
  { href: "/outreach", label: "Outreach", icon: Mail },
  { href: "/replies", label: "Replies", icon: MessageSquareReply },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/integrations/gmail", label: "Gmail", icon: MailCheck },
  { href: "/leads", label: "All Leads", icon: ListFilter },
  { href: "/review", label: "Review Queue", icon: Sparkles },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/contacts", label: "Contacts", icon: ContactRound },
  { href: "/settings/suppression", label: "Suppression", icon: X },
  { href: "/settings/usage", label: "Usage & Limits", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];
const future = ["Pipeline", "Analytics"];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-slate-950 text-slate-300 transition-transform lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 font-semibold text-white"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500">
            <Radar className="h-4 w-4" />
          </span>
          Scrapo
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-300 lg:hidden"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Workspace
        </p>
        <div className="space-y-1">
          {available.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-slate-800 text-white"
                    : "hover:bg-slate-900 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
        <p className="px-3 pb-2 pt-7 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Later phases
        </p>
        <div className="space-y-1">
          {future.map((label) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-slate-600"
            >
              <span className="flex items-center gap-3">
                <Sparkles className="h-4 w-4" />
                {label}
              </span>
              <span className="text-[9px] uppercase">Soon</span>
            </div>
          ))}
        </div>
      </nav>
      <div className="border-t border-slate-800 p-4">
        <div className="rounded-lg bg-slate-900 p-3">
          <p className="text-xs font-semibold text-white">Phase 7</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Production hardening, system health, launch safety, and
            deployability.
          </p>
        </div>
      </div>
    </aside>
  );
}

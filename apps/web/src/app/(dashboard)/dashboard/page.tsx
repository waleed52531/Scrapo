"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  CircleCheckBig,
  Contact,
  Flame,
  Inbox,
  ListFilter,
  Trophy,
} from "lucide-react";
import type { DashboardSummary } from "@scrapo/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingState } from "@/components/data-states";
import { apiFetch } from "@/lib/api";

const metrics = [
  ["leadsDiscovered", "Leads", ListFilter],
  ["qualified", "Qualified", CircleCheckBig],
  ["shortlisted", "Shortlisted", Flame],
  ["contacted", "Contacted", Contact],
  ["replies", "Replies", Inbox],
  ["interested", "Interested", Building2],
  ["won", "Won", Trophy],
  ["analyzedLeads", "Analyzed", CircleCheckBig],
  ["hotLeads", "Hot", Flame],
  ["strongLeads", "Strong", Trophy],
  ["reviewLeads", "Review", ListFilter],
  ["rejectedLeads", "Rejected", Inbox],
  ["aiAnalysisFailures", "Analysis failures", Contact],
] as const;

export default function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardSummary>("/dashboard"),
  });
  if (query.isLoading) return <LoadingState label="Loading pipeline…" />;
  if (query.error || !query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <>
      <PageHeader
        title="Freelance Pipeline"
        description="Your Phase 1 CRM foundation and current demo pipeline."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([key, label, Icon]) => (
          <Card key={key}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-2xl font-semibold text-slate-950">
                  {query.data[key]}
                </p>
                <p className="mt-1 text-sm text-slate-500">{label}</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
                <Icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent leads</CardTitle>
            <Link
              href="/leads"
              className="flex items-center gap-1 text-sm font-medium text-blue-700"
            >
              View all <ArrowUpRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {query.data.recentLeads.map((lead) => (
                <Link
                  href={`/leads/${lead.id}`}
                  key={lead.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 hover:text-blue-700"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {lead.company?.name ?? lead.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {lead.contact?.fullName ?? "Contact not assigned"} ·{" "}
                      {lead.primarySource}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{lead.temperature}</Badge>
                    <span className="w-8 text-right text-sm font-semibold">
                      {lead.overallScore}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Phase status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Status label="Independent REST API" />
            <Status label="Workspace data isolation" />
            <Status label="Supabase authentication" />
            <Status label="PostgreSQL + Prisma" />
            <Status label="Redis + BullMQ worker" />
            <Status label="Manual AI analysis and scoring" />
            <div className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Automated discovery, enrichment, Gmail sending, and outreach
              automation remain disabled for later phases.
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Status({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-700">
      <CircleCheckBig className="h-4 w-4 text-emerald-600" />
      {label}
    </div>
  );
}

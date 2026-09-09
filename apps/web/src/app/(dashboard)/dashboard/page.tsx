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
  MailCheck,
  MessageSquareReply,
  Sparkles,
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
  ["emailsSentThisWeek", "Sent this week", MailCheck],
  ["replyRate", "Reply rate %", MessageSquareReply],
  ["followUpsDue", "Follow-ups due", Inbox],
  ["enabledAutomationRules", "Automations on", CircleCheckBig],
  ["failedAutomationRuns", "Automation failures", Inbox],
  ["unreadNotifications", "Unread alerts", Inbox],
  ["newOptimizationRecommendations", "New recommendations", Sparkles],
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
        description="Your CRM, discovery, scoring, shortlist, Gmail outreach, and Phase 6 automation pipeline."
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
            <Status label="Social source classification" />
            <Status label="Manual action queue only" />
            <Status label="Backend-only Gmail integration" />
            <Status label="Draft-first outreach workflow" />
            <Status label="Reply tracking and suppression safeguards" />
            <Status label="Worker-based automation scheduler" />
            <Status label="Lead ranking separate from lead score" />
            <Status label="Optimization recommendations require approval" />
            <Status label="Weekly reports and in-app notifications" />
            <Status
              label={`Gmail status: ${query.data.gmailStatus ?? "NOT_CONFIGURED"}`}
            />
            <div className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Automatic social replies/DMs, scraping bypasses, and account
              rotation remain disabled. Auto-send is off by default and guarded
              by score, verification, business-hours, and daily-limit checks.
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Outreach funnel</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {Object.entries(query.data.outreachAnalytics ?? {}).map(
              ([key, value]) => (
                <div
                  key={key}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {key.replaceAll(/([A-Z])/g, " $1")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {value}
                  </p>
                </div>
              ),
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Phase 6 shortcuts</CardTitle>
            <Link
              href="/integrations/gmail"
              className="flex items-center gap-1 text-sm font-medium text-blue-700"
            >
              Gmail <ArrowUpRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <ButtonLink href="/outreach" label="Review outreach" />
            <ButtonLink href="/replies" label="Review replies" />
            <ButtonLink href="/campaigns" label="Campaigns" />
            <ButtonLink href="/settings/suppression" label="Suppression" />
            <ButtonLink href="/automation" label="Automation" />
            <ButtonLink href="/optimization" label="Optimization" />
            <ButtonLink href="/reports/weekly" label="Weekly reports" />
            <ButtonLink href="/notifications" label="Notifications" />
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Social funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {query.data.socialFunnel.map((item) => (
                <div
                  key={item.source}
                  className="rounded-lg border border-slate-100 p-3"
                >
                  <div className="flex items-center justify-between">
                    <Badge className={sourceClass(item.source)}>
                      {item.source}
                    </Badge>
                    <span className="text-sm font-semibold text-slate-900">
                      {item.qualified} qualified
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
                    <span>{item.found} found</span>
                    <span>{item.shortlisted} shortlisted</span>
                    <span>{item.manualActions} actions</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Hot social leads</CardTitle>
            <Link
              href="/action-queue"
              className="flex items-center gap-1 text-sm font-medium text-blue-700"
            >
              Action queue <ArrowUpRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {query.data.hotSocialLeads.length === 0 ? (
                <p className="py-6 text-sm text-slate-500">
                  No hot social leads yet. Run a lead hunt with X or Telegram
                  enabled.
                </p>
              ) : (
                query.data.hotSocialLeads.map((lead) => (
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
                        {lead.opportunityUrgency.replaceAll("_", " ")} ·{" "}
                        {lead.sourceCount} source
                        {lead.sourceCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={sourceClass(lead.primarySource)}>
                        {lead.primarySource}
                      </Badge>
                      <span className="w-8 text-right text-sm font-semibold">
                        {lead.overallScore}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ButtonLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 p-4 text-sm font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
    >
      {label}
    </Link>
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

function sourceClass(source: string) {
  if (source === "X") return "border-sky-200 bg-sky-50 text-sky-700";
  if (source === "REDDIT")
    return "border-orange-200 bg-orange-50 text-orange-700";
  if (source === "TELEGRAM") return "border-blue-200 bg-blue-50 text-blue-700";
  return "";
}

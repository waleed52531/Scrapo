"use client";

import { useQuery } from "@tanstack/react-query";
import type { SystemHealth } from "@scrapo/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

const providerLabels: Record<string, string> = {
  openai: "OpenAI",
  gmail: "Gmail",
  webSearch: "Web Search",
  emailEnrichment: "Email Enrichment",
  emailVerification: "Email Verification",
  x: "X",
  reddit: "Reddit",
  telegram: "Telegram",
};

export default function SystemPage() {
  const query = useQuery({
    queryKey: ["system-health"],
    queryFn: () => apiFetch<SystemHealth>("/system/health"),
    refetchInterval: 30_000,
  });

  if (query.isLoading) return <LoadingState label="Checking system health…" />;
  if (query.error || !query.data) {
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  }

  const components = query.data.components;
  return (
    <div>
      <PageHeader
        title="System status"
        description="Production readiness signals for the API, database, Redis, worker, and configured integrations. No credentials are shown here."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatusCard
          title="Overall"
          status={query.data.status}
          subtitle={`Generated ${new Date(query.data.generatedAt).toLocaleString()}`}
        />
        <StatusCard
          title="API"
          status={components.api.status}
          subtitle={`v${components.api.version}`}
        />
        <StatusCard
          title="Database"
          status={components.database.status}
          subtitle="PostgreSQL/Prisma"
        />
        <StatusCard
          title="Redis"
          status={components.redis.status}
          subtitle="BullMQ queue backend"
        />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Worker heartbeat</CardTitle>
            <CardDescription>
              {components.worker.stale
                ? "WORKER OFFLINE or stale"
                : "Worker is reporting liveness"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <StatusLine label="Status" status={components.worker.status} />
            <Line
              label="Worker ID"
              value={components.worker.workerId ?? "Not recorded"}
            />
            <Line
              label="Version"
              value={components.worker.version ?? "Unknown"}
            />
            <Line
              label="Last heartbeat"
              value={
                components.worker.lastHeartbeatAt
                  ? new Date(components.worker.lastHeartbeatAt).toLocaleString()
                  : "Never"
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Launch safety</CardTitle>
            <CardDescription>
              Recommended production defaults keep outreach controlled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Line
              label="Demo auth"
              value={
                query.data.safety.demoAuthEnabled
                  ? "Enabled outside production"
                  : "Disabled"
              }
            />
            <Line
              label="Outreach default"
              value={
                query.data.safety.outreachPausedDefault
                  ? "Paused"
                  : "Not paused"
              }
            />
            <Line
              label="Auto-send"
              value={query.data.safety.autoSendEnabled ? "Enabled" : "Disabled"}
            />
            <Line
              label="Mock providers in production"
              value={
                query.data.safety.mockProvidersAllowedInProduction
                  ? "Explicitly allowed"
                  : "Blocked by default"
              }
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Configured, disabled, degraded, and unavailable providers.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(query.data.providers).map(([key, provider]) => (
            <div
              key={key}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-slate-950">
                  {providerLabels[key] ?? key}
                </p>
                <StatusBadge status={provider.status} />
              </div>
              {provider.message ? (
                <p className="mt-2 text-sm text-slate-500">
                  {provider.message}
                </p>
              ) : null}
              {provider.accountIdentifier ? (
                <p className="mt-2 text-xs text-slate-500">
                  {provider.accountIdentifier}
                </p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCard({
  title,
  status,
  subtitle,
}: {
  title: string;
  status: string;
  subtitle: string;
}) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <StatusBadge status={status} />
        </div>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function StatusLine({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <StatusBadge status={status} />
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "HEALTHY"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "FAILED"
        ? "border-red-200 bg-red-50 text-red-700"
        : status === "DISABLED"
          ? "border-slate-200 bg-slate-50 text-slate-600"
          : "border-amber-200 bg-amber-50 text-amber-700";
  return <Badge className={className}>{status}</Badge>;
}

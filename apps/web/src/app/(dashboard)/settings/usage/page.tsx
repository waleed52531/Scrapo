"use client";

import { useQuery } from "@tanstack/react-query";
import type { UsageSummary } from "@scrapo/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

export default function UsagePage() {
  const query = useQuery({
    queryKey: ["usage-summary"],
    queryFn: () => apiFetch<UsageSummary>("/health/usage"),
  });

  if (query.isLoading) return <LoadingState label="Loading usage controls…" />;
  if (query.error || !query.data) {
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  }

  return (
    <div>
      <PageHeader
        title="Usage & limits"
        description="A production-safe view of provider usage and configured caps. Costs are shown only when a real provider records them."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {Object.entries(query.data.periods).map(([key, period]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="capitalize">{key}</CardTitle>
              <CardDescription>{period.days} day window</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="AI calls" value={period.aiRequests} />
              <Metric
                label="AI tokens"
                value={period.aiInputTokens + period.aiOutputTokens}
              />
              <Metric label="Searches" value={period.searchRequests} />
              <Metric label="Enrichment" value={period.enrichmentRequests} />
              <Metric
                label="Verification"
                value={period.emailVerificationRequests}
              />
              <Metric label="Cold emails" value={period.coldEmailsSent} />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Configured caps</CardTitle>
          <CardDescription>
            When unset, operations use conservative defaults and workspace
            settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(query.data.limits).map(([key, value]) => (
            <Metric
              key={key}
              label={labelize(key)}
              value={value ?? "Not set"}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function labelize(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

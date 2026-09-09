"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WeeklyReport } from "@scrapo/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

export default function WeeklyReportsPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["weekly-reports"],
    queryFn: () => apiFetch<WeeklyReport[]>("/reports/weekly"),
  });
  const generate = useMutation({
    mutationFn: () =>
      apiFetch<WeeklyReport>("/reports/weekly/generate", { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["weekly-reports"] }),
  });

  if (query.isLoading) return <LoadingState label="Loading weekly reports…" />;
  if (query.isError)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;

  return (
    <>
      <PageHeader
        title="Weekly reports"
        description="Automation performance summaries with lead, outreach, reply, and failure metrics."
        action={
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            Generate report
          </Button>
        }
      />
      <div className="grid gap-4">
        {(query.data ?? []).map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle>
                {formatDate(report.weekStart)} → {formatDate(report.weekEnd)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-4">
                {Object.entries(report.metrics ?? {}).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {humanize(key)}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <JsonPanel
                  title="Source performance"
                  value={report.sourcePerformance}
                />
                <JsonPanel
                  title="Query performance"
                  value={report.queryPerformance}
                />
              </div>
            </CardContent>
          </Card>
        ))}
        {query.data?.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-slate-500">
              No weekly reports yet. Generate one to preview the Phase 6 report
              format.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
      <p className="mb-2 font-semibold">{title}</p>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function humanize(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

"use client";

import { useQuery } from "@tanstack/react-query";
import type { AutomationRun } from "@scrapo/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiList } from "@/lib/api";

export default function AutomationRunsPage() {
  const query = useQuery({
    queryKey: ["automation-runs"],
    queryFn: () => apiList<AutomationRun>("/automation-runs?limit=50"),
  });

  if (query.isLoading) return <LoadingState label="Loading automation runs…" />;
  if (query.isError)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;

  const runs = query.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Automation runs"
        description="History for scheduled and manual automation jobs, including summaries and failures."
      />
      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      {run.automationRule?.name ?? run.automationRuleId}
                    </div>
                    <div className="text-xs text-slate-500">
                      {run.scheduledPeriod}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusClass(run.status)}>
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(run.scheduledFor)}</TableCell>
                  <TableCell>{formatDate(run.completedAt)}</TableCell>
                  <TableCell className="max-w-md truncate text-slate-600">
                    {summaryText(run.summary)}
                    {run.error ? ` — ${run.error}` : ""}
                  </TableCell>
                </TableRow>
              ))}
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-slate-500"
                  >
                    No automation runs yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function summaryText(value: unknown) {
  if (!value || typeof value !== "object") return "—";
  return Object.entries(value as Record<string, unknown>)
    .slice(0, 4)
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join(", ");
}

function statusClass(status: string) {
  if (status === "COMPLETED")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "RUNNING") return "border-blue-200 bg-blue-50 text-blue-700";
  return "";
}

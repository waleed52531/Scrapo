"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AutomationRule } from "@scrapo/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

type AutomationStatus = {
  automationPaused: boolean;
  automationKillSwitch: boolean;
  timezone: string;
  rules: AutomationRule[];
};

export default function AutomationPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["automation-status"],
    queryFn: () => apiFetch<AutomationStatus>("/automation/status"),
  });
  const action = useMutation({
    mutationFn: (path: string) => apiFetch(path, { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["automation-status"] }),
        client.invalidateQueries({ queryKey: ["automation-runs"] }),
      ]);
    },
  });

  if (query.isLoading) return <LoadingState label="Loading automation…" />;
  if (query.isError)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;

  const data = query.data!;

  return (
    <>
      <PageHeader
        title="Automation"
        description="Schedule weekly lead hunts, reply sync, follow-up scans, analytics refreshes, and weekly reports."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/automation/runs">View runs</Link>
            </Button>
            <Button
              variant={data.automationPaused ? "default" : "outline"}
              onClick={() =>
                action.mutate(
                  data.automationPaused
                    ? "/automation/resume"
                    : "/automation/pause",
                )
              }
              disabled={action.isPending}
            >
              {data.automationPaused ? "Resume" : "Pause"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => action.mutate("/automation/stop-all")}
              disabled={action.isPending}
            >
              Stop all
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatusCard
          label="Automation paused"
          value={data.automationPaused ? "Yes" : "No"}
        />
        <StatusCard
          label="Kill switch"
          value={data.automationKillSwitch ? "Enabled" : "Off"}
          danger={data.automationKillSwitch}
        />
        <StatusCard label="Timezone" value={data.timezone} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      {rule.name}
                    </div>
                    <div className="text-xs text-slate-500">{rule.type}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        rule.enabled
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : ""
                      }
                    >
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>{rule.scheduleType}</div>
                    <div className="text-xs text-slate-500">
                      {rule.cronExpression ?? rule.timezone}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(rule.lastRunAt)}</TableCell>
                  <TableCell>{formatDate(rule.nextRunAt)}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate(`/automation/${rule.id}/run`)
                      }
                    >
                      Run now
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate(
                          `/automation/${rule.id}/${rule.enabled ? "disable" : "enable"}`,
                        )
                      }
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={action.isPending || !rule.nextRunAt}
                      onClick={() =>
                        action.mutate(`/automation/${rule.id}/skip-next`)
                      }
                    >
                      Skip next
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function StatusCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-slate-500">{label}</p>
        <p
          className={
            danger
              ? "mt-1 text-2xl font-semibold text-red-700"
              : "mt-1 text-2xl font-semibold text-slate-950"
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

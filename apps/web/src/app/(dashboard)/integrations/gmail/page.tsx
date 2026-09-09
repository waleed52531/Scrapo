"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";
import type { GmailIntegrationStatus } from "@scrapo/types";
import { apiFetch } from "@/lib/api";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GmailIntegrationPage() {
  const client = useQueryClient();
  const status = useQuery({
    queryKey: ["gmail-status"],
    queryFn: () => apiFetch<GmailIntegrationStatus>("/integrations/gmail"),
  });
  const action = useMutation({
    mutationFn: (path: string) =>
      apiFetch<GmailIntegrationStatus | { ok: boolean }>(path, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      if (
        typeof data === "object" &&
        data &&
        "connectUrl" in data &&
        data.connectUrl
      ) {
        window.location.href = data.connectUrl;
        return;
      }
      void client.invalidateQueries({ queryKey: ["gmail-status"] });
    },
  });
  const sync = useMutation({
    mutationFn: () =>
      apiFetch<{ jobId: string; status: string }>("/integrations/gmail/sync", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["gmail-status"] }),
  });

  if (status.isLoading) return <LoadingState label="Loading Gmail status…" />;
  if (status.error || !status.data)
    return (
      <ErrorState error={status.error} retry={() => void status.refetch()} />
    );

  const gmail = status.data;
  return (
    <>
      <PageHeader
        title="Gmail Integration"
        description="Backend-only Gmail connection for drafts, sends, and reply sync. Tokens never go to the web app."
        action={
          <Button
            onClick={() => action.mutate("/integrations/gmail/connect")}
            disabled={action.isPending}
          >
            <PlugZap className="h-4 w-4" />
            {gmail.connected ? "Reconnect" : "Connect Gmail"}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{gmail.status}</Badge>
              {gmail.mockMode && (
                <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                  Mock mode
                </Badge>
              )}
            </div>
            <Row
              label="Account"
              value={gmail.accountIdentifier ?? "Not connected"}
            />
            <Row label="Connected at" value={date(gmail.connectedAt)} />
            <Row label="Last sync" value={date(gmail.lastSuccessfulSync)} />
            <Row label="Last error" value={gmail.lastError ?? "None"} />
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => action.mutate("/integrations/gmail/test")}
                disabled={!gmail.connected || action.isPending}
              >
                <ShieldCheck className="h-4 w-4" />
                Test
              </Button>
              <Button
                variant="outline"
                onClick={() => sync.mutate()}
                disabled={!gmail.connected || sync.isPending}
              >
                <RefreshCw className="h-4 w-4" />
                Sync replies
              </Button>
              <Button
                variant="outline"
                onClick={() => action.mutate("/integrations/gmail/disconnect")}
                disabled={!gmail.connected || action.isPending}
              >
                Disconnect
              </Button>
            </div>
            {action.error && (
              <p className="rounded-md bg-red-50 p-3 text-red-700">
                {action.error.message}
              </p>
            )}
            {sync.data && (
              <p className="rounded-md bg-blue-50 p-3 text-blue-700">
                Gmail sync queued: {sync.data.jobId}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Capabilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {Object.entries(gmail.capabilities).map(([key, enabled]) => (
              <Row
                key={key}
                label={label(key)}
                value={enabled ? "Enabled" : "Disabled"}
              />
            ))}
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Scopes
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {gmail.scopes.map((scope) => (
                  <li key={scope}>{scope}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function label(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

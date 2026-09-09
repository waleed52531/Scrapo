"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Play, Radar, RefreshCw } from "lucide-react";
import type { DiscoveryRun, ProviderHealth } from "@scrapo/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiList } from "@/lib/api";
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

export default function LeadHunterPage() {
  const client = useQueryClient();
  const [sources, setSources] = useState(["WEB", "X"]);
  const hunts = useQuery({
    queryKey: ["lead-hunts"],
    queryFn: () => apiList<DiscoveryRun>("/lead-hunts?limit=20"),
    refetchInterval: 5000,
  });
  const webSearch = useQuery({
    queryKey: ["provider-health", "web-search"],
    queryFn: () => apiFetch<ProviderHealth>("/integrations/web-search/health"),
  });
  const enrichment = useQuery({
    queryKey: ["provider-health", "email-enrichment"],
    queryFn: () =>
      apiFetch<ProviderHealth>("/integrations/email-enrichment/health"),
  });
  const verification = useQuery({
    queryKey: ["provider-health", "email-verification"],
    queryFn: () =>
      apiFetch<ProviderHealth>("/integrations/email-verification/health"),
  });
  const xHealth = useQuery({
    queryKey: ["provider-health", "x"],
    queryFn: () => apiFetch<ProviderHealth>("/integrations/x/health"),
  });
  const redditHealth = useQuery({
    queryKey: ["provider-health", "reddit"],
    queryFn: () => apiFetch<ProviderHealth>("/integrations/reddit/health"),
  });
  const telegramHealth = useQuery({
    queryKey: ["provider-health", "telegram"],
    queryFn: () => apiFetch<ProviderHealth>("/integrations/telegram/health"),
  });
  const start = useMutation({
    mutationFn: () =>
      apiFetch<{ leadHuntId: string; jobId: string }>("/lead-hunts", {
        method: "POST",
        body: JSON.stringify({
          name: `Lead hunt ${new Date().toLocaleDateString()}`,
          sources,
          maxQueries: 4,
          maxDiscoveries: 40,
          minimumScore: 82,
          shortlistLimit: 20,
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["lead-hunts"] }),
        client.invalidateQueries({ queryKey: ["shortlist-current"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });

  return (
    <>
      <PageHeader
        title="Lead Hunter"
        description="Phase 4 discovery pipeline: Web, X, Reddit, and Telegram signals feed the same qualification, scoring, shortlist, and manual action queue."
        action={
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            {start.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {start.isPending ? "Starting…" : "Start lead hunt"}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ProviderCard title="Web search" health={webSearch.data} />
        <ProviderCard title="Email enrichment" health={enrichment.data} />
        <ProviderCard title="Email verification" health={verification.data} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Discovery sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { value: "WEB", label: "Web", health: webSearch.data },
              { value: "X", label: "X / Twitter", health: xHealth.data },
              { value: "REDDIT", label: "Reddit", health: redditHealth.data },
              {
                value: "TELEGRAM",
                label: "Telegram",
                health: telegramHealth.data,
              },
            ].map(({ value, label, health }) => (
              <label
                key={value}
                className="rounded-lg border border-slate-200 p-3 text-sm"
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={sources.includes(value)}
                    onChange={(event) =>
                      setSources((current) =>
                        event.target.checked
                          ? [...current, value]
                          : current.filter((item) => item !== value),
                      )
                    }
                  />
                  {label}
                </span>
                <span className="mt-2 block text-xs text-slate-500">
                  {(health as ProviderHealth | undefined)?.status ?? "CHECKING"}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Reddit stays compliance-gated unless explicitly enabled. Telegram
            uses only configured sources.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Discovery runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {hunts.isLoading ? (
            <LoadingState label="Loading lead hunts..." />
          ) : hunts.error || !hunts.data ? (
            <div className="p-4">
              <ErrorState
                error={hunts.error}
                retry={() => void hunts.refetch()}
              />
            </div>
          ) : hunts.data.data.length === 0 ? (
            <EmptyRuns />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Raw</TableHead>
                  <TableHead>Unique</TableHead>
                  <TableHead>Qualified</TableHead>
                  <TableHead>Shortlisted</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {hunts.data.data.map((hunt) => (
                  <TableRow key={hunt.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {hunt.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(hunt.createdAt).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge>{hunt.status}</Badge>
                    </TableCell>
                    <TableCell>{hunt.rawResults}</TableCell>
                    <TableCell>{hunt.uniqueCompanies}</TableCell>
                    <TableCell>{hunt.qualified}</TableCell>
                    <TableCell>{hunt.shortlisted}</TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/lead-hunter/jobs/${hunt.id}`}>
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ProviderCard({
  title,
  health,
}: {
  title: string;
  health?: ProviderHealth;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge>{health?.status ?? "CHECKING"}</Badge>
        <p className="mt-3 text-sm text-slate-600">
          {health?.message ?? "Checking provider configuration..."}
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyRuns() {
  return (
    <div className="grid min-h-56 place-items-center text-center">
      <div>
        <Radar className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium">No lead hunts yet</p>
        <p className="mt-1 text-xs text-slate-500">
          Start a run to create raw leads, companies, contacts and a shortlist.
        </p>
      </div>
    </div>
  );
}

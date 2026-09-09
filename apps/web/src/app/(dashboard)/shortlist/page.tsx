"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, MailPlus, Trophy } from "lucide-react";
import type { OutreachMessage, Shortlist } from "@scrapo/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/api";
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

export default function ShortlistPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["shortlist-current"],
    queryFn: () => apiFetch<Shortlist>("/shortlist/current"),
    refetchInterval: 5000,
  });
  const generate = useMutation({
    mutationFn: (leadId: string) =>
      apiFetch<OutreachMessage>(`/leads/${leadId}/outreach/generate`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["outreach"] }),
  });

  if (query.isLoading) return <LoadingState label="Loading shortlist..." />;
  if (query.error || !query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );

  const shortlist = query.data;
  const items = shortlist.items ?? [];
  return (
    <>
      <PageHeader
        title="Weekly Shortlist"
        description="Ranked, score-snapshotted candidates produced by discovery and Phase 6 ranking."
        action={
          <Button asChild>
            <Link href="/lead-hunter">Run Lead Hunter</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{shortlist.name ?? "Current shortlist"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-center">
              <div>
                <Trophy className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-medium">No shortlist yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Start a Lead Hunter run to generate ranked prospects.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Lead score</TableHead>
                  <TableHead>Ranking</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-52" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>#{item.rank}</TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {item.lead.company?.name ?? item.lead.title}
                      </div>
                      <div className="max-w-sm truncate text-xs text-slate-500">
                        {item.lead.opportunitySummary}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{item.lead.contact?.fullName ?? "—"}</div>
                      <div className="text-xs text-slate-500">
                        {item.lead.contact?.email ?? "No email"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        {item.scoreAtSelection}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-blue-700">
                        {item.rankingScore || item.lead.rankingScore || "—"}
                      </span>
                      {(item.rankReason?.[0] ?? item.lead.rankReason?.[0]) ? (
                        <div className="max-w-48 truncate text-xs text-slate-500">
                          {item.rankReason?.[0] ?? item.lead.rankReason?.[0]}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge>{item.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generate.mutate(item.leadId)}
                          disabled={generate.isPending}
                        >
                          <MailPlus className="h-4 w-4" />
                          Generate
                        </Button>
                        <Button asChild variant="ghost" size="icon">
                          <Link href={`/leads/${item.leadId}`}>
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {generate.error && (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {generate.error.message}
        </p>
      )}
      {generate.data && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
          Outreach generated: {generate.data.subject}
        </p>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban } from "lucide-react";
import type { DiscoveryRun } from "@scrapo/types";
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

export default function LeadHuntDetailPage() {
  const params = useParams<{ id: string }>();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["lead-hunt", params.id],
    queryFn: () => apiFetch<DiscoveryRun>(`/lead-hunts/${params.id}`),
    refetchInterval: 5000,
  });
  const cancel = useMutation({
    mutationFn: () =>
      apiFetch<DiscoveryRun>(`/lead-hunts/${params.id}/cancel`, {
        method: "POST",
      }),
    onSuccess: async () =>
      client.invalidateQueries({ queryKey: ["lead-hunt", params.id] }),
  });

  if (query.isLoading) return <LoadingState label="Loading lead hunt..." />;
  if (query.error || !query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const hunt = query.data;

  return (
    <>
      <PageHeader
        title={hunt.name}
        description="Detailed Phase 3 discovery job progress and generated candidates."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/lead-hunter">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            {!["COMPLETED", "FAILED", "CANCELLED"].includes(hunt.status) && (
              <Button
                variant="outline"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
              >
                <Ban className="h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Status" value={hunt.status} />
        <Metric label="Raw results" value={hunt.rawResults} />
        <Metric label="Unique companies" value={hunt.uniqueCompanies} />
        <Metric label="Shortlisted" value={hunt.shortlisted} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Query runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Qualified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(hunt.queryRuns ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="max-w-xl truncate">{item.query}</div>
                    <div className="text-xs text-slate-500">
                      {[item.country, item.category]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge>{item.status}</Badge>
                  </TableCell>
                  <TableCell>{item.provider}</TableCell>
                  <TableCell>{item.resultsFound}</TableCell>
                  <TableCell>{item.qualifiedCompanies}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Generated leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100">
            {(hunt.leads ?? []).map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between gap-4 py-3 hover:text-blue-700"
              >
                <div>
                  <p className="font-medium">
                    {lead.company?.name ?? lead.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {lead.contact?.email ?? "No email yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{lead.temperature}</Badge>
                  <span className="font-semibold">{lead.overallScore}</span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

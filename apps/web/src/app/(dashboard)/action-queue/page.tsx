"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, SkipForward } from "lucide-react";
import type { ActionItem } from "@scrapo/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ActionQueuePage() {
  const query = useQuery({
    queryKey: ["action-queue"],
    queryFn: () => apiFetch<ActionItem[]>("/action-queue"),
    refetchInterval: 5000,
  });
  if (query.isLoading) return <LoadingState label="Loading action queue..." />;
  if (query.error || !query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );

  return (
    <>
      <PageHeader
        title="Action Queue"
        description="Manual social outreach suggestions. Nothing is sent automatically."
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Suggested response</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge>{item.actionType ?? item.type}</Badge>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.platform ?? "MANUAL"} · expires{" "}
                      {item.expiresAt
                        ? new Date(item.expiresAt).toLocaleDateString()
                        : "never"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.lead ? (
                      <Link
                        href={`/leads/${item.lead.id}`}
                        className="font-medium text-slate-900 hover:text-blue-700"
                      >
                        {item.lead.company?.name ?? item.lead.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                    <div className="text-xs text-slate-500">
                      {item.contact?.fullName ??
                        item.lead?.contact?.fullName ??
                        "No contact"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-xl text-sm text-slate-700">
                      {item.suggestedText ?? item.content ?? "No suggestion"}
                    </p>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700"
                      >
                        Open original <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge>{item.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <ActionButtons item={item} />
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

function ActionButtons({ item }: { item: ActionItem }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (status: "COMPLETED" | "SKIPPED") =>
      apiFetch(`/action-queue/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["action-queue"] }),
  });
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate("COMPLETED")}
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate("SKIPPED")}
      >
        <SkipForward className="h-4 w-4 text-slate-500" />
      </Button>
    </div>
  );
}

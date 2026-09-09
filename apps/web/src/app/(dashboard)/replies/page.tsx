"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import type { EmailReply } from "@scrapo/types";
import { apiFetch, apiList } from "@/lib/api";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RepliesPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["replies"],
    queryFn: () => apiList<EmailReply>("/replies?limit=50"),
    refetchInterval: 8000,
  });
  const reclassify = useMutation({
    mutationFn: (id: string) =>
      apiFetch<EmailReply>(`/replies/${id}/reclassify`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["replies"] }),
  });

  if (query.isLoading) return <LoadingState label="Loading replies…" />;
  if (query.error || !query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );

  return (
    <>
      <PageHeader
        title="Replies"
        description="Tracked Gmail thread replies with deterministic classification and CRM status updates."
      />
      <div className="space-y-4">
        {query.data.data.map((reply) => (
          <Card key={reply.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                <span>{reply.subject ?? "Reply"}</span>
                <span className="flex gap-2">
                  <Badge>{reply.classification ?? "UNCLEAR"}</Badge>
                  {reply.requiresResponse && (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                      Needs response
                    </Badge>
                  )}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-2 md:grid-cols-3">
                <Info label="From" value={reply.fromEmail ?? "—"} />
                <Info
                  label="Lead"
                  value={reply.lead?.company?.name ?? reply.lead?.title ?? "—"}
                />
                <Info
                  label="Received"
                  value={new Date(reply.receivedAt).toLocaleString()}
                />
              </div>
              <p className="whitespace-pre-line rounded-lg bg-slate-50 p-4 leading-6 text-slate-700">
                {reply.bodyText ?? reply.body}
              </p>
              {reply.summary && (
                <p className="rounded-lg bg-blue-50 p-3 text-blue-800">
                  {reply.summary}{" "}
                  {reply.recommendedAction
                    ? `· ${reply.recommendedAction}`
                    : ""}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => reclassify.mutate(reply.id)}
                disabled={reclassify.isPending}
              >
                <RefreshCw className="h-4 w-4" />
                Reclassify
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {reclassify.error && (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {reclassify.error.message}
        </p>
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}

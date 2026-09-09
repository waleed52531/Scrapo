"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SuppressionEntry } from "@scrapo/types";
import { apiFetch } from "@/lib/api";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SuppressionPage() {
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("Manual suppression");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["suppression"],
    queryFn: () => apiFetch<SuppressionEntry[]>("/settings/suppression"),
  });
  const create = useMutation({
    mutationFn: () =>
      apiFetch<SuppressionEntry>("/settings/suppression", {
        method: "POST",
        body: JSON.stringify({
          ...(target.includes("@") ? { email: target } : { domain: target }),
          reason,
        }),
      }),
    onSuccess: () => {
      setTarget("");
      void client.invalidateQueries({ queryKey: ["suppression"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/settings/suppression/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["suppression"] }),
  });

  if (query.isLoading)
    return <LoadingState label="Loading suppression list…" />;
  if (query.error || !query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );

  return (
    <>
      <PageHeader
        title="Suppression"
        description="Emails, domains, and contacts that must never receive cold outreach."
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add suppression entry</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="email@example.com or example.com"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !target.trim() || !reason.trim()}
          >
            Add
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {query.data.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">
                    {item.email ??
                      item.domain ??
                      item.contact?.fullName ??
                      item.contactId}
                  </span>
                  <Badge>{item.source}</Badge>
                </div>
                <p className="mt-1 text-slate-500">{item.reason}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => remove.mutate(item.id)}
                disabled={remove.isPending}
              >
                Remove
              </Button>
            </CardContent>
          </Card>
        ))}
        {query.data.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              No suppression entries yet.
            </CardContent>
          </Card>
        )}
      </div>
      {(create.error || remove.error) && (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {(create.error ?? remove.error)?.message}
        </p>
      )}
    </>
  );
}

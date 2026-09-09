"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, MailPlus, Send, XCircle } from "lucide-react";
import type { OutreachMessage } from "@scrapo/types";
import { apiFetch, apiList } from "@/lib/api";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function OutreachPage() {
  const [editing, setEditing] = useState<OutreachMessage | null>(null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["outreach"],
    queryFn: () => apiList<OutreachMessage>("/outreach?limit=50"),
    refetchInterval: 8000,
  });
  const action = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) =>
      apiFetch<OutreachMessage>(`/outreach/${id}/${path}`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      setEditing(null);
      void client.invalidateQueries({ queryKey: ["outreach"] });
    },
  });
  const save = useMutation({
    mutationFn: (message: OutreachMessage) =>
      apiFetch<OutreachMessage>(`/outreach/${message.id}`, {
        method: "PATCH",
        body: JSON.stringify({ subject: message.subject, body: message.body }),
      }),
    onSuccess: () => {
      setEditing(null);
      void client.invalidateQueries({ queryKey: ["outreach"] });
    },
  });

  if (query.isLoading) return <LoadingState label="Loading outreach…" />;
  if (query.error || !query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );

  return (
    <>
      <PageHeader
        title="Outreach"
        description="Generated email outreach, Gmail drafts, approvals, sends, replies, and one-shot follow-ups."
        action={
          <Button asChild variant="outline">
            <Link href="/shortlist">Generate from shortlist</Link>
          </Button>
        }
      />
      <div className="space-y-4">
        {query.data.data.map((message) => (
          <Card key={message.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                <span>{message.subject ?? "Untitled outreach"}</span>
                <span className="flex flex-wrap gap-2">
                  <Badge>{message.status}</Badge>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                    {message.strategy}
                  </Badge>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm md:grid-cols-3">
                <Info
                  label="Lead"
                  value={
                    message.lead?.company?.name ?? message.lead?.title ?? "—"
                  }
                />
                <Info
                  label="Contact"
                  value={message.contact?.fullName ?? "—"}
                />
                <Info label="Confidence" value={`${message.confidence}%`} />
              </div>
              <p className="whitespace-pre-line rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {message.body}
              </p>
              {message.personalizationPoints?.length > 0 && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                  {message.personalizationPoints.join(" · ")}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(message)}
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    action.mutate({ id: message.id, path: "create-draft" })
                  }
                  disabled={action.isPending || terminal(message.status)}
                >
                  <MailPlus className="h-4 w-4" />
                  Create draft
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    action.mutate({ id: message.id, path: "approve" })
                  }
                  disabled={action.isPending || terminal(message.status)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    action.mutate({ id: message.id, path: "send" })
                  }
                  disabled={action.isPending || terminal(message.status)}
                >
                  <Send className="h-4 w-4" />
                  Send
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    action.mutate({ id: message.id, path: "cancel" })
                  }
                  disabled={action.isPending || terminal(message.status)}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
                </Button>
                {message.status === "SENT" || message.status === "DELIVERED" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      action.mutate({
                        id: message.id,
                        path: "follow-up/generate",
                      })
                    }
                    disabled={action.isPending}
                  >
                    Generate follow-up
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Edit outreach</h2>
            <div className="mt-4 space-y-3">
              <Input
                value={editing.subject ?? ""}
                onChange={(event) =>
                  setEditing({ ...editing, subject: event.target.value })
                }
              />
              <textarea
                className="min-h-72 w-full rounded-md border border-slate-200 p-3 text-sm"
                value={editing.body}
                onChange={(event) =>
                  setEditing({ ...editing, body: event.target.value })
                }
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Close
              </Button>
              <Button
                onClick={() => save.mutate(editing)}
                disabled={save.isPending}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
      {(action.error || save.error) && (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {(action.error ?? save.error)?.message}
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

function terminal(status: string) {
  return [
    "SENT",
    "DELIVERED",
    "REPLIED",
    "FOLLOW_UP_SENT",
    "FAILED",
    "CANCELLED",
    "SUPPRESSED",
  ].includes(status);
}

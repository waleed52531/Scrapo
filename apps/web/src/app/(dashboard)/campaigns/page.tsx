"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Campaign, OutreachStrategy } from "@scrapo/types";
import { apiFetch } from "@/lib/api";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const strategies: OutreachStrategy[] = [
  "AGENCY_PARTNERSHIP",
  "ACTIVE_REQUIREMENT",
  "MVP_STARTUP",
  "EXISTING_APP_FIX",
  "FIREBASE_API_SUPPORT",
  "APP_STORE_SUPPORT",
  "GENERAL_MOBILE_SUPPORT",
  "CUSTOM",
];

export default function CampaignsPage() {
  const [name, setName] = useState("Agency Mobile Development Partnerships");
  const [strategy, setStrategy] =
    useState<OutreachStrategy>("AGENCY_PARTNERSHIP");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => apiFetch<Campaign[]>("/campaigns"),
  });
  const create = useMutation({
    mutationFn: () =>
      apiFetch<Campaign>("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name,
          strategy,
          weeklyLimit: 20,
          followUpMode: "DRAFT",
        }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["campaigns"] }),
  });
  const action = useMutation({
    mutationFn: ({ id, path }: { id: string; path: "activate" | "pause" }) =>
      apiFetch<Campaign>(`/campaigns/${id}/${path}`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  if (query.isLoading) return <LoadingState label="Loading campaigns…" />;
  if (query.error || !query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Campaign guardrails for cold outreach. Auto-send stays disabled unless explicitly configured."
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create campaign</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_260px_auto]">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={strategy}
            onChange={(event) =>
              setStrategy(event.target.value as OutreachStrategy)
            }
          >
            {strategies.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Create
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {query.data.map((campaign) => (
          <Card key={campaign.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span>{campaign.name}</span>
                <Badge>{campaign.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-3">
                <Info label="Strategy" value={String(campaign.strategy)} />
                <Info label="Weekly cap" value={String(campaign.weeklyLimit)} />
                <Info
                  label="Follow-up"
                  value={`${campaign.followUpDays}d · ${campaign.followUpMode}`}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <Info
                  label="Sent"
                  value={String(campaign.analytics?.sent ?? 0)}
                />
                <Info
                  label="Replies"
                  value={String(campaign.analytics?.replies ?? 0)}
                />
                <Info
                  label="Reply rate"
                  value={`${campaign.analytics?.replyRate ?? 0}%`}
                />
                <Info
                  label="Meetings"
                  value={String(campaign.analytics?.meetings ?? 0)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    action.mutate({ id: campaign.id, path: "activate" })
                  }
                  disabled={action.isPending || campaign.status === "ACTIVE"}
                >
                  Activate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    action.mutate({ id: campaign.id, path: "pause" })
                  }
                  disabled={action.isPending || campaign.status === "PAUSED"}
                >
                  Pause
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {(create.error || action.error) && (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {(create.error ?? action.error)?.message}
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

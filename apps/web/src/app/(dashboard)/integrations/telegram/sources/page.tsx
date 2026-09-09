"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { z } from "zod";
import type { TelegramSource } from "@scrapo/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const schema = z.object({
  name: z.string().min(2),
  username: z.string(),
  type: z.enum(["CHANNEL", "GROUP"]),
  keywords: z.string(),
});
type SourceForm = z.infer<typeof schema>;

export default function TelegramSourcesPage() {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["telegram-sources"],
    queryFn: () => apiFetch<TelegramSource[]>("/telegram/sources"),
  });
  if (query.isLoading)
    return <LoadingState label="Loading Telegram sources..." />;
  if (query.error || !query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );

  return (
    <>
      <PageHeader
        title="Telegram Sources"
        description="Configured channels/groups only. No uncontrolled Telegram scraping or cold DM automation."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add source
          </Button>
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <div className="font-medium">{source.name}</div>
                    <div className="text-xs text-slate-500">
                      {source.username
                        ? `@${source.username}`
                        : (source.externalId ?? "No handle")}
                    </div>
                  </TableCell>
                  <TableCell>{source.type}</TableCell>
                  <TableCell>
                    <Badge>{source.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate">
                      {(source.keywords ?? []).join(", ")}
                    </div>
                  </TableCell>
                  <TableCell>
                    {source.lastSyncedAt
                      ? new Date(source.lastSyncedAt).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <SourceActions source={source} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <SourceModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function SourceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const form = useForm<SourceForm>({
    resolver: zodResolver(schema),
    values: {
      name: "",
      username: "",
      type: "CHANNEL",
      keywords: "flutter, mobile developer, firebase, MVP",
    },
  });
  const mutation = useMutation({
    mutationFn: (data: SourceForm) =>
      apiFetch<TelegramSource>("/telegram/sources", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          username: data.username || undefined,
          keywords: data.keywords
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["telegram-sources"] });
      onClose();
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Telegram source"
      description="Add only channels/groups you are allowed to monitor."
    >
      <form
        className="grid gap-4"
        onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
      >
        <Field label="Name">
          <Input {...form.register("name")} />
        </Field>
        <Field label="Username">
          <Input placeholder="flutter_jobs" {...form.register("username")} />
        </Field>
        <Field label="Type">
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            {...form.register("type")}
          >
            <option>CHANNEL</option>
            <option>GROUP</option>
          </select>
        </Field>
        <Field label="Keywords">
          <Input {...form.register("keywords")} />
        </Field>
        {mutation.error && (
          <p className="text-sm text-red-600">{mutation.error.message}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save source"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SourceActions({ source }: { source: TelegramSource }) {
  const client = useQueryClient();
  const sync = useMutation({
    mutationFn: () =>
      apiFetch(`/telegram/sources/${source.id}/sync`, { method: "POST" }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["telegram-sources"] }),
  });
  const del = useMutation({
    mutationFn: () =>
      apiFetch(`/telegram/sources/${source.id}`, { method: "DELETE" }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["telegram-sources"] }),
  });
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={sync.isPending}
        onClick={() => sync.mutate()}
      >
        <RefreshCw className="h-4 w-4 text-blue-600" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={del.isPending}
        onClick={() => del.mutate()}
      >
        <Trash2 className="h-4 w-4 text-red-600" />
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

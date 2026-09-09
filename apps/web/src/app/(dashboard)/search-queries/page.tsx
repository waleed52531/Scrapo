"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { z } from "zod";
import type { SearchQuery } from "@scrapo/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { apiFetch, apiList } from "@/lib/api";
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
  query: z.string().min(3, "Search query is required."),
  source: z.enum(["WEB", "X", "REDDIT", "TELEGRAM"]),
  country: z.string(),
  category: z.string(),
  priority: z.coerce.number().int().min(0).max(100),
});
type QueryInput = z.input<typeof schema>;
type QueryForm = z.output<typeof schema>;

export default function SearchQueriesPage() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const queries = useQuery({
    queryKey: ["search-queries", search, source],
    queryFn: () =>
      apiList<SearchQuery>(
        `/search-queries?limit=100&search=${encodeURIComponent(search)}${source ? `&source=${source}` : ""}`,
      ),
  });
  const defaults = useMutation({
    mutationFn: () =>
      apiFetch<SearchQuery[]>("/search-queries/defaults", { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["search-queries"] }),
  });

  return (
    <>
      <PageHeader
        title="Search Queries"
        description="Manage search phrases for Web, X, Reddit, and Telegram discovery."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => defaults.mutate()}
              disabled={defaults.isPending}
            >
              Install defaults
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Add query
            </Button>
          </div>
        }
      />
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search queries…"
                className="pl-9"
              />
            </div>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="">All sources</option>
              <option value="WEB">Web</option>
              <option value="X">X</option>
              <option value="REDDIT">Reddit</option>
              <option value="TELEGRAM">Telegram</option>
            </select>
          </div>
          {queries.isLoading ? (
            <LoadingState />
          ) : queries.error || !queries.data ? (
            <div className="p-4">
              <ErrorState
                error={queries.error}
                retry={() => void queries.refetch()}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Query</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Metrics</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {queries.data.data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="max-w-xl truncate font-medium">
                        {item.query}
                      </div>
                      <div className="text-xs text-slate-500">
                        Priority {item.priority} ·{" "}
                        {item.enabled ? "Enabled" : "Disabled"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={sourceClass(item.source)}>
                        {item.source}
                      </Badge>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.country ?? "Global"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge>{item.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs leading-5 text-slate-600">
                        Found {item.totalResults} · relevant{" "}
                        {item.relevantResults} · prequalified{" "}
                        {item.prequalifiedResults}
                      </div>
                      <div className="text-xs leading-5 text-slate-600">
                        Shortlisted {item.shortlisted} · actions{" "}
                        {item.manualActions} · quality {item.qualityScore}/100
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.lastRunAt
                        ? new Date(item.lastRunAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <DeleteQuery query={item} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <QueryModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function QueryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const client = useQueryClient();
  const form = useForm<QueryInput, unknown, QueryForm>({
    resolver: zodResolver(schema),
    values: {
      query: "",
      source: "WEB",
      country: "",
      category: "CUSTOM",
      priority: 50,
    },
  });
  const mutation = useMutation({
    mutationFn: (data: QueryForm) =>
      apiFetch<SearchQuery>("/search-queries", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          country: data.country || undefined,
          category: data.category || "CUSTOM",
        }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["search-queries"] });
      onClose();
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add search query"
      description="Queries are run by the backend worker during a lead hunt."
    >
      <form
        className="grid gap-4"
        onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
      >
        <Field label="Query" error={form.formState.errors.query?.message}>
          <Input {...form.register("query")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Source">
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              {...form.register("source")}
            >
              <option value="WEB">Web</option>
              <option value="X">X</option>
              <option value="REDDIT">Reddit</option>
              <option value="TELEGRAM">Telegram</option>
            </select>
          </Field>
          <Field label="Country">
            <Input placeholder="United Kingdom" {...form.register("country")} />
          </Field>
          <Field label="Category">
            <Input placeholder="WEB_AGENCY" {...form.register("category")} />
          </Field>
          <Field label="Priority">
            <Input type="number" {...form.register("priority")} />
          </Field>
        </div>
        {mutation.error && (
          <p className="text-sm text-red-600">{mutation.error.message}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save query"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteQuery({ query }: { query: SearchQuery }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/search-queries/${query.id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["search-queries"] }),
  });
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={mutation.isPending}
      onClick={() => {
        if (window.confirm("Delete this query?")) mutation.mutate();
      }}
    >
      <Trash2 className="h-4 w-4 text-red-600" />
    </Button>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function sourceClass(source: string) {
  if (source === "X") return "border-sky-200 bg-sky-50 text-sky-700";
  if (source === "REDDIT")
    return "border-orange-200 bg-orange-50 text-orange-700";
  if (source === "TELEGRAM") return "border-blue-200 bg-blue-50 text-blue-700";
  return "";
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, ListFilter, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { z } from "zod";
import type { Company, Contact, Lead } from "@scrapo/types";
import { apiFetch, apiList } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
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
import { ErrorState, LoadingState } from "@/components/data-states";

const statuses = [
  "NEW",
  "ANALYZING",
  "QUALIFIED",
  "SHORTLISTED",
  "DRAFTED",
  "APPROVED",
  "CONTACTED",
  "FOLLOW_UP",
  "REPLIED",
  "INTERESTED",
  "MEETING",
  "PROPOSAL",
  "WON",
  "LOST",
  "NOT_INTERESTED",
  "DO_NOT_CONTACT",
  "INVALID",
  "STALE",
  "ARCHIVED",
] as const;
const schema = z.object({
  title: z.string().min(3, "Title is required."),
  companyId: z.string(),
  contactId: z.string(),
  primarySource: z.enum([
    "X",
    "REDDIT",
    "TELEGRAM",
    "WEB",
    "AGENCY_DIRECTORY",
    "LINKEDIN",
    "OTHER",
    "MANUAL",
  ]),
  leadType: z.enum([
    "AGENCY_PARTNER",
    "ACTIVE_REQUIREMENT",
    "BUSINESS_OPPORTUNITY",
    "MVP_STARTUP",
    "EXISTING_APP_FIX",
    "FIREBASE_API_SUPPORT",
    "APP_STORE_SUPPORT",
    "GENERAL_MOBILE_SUPPORT",
    "MANUAL",
    "INVALID",
    "PERMANENT_JOB",
    "OTHER",
  ]),
  status: z.enum(statuses),
  overallScore: z.coerce.number().int().min(0).max(100),
  opportunitySummary: z.string(),
  recommendedPitch: z.string(),
  sourceUrl: z.string(),
  sourceContent: z.string(),
  publishedAt: z.string(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Lead | null | undefined>(undefined);
  const query = useQuery({
    queryKey: ["leads", search, status],
    queryFn: () =>
      apiList<Lead>(
        `/leads?limit=100&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}`,
      ),
  });
  return (
    <>
      <PageHeader
        title="All Leads"
        description="Qualified opportunities managed through the shared REST API."
        action={
          <Button onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" />
            Add lead
          </Button>
        }
      />
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search leads…"
                className="pl-9"
              />
            </div>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          {query.isLoading ? (
            <LoadingState />
          ) : query.error || !query.data ? (
            <div className="p-4">
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            </div>
          ) : query.data.data.length === 0 ? (
            <Empty />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium text-slate-900 hover:text-blue-700"
                      >
                        {lead.company?.name ?? lead.title}
                      </Link>
                      <div className="max-w-xs truncate text-xs text-slate-500">
                        {lead.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{lead.contact?.fullName ?? "—"}</div>
                      <div className="text-xs text-slate-500">
                        {lead.contact?.role}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge>{lead.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={sourceClass(lead.primarySource)}>
                        {lead.primarySource}
                      </Badge>
                      {(lead._count?.signals ?? 0) > 0 && (
                        <div className="mt-1 text-xs text-slate-500">
                          {lead._count?.signals} signal
                          {(lead._count?.signals ?? 0) === 1 ? "" : "s"}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{lead.overallScore}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {lead.temperature}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-blue-700">
                        {lead.rankingScore || "—"}
                      </span>
                      {lead.rankReason?.[0] ? (
                        <div className="max-w-44 truncate text-xs text-slate-500">
                          {lead.rankReason[0]}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon">
                          <Link
                            href={`/leads/${lead.id}`}
                            aria-label="Open lead"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditing(lead)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteLead lead={lead} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <LeadModal value={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}

function LeadModal({
  value,
  onClose,
}: {
  value: Lead | null | undefined;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const companies = useQuery({
    queryKey: ["companies", "select"],
    queryFn: () => apiList<Company>("/companies?limit=100"),
  });
  const contacts = useQuery({
    queryKey: ["contacts", "select"],
    queryFn: () => apiList<Contact>("/contacts?limit=100"),
  });
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    values: {
      title: value?.title ?? "",
      companyId: value?.companyId ?? "",
      contactId: value?.contactId ?? "",
      primarySource: value?.primarySource ?? "MANUAL",
      leadType: value?.leadType ?? "MANUAL",
      status: value?.status ?? "NEW",
      overallScore: value?.overallScore ?? 0,
      opportunitySummary: value?.opportunitySummary ?? "",
      recommendedPitch: value?.recommendedPitch ?? "",
      sourceUrl: value?.sourceUrl ?? "",
      sourceContent: value?.sourceContent ?? "",
      publishedAt: value?.publishedAt?.slice(0, 10) ?? "",
    },
  });
  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch<Lead>(value ? `/leads/${value.id}` : "/leads", {
        method: value ? "PATCH" : "POST",
        body: JSON.stringify({
          ...data,
          companyId: data.companyId || undefined,
          contactId: data.contactId || undefined,
          sourceUrl: data.sourceUrl || undefined,
          sourceContent: data.sourceContent || undefined,
          publishedAt: data.publishedAt || undefined,
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["leads"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      onClose();
    },
  });
  return (
    <Modal
      open={value !== undefined}
      onClose={onClose}
      title={value ? "Edit lead" : "Add lead"}
      description="Manual leads can include a company website, source URL, or pasted opportunity text for Phase 2 analysis."
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
      >
        <Field label="Title" error={form.formState.errors.title?.message} wide>
          <Input {...form.register("title")} />
        </Field>
        <Field label="Company">
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            {...form.register("companyId")}
          >
            <option value="">No company</option>
            {companies.data?.data.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contact">
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            {...form.register("contactId")}
          >
            <option value="">No contact</option>
            {contacts.data?.data.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            {...form.register("primarySource")}
          >
            {[
              "MANUAL",
              "WEB",
              "X",
              "REDDIT",
              "TELEGRAM",
              "LINKEDIN",
              "OTHER",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Lead type">
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            {...form.register("leadType")}
          >
            {[
              "MANUAL",
              "AGENCY_PARTNER",
              "ACTIVE_REQUIREMENT",
              "BUSINESS_OPPORTUNITY",
              "MVP_STARTUP",
              "EXISTING_APP_FIX",
              "FIREBASE_API_SUPPORT",
              "APP_STORE_SUPPORT",
              "GENERAL_MOBILE_SUPPORT",
              "PERMANENT_JOB",
              "INVALID",
              "OTHER",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            {...form.register("status")}
          >
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Score">
          <Input
            type="number"
            min="0"
            max="100"
            {...form.register("overallScore")}
          />
        </Field>
        <Field label="Published date">
          <Input type="date" {...form.register("publishedAt")} />
        </Field>
        <Field label="Source URL" wide>
          <Input
            placeholder="https://x.com/example/status/1"
            {...form.register("sourceUrl")}
          />
        </Field>
        <Field label="Opportunity summary" wide>
          <textarea
            className="min-h-20 w-full rounded-md border border-slate-200 p-3 text-sm"
            {...form.register("opportunitySummary")}
          />
        </Field>
        <Field label="Pasted opportunity text" wide>
          <textarea
            className="min-h-28 w-full rounded-md border border-slate-200 p-3 text-sm"
            {...form.register("sourceContent")}
          />
        </Field>
        <Field label="Recommended pitch" wide>
          <textarea
            className="min-h-20 w-full rounded-md border border-slate-200 p-3 text-sm"
            {...form.register("recommendedPitch")}
          />
        </Field>
        {mutation.error && (
          <p className="sm:col-span-2 text-sm text-red-600">
            {mutation.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save lead"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteLead({ lead }: { lead: Lead }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => apiFetch(`/leads/${lead.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["leads"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={mutation.isPending}
      onClick={() => {
        if (window.confirm(`Delete ${lead.title}?`)) mutation.mutate();
      }}
    >
      <Trash2 className="h-4 w-4 text-red-600" />
    </Button>
  );
}
function Field({
  label,
  error,
  wide,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
function Empty() {
  return (
    <div className="grid min-h-56 place-items-center text-center">
      <div>
        <ListFilter className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium">No leads found</p>
        <p className="mt-1 text-xs text-slate-500">
          Add a manual lead or adjust your filters.
        </p>
      </div>
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

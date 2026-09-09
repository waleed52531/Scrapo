"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ContactRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { z } from "zod";
import type { Company, Contact } from "@scrapo/types";
import { apiFetch, apiList } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const schema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  role: z.string(),
  email: z.union([z.literal(""), z.email("Enter a valid email.")]),
  companyId: z.string(),
  emailStatus: z.enum([
    "UNKNOWN",
    "GUESSED",
    "LIKELY_VALID",
    "UNVERIFIED",
    "VERIFIED",
    "INVALID",
    "BOUNCED",
  ]),
  decisionMakerScore: z.coerce.number().int().min(0).max(100),
  contactConfidence: z.coerce.number().int().min(0).max(100),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined);
  const query = useQuery({
    queryKey: ["contacts", search],
    queryFn: () =>
      apiList<Contact>(
        `/contacts?limit=100&search=${encodeURIComponent(search)}`,
      ),
  });
  return (
    <>
      <PageHeader
        title="Contacts"
        description="Decision-makers and company contacts in this workspace."
        action={
          <Button onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" />
            Add contact
          </Button>
        }
      />
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-slate-100 p-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search contacts…"
                className="pl-9"
              />
            </div>
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
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Decision-maker</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {contact.fullName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {contact.role ?? "Role unknown"}
                      </div>
                    </TableCell>
                    <TableCell>{contact.company?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div>{contact.email ?? "—"}</div>
                      <Badge
                        className={
                          contact.emailStatus === "VERIFIED" ||
                          contact.emailStatus === "LIKELY_VALID"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : ""
                        }
                      >
                        {contact.emailStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        {contact.decisionMakerScore}
                      </span>
                      /100
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <VerifyContact contact={contact} />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditing(contact)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteContact contact={contact} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ContactModal value={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}

function ContactModal({
  value,
  onClose,
}: {
  value: Contact | null | undefined;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const companies = useQuery({
    queryKey: ["companies", "select"],
    queryFn: () => apiList<Company>("/companies?limit=100"),
  });
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    values: {
      fullName: value?.fullName ?? "",
      role: value?.role ?? "",
      email: value?.email ?? "",
      companyId: value?.companyId ?? "",
      emailStatus: value?.emailStatus ?? "UNKNOWN",
      decisionMakerScore: value?.decisionMakerScore ?? 0,
      contactConfidence: value?.contactConfidence ?? 0,
    },
  });
  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch<Contact>(value ? `/contacts/${value.id}` : "/contacts", {
        method: value ? "PATCH" : "POST",
        body: JSON.stringify({
          ...data,
          companyId: data.companyId || undefined,
          email: data.email || undefined,
        }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["contacts"] });
      onClose();
    },
  });
  return (
    <Modal
      open={value !== undefined}
      onClose={onClose}
      title={value ? "Edit contact" : "Add contact"}
      description="Emails are never fabricated; choose the correct verification state."
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
      >
        <Field
          label="Full name"
          error={form.formState.errors.fullName?.message}
        >
          <Input {...form.register("fullName")} />
        </Field>
        <Field label="Role">
          <Input placeholder="Founder" {...form.register("role")} />
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" {...form.register("email")} />
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
        <Field label="Email status">
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            {...form.register("emailStatus")}
          >
            {[
              "UNKNOWN",
              "GUESSED",
              "LIKELY_VALID",
              "UNVERIFIED",
              "VERIFIED",
              "INVALID",
              "BOUNCED",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
        <Field label="Decision-maker score">
          <Input type="number" {...form.register("decisionMakerScore")} />
        </Field>
        <Field label="Contact confidence">
          <Input type="number" {...form.register("contactConfidence")} />
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
            {mutation.isPending ? "Saving…" : "Save contact"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function VerifyContact({ contact }: { contact: Contact }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/contacts/${contact.id}/verify-email`, { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["contacts"] }),
        client.invalidateQueries({ queryKey: ["jobs"] }),
      ]);
    },
  });
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={mutation.isPending || !contact.email}
      onClick={() => mutation.mutate()}
      aria-label={`Verify ${contact.fullName}`}
    >
      <ShieldCheck className="h-4 w-4 text-emerald-600" />
    </Button>
  );
}
function DeleteContact({ contact }: { contact: Contact }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => apiFetch(`/contacts/${contact.id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["contacts"] }),
  });
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={mutation.isPending}
      onClick={() => {
        if (
          window.confirm(
            `Delete ${contact.fullName}? Leads will be unassigned.`,
          )
        )
          mutation.mutate();
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
function Empty() {
  return (
    <div className="grid min-h-56 place-items-center text-center">
      <div>
        <ContactRound className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium">No contacts found</p>
        <p className="mt-1 text-xs text-slate-500">
          Add your first decision-maker contact.
        </p>
      </div>
    </div>
  );
}

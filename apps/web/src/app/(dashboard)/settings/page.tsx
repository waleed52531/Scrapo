"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { z } from "zod";
import type { WorkspaceSettings } from "@scrapo/types";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, LoadingState } from "@/components/data-states";

const schema = z
  .object({
    name: z.string(),
    title: z.string().min(2),
    skills: z.string(),
    experience: z.string(),
    portfolio: z.string(),
    github: z.string(),
    linkedin: z.string(),
    availability: z.string(),
    projectPreferences: z.string(),
    countries: z.string(),
    companySizes: z.string(),
    industries: z.string(),
    technologies: z.string(),
    minimumBudget: z.coerce.number().min(0),
    buyingIntent: z.coerce.number().min(0),
    mobileRelevance: z.coerce.number().min(0),
    agencyFit: z.coerce.number().min(0),
    decisionMakerQuality: z.coerce.number().min(0),
    contactability: z.coerce.number().min(0),
    recency: z.coerce.number().min(0),
    companyQuality: z.coerce.number().min(0),
    countryPriority: z.coerce.number().min(0),
    discoveryTarget: z.coerce.number().int().min(1),
    minimumScore: z.coerce.number().int().min(0).max(100),
    shortlistLimit: z.coerce.number().int().min(1).max(100),
    outreachPaused: z.boolean(),
    emailMode: z.enum(["DRAFT_FIRST", "APPROVE_AND_SEND", "AUTOMATIC"]),
    weeklyEmailLimit: z.coerce.number().int().min(0),
    followUpDelayDays: z.coerce.number().int().min(1),
    maxFollowUps: z.coerce.number().int().min(0),
  })
  .refine(
    (data) =>
      data.buyingIntent +
        data.mobileRelevance +
        data.agencyFit +
        data.decisionMakerQuality +
        data.contactability +
        data.recency +
        data.companyQuality +
        data.countryPriority ===
      100,
    { message: "Scoring weights must total 100.", path: ["buyingIntent"] },
  );
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;
const scoringFields = [
  ["buyingIntent", "Buying intent"],
  ["mobileRelevance", "Mobile relevance"],
  ["agencyFit", "Agency fit"],
  ["decisionMakerQuality", "Decision maker"],
  ["contactability", "Contactability"],
  ["recency", "Recency"],
  ["companyQuality", "Company quality"],
  ["countryPriority", "Country priority"],
] as const;

export default function SettingsPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<WorkspaceSettings>("/settings"),
  });
  const ai = useQuery({
    queryKey: ["settings", "ai"],
    queryFn: () =>
      apiFetch<{
        provider: string;
        model: string;
        configured: boolean;
        status: string;
      }>("/settings/ai"),
  });
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const scoringValues = useWatch({ control: form.control });
  const total = scoringTotal(scoringValues);
  useEffect(() => {
    if (query.data) form.reset(toForm(query.data));
  }, [query.data, form]);
  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch<WorkspaceSettings>("/settings", {
        method: "PATCH",
        body: JSON.stringify(toApi(data)),
      }),
    onSuccess: (data) => {
      client.setQueryData(["settings"], data);
      form.reset(toForm(data));
    },
  });
  if (query.isLoading) return <LoadingState label="Loading settings…" />;
  if (query.error || !query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
      <PageHeader
        title="Settings"
        description="Editable profile, targeting, scoring, and Phase 1 safeguards."
        action={
          <Button disabled={mutation.isPending || !form.formState.isDirty}>
            <Save className="h-4 w-4" />
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        }
      />
      <div className="space-y-6">
        <Section
          title="My profile"
          description="Your mobile development positioning. All fields can be changed."
        >
          <Grid>
            <Field label="Name">
              <Input {...form.register("name")} />
            </Field>
            <Field label="Primary title">
              <Input {...form.register("title")} />
            </Field>
            <Field label="Skills (comma separated)" wide>
              <Input {...form.register("skills")} />
            </Field>
            <Field label="Experience" wide>
              <Input {...form.register("experience")} />
            </Field>
            <Field label="Portfolio">
              <Input {...form.register("portfolio")} />
            </Field>
            <Field label="GitHub">
              <Input {...form.register("github")} />
            </Field>
            <Field label="LinkedIn">
              <Input {...form.register("linkedin")} />
            </Field>
            <Field label="Availability">
              <Input {...form.register("availability")} />
            </Field>
            <Field label="Project preferences (comma separated)" wide>
              <Input {...form.register("projectPreferences")} />
            </Field>
          </Grid>
        </Section>
        <Section
          title="Targeting"
          description="Markets and company profiles you want to prioritize."
        >
          <Grid>
            <Field label="Countries (comma separated)" wide>
              <Input {...form.register("countries")} />
            </Field>
            <Field label="Company sizes">
              <Input {...form.register("companySizes")} />
            </Field>
            <Field label="Industries">
              <Input {...form.register("industries")} />
            </Field>
            <Field label="Technologies">
              <Input {...form.register("technologies")} />
            </Field>
            <Field label="Minimum budget">
              <Input type="number" {...form.register("minimumBudget")} />
            </Field>
          </Grid>
        </Section>
        <Section
          title="AI"
          description="OpenAI is used by the backend worker for structured analysis when configured."
        >
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <Metric label="Provider" value={ai.data?.provider ?? "OpenAI"} />
            <Metric label="Model" value={ai.data?.model ?? "Not loaded"} />
            <Metric label="Status" value={ai.data?.status ?? "Checking"} />
          </div>
        </Section>
        <Section
          title="Scoring weights"
          description="Weights must total exactly 100."
        >
          <Grid>
            {scoringFields.map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  {...form.register(key)}
                />
              </Field>
            ))}
            <p
              className={`text-sm font-medium sm:col-span-2 ${total === 100 ? "text-emerald-700" : "text-red-600"}`}
            >
              TOTAL {total}%
            </p>
            {form.formState.errors.buyingIntent && (
              <p className="text-sm text-red-600 sm:col-span-2">
                {form.formState.errors.buyingIntent.message}
              </p>
            )}
          </Grid>
        </Section>
        <Section
          title="Discovery defaults"
          description="Stored now for the background discovery workflows introduced later."
        >
          <Grid>
            <Field label="Discovery target">
              <Input type="number" {...form.register("discoveryTarget")} />
            </Field>
            <Field label="Minimum score">
              <Input type="number" {...form.register("minimumScore")} />
            </Field>
            <Field label="Shortlist limit">
              <Input type="number" {...form.register("shortlistLimit")} />
            </Field>
          </Grid>
        </Section>
        <Section
          title="Email safeguards"
          description="No Gmail or outreach execution exists in Phase 1; these settings prepare backend enforcement."
        >
          <Grid>
            <Field label="Email mode">
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                {...form.register("emailMode")}
              >
                <option>DRAFT_FIRST</option>
                <option>APPROVE_AND_SEND</option>
                <option>AUTOMATIC</option>
              </select>
            </Field>
            <Field label="Weekly limit">
              <Input type="number" {...form.register("weeklyEmailLimit")} />
            </Field>
            <Field label="Follow-up delay (days)">
              <Input type="number" {...form.register("followUpDelayDays")} />
            </Field>
            <Field label="Maximum follow-ups">
              <Input type="number" {...form.register("maxFollowUps")} />
            </Field>
            <label className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                {...form.register("outreachPaused")}
              />
              <span>
                <span className="block text-sm font-semibold text-red-900">
                  Pause all outreach
                </span>
                <span className="block text-xs text-red-700">
                  Stored as an emergency backend control for later phases.
                </span>
              </span>
            </label>
          </Grid>
        </Section>
        {mutation.error && (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {mutation.error.message}
          </p>
        )}
        {mutation.isSuccess && !form.formState.isDirty && (
          <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
            Settings saved.
          </p>
        )}
      </div>
    </form>
  );
}

const defaults: FormValues = {
  name: "",
  title: "Mobile Application Developer",
  skills: "",
  experience: "",
  portfolio: "",
  github: "",
  linkedin: "",
  availability: "",
  projectPreferences: "",
  countries: "",
  companySizes: "",
  industries: "",
  technologies: "",
  minimumBudget: 0,
  buyingIntent: 25,
  mobileRelevance: 20,
  agencyFit: 15,
  decisionMakerQuality: 10,
  contactability: 10,
  recency: 10,
  companyQuality: 5,
  countryPriority: 5,
  discoveryTarget: 300,
  minimumScore: 82,
  shortlistLimit: 20,
  outreachPaused: false,
  emailMode: "DRAFT_FIRST",
  weeklyEmailLimit: 20,
  followUpDelayDays: 7,
  maxFollowUps: 1,
};
function split(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function toForm(settings: WorkspaceSettings): FormValues {
  const s = settings.scoring;
  return {
    name: settings.profile.name,
    title: settings.profile.title,
    skills: settings.profile.skills.join(", "),
    experience: settings.profile.experience,
    portfolio: settings.profile.portfolio,
    github: settings.profile.github,
    linkedin: settings.profile.linkedin,
    availability: settings.profile.availability,
    projectPreferences: settings.profile.projectPreferences.join(", "),
    countries: settings.targeting.countries.join(", "),
    companySizes: settings.targeting.companySizes.join(", "),
    industries: settings.targeting.industries.join(", "),
    technologies: settings.targeting.technologies.join(", "),
    minimumBudget: settings.targeting.minimumBudget,
    buyingIntent: s.buyingIntent ?? 25,
    mobileRelevance: s.mobileRelevance ?? 20,
    agencyFit: s.agencyFit ?? 15,
    decisionMakerQuality: s.decisionMakerQuality ?? 10,
    contactability: s.contactability ?? 10,
    recency: s.recency ?? 10,
    companyQuality: s.companyQuality ?? 5,
    countryPriority: s.countryPriority ?? 5,
    discoveryTarget: settings.discovery.target,
    minimumScore: settings.discovery.minimumScore,
    shortlistLimit: settings.discovery.shortlistLimit,
    outreachPaused: settings.outreachPaused,
    emailMode: settings.emailMode as FormValues["emailMode"],
    weeklyEmailLimit: settings.weeklyEmailLimit,
    followUpDelayDays: settings.followUpDelayDays,
    maxFollowUps: settings.maxFollowUps,
  };
}
function toApi(data: FormValues) {
  return {
    profile: {
      name: data.name,
      title: data.title,
      skills: split(data.skills),
      experience: data.experience,
      portfolio: data.portfolio,
      github: data.github,
      linkedin: data.linkedin,
      availability: data.availability,
      projectPreferences: split(data.projectPreferences),
    },
    targeting: {
      countries: split(data.countries),
      companySizes: split(data.companySizes),
      industries: split(data.industries),
      leadTypes: [
        "AGENCY_PARTNER",
        "ACTIVE_REQUIREMENT",
        "BUSINESS_OPPORTUNITY",
      ],
      technologies: split(data.technologies),
      minimumBudget: data.minimumBudget,
    },
    scoring: {
      buyingIntent: data.buyingIntent,
      mobileRelevance: data.mobileRelevance,
      agencyFit: data.agencyFit,
      decisionMakerQuality: data.decisionMakerQuality,
      contactability: data.contactability,
      recency: data.recency,
      companyQuality: data.companyQuality,
      countryPriority: data.countryPriority,
    },
    discovery: {
      target: data.discoveryTarget,
      minimumScore: data.minimumScore,
      shortlistLimit: data.shortlistLimit,
    },
    outreachPaused: data.outreachPaused,
    emailMode: data.emailMode,
    weeklyEmailLimit: data.weeklyEmailLimit,
    followUpDelayDays: data.followUpDelayDays,
    maxFollowUps: data.maxFollowUps,
  };
}
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}
function scoringTotal(data: Record<string, unknown>) {
  return [
    "buyingIntent",
    "mobileRelevance",
    "agencyFit",
    "decisionMakerQuality",
    "contactability",
    "recency",
    "companyQuality",
    "countryPriority",
  ].reduce((sum, key) => sum + Number(data[key] ?? 0), 0);
}

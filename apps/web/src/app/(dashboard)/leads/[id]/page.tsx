"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BrainCircuit,
  Building2,
  ClipboardCheck,
  ExternalLink,
  Mail,
  MapPin,
  RefreshCw,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import type {
  Company,
  Contact,
  Lead,
  OutreachEligibility,
  OutreachMessage,
  RecommendedChannel,
} from "@scrapo/types";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/data-states";

type LeadScore = {
  id: string;
  buyingIntent: number;
  mobileRelevance: number;
  agencyFit: number;
  decisionMakerQuality: number;
  contactability: number;
  recency: number;
  companyQuality: number;
  countryPriority: number;
  baseScore: number;
  penalty: number;
  overall: number;
  temperature: string;
  confidence: number;
  explanation: string | null;
  recommendedChannel: RecommendedChannel | null;
  isManualOverride: boolean;
  overrideOriginalScore: number | null;
  createdAt: string;
};

type LeadDetail = Lead & {
  company: Company | null;
  contact: Contact | null;
  signals: Array<{
    id: string;
    source: string;
    signalType: string;
    content: string;
    sourceUrl: string | null;
    profileUrl: string | null;
    username: string | null;
    displayName: string | null;
    authorType: string | null;
    authorTypeConfidence: number;
    opportunityUrgency: string;
    socialPreQualificationScore: number;
    signalQualityScore: number;
    rawLead?: {
      sourceUrl: string | null;
      content: string;
      username: string | null;
      displayName: string | null;
      profileUrl: string | null;
    } | null;
  }>;
  actions: Array<{
    id: string;
    platform: string | null;
    actionType: string | null;
    title: string;
    suggestedText: string | null;
    content: string | null;
    sourceUrl: string | null;
    profileUrl: string | null;
    status: string;
    expiresAt: string | null;
  }>;
  scores: LeadScore[];
  activities: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string;
  }>;
};

const scoreRows = [
  ["Buying intent", "buyingIntent", 25],
  ["Mobile relevance", "mobileRelevance", 20],
  ["Agency fit", "agencyFit", 15],
  ["Decision maker", "decisionMakerQuality", 10],
  ["Contactability", "contactability", 10],
  ["Recency", "recency", 10],
  ["Company quality", "companyQuality", 5],
  ["Country", "countryPriority", 5],
] as const;

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["lead", id],
    queryFn: () => apiFetch<LeadDetail>(`/leads/${id}`),
  });
  const analyze = useMutation({
    mutationFn: () =>
      apiFetch(`/leads/${id}/analyze`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["lead", id] }),
  });
  const rescore = useMutation({
    mutationFn: () =>
      apiFetch(`/leads/${id}/rescore`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["lead", id] }),
  });
  const overrideScore = useMutation({
    mutationFn: ({ score, reason }: { score: number; reason: string }) =>
      apiFetch(`/leads/${id}/score-override`, {
        method: "POST",
        body: JSON.stringify({ score, reason }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["lead", id] }),
  });
  const feedback = useMutation({
    mutationFn: (rating: "LIKE" | "NEUTRAL" | "DISLIKE") =>
      apiFetch(`/leads/${id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating, reason: "Manual lead review" }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["lead", id] }),
  });
  const eligibility = useQuery({
    queryKey: ["lead", id, "outreach-eligibility"],
    queryFn: () =>
      apiFetch<OutreachEligibility>(`/leads/${id}/outreach-eligibility`),
  });
  const generateOutreach = useMutation({
    mutationFn: () =>
      apiFetch<OutreachMessage>(`/leads/${id}/outreach/generate`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["lead", id, "outreach-eligibility"],
      });
      void client.invalidateQueries({ queryKey: ["outreach"] });
    },
  });

  if (query.isLoading) return <LoadingState label="Loading lead..." />;
  if (query.error || !query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const lead = query.data;
  const score = lead.scores[0];
  const primarySignal =
    lead.signals.find((signal) => signal.id === lead.primarySignalId) ??
    lead.signals[0];
  const primaryAction = lead.actions[0];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/leads">
          <ArrowLeft className="h-4 w-4" />
          Back to leads
        </Link>
      </Button>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">
              {lead.company?.name ?? lead.title}
            </h1>
            <Badge className={temperatureClass(lead.temperature)}>
              {lead.overallScore} {lead.temperature}
            </Badge>
            {lead.scoreOverrideScore !== null && (
              <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                Manual override
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {lead.leadType.replaceAll("_", " ")} · {lead.primarySource} ·{" "}
            {lead.analysisStatus}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => analyze.mutate()}
            disabled={analyze.isPending || lead.analysisStatus === "ANALYZING"}
          >
            <BrainCircuit className="h-4 w-4" />
            Analyze
          </Button>
          <Button
            variant="outline"
            onClick={() => rescore.mutate()}
            disabled={rescore.isPending}
          >
            <RefreshCw className="h-4 w-4" />
            Rescore
          </Button>
          {lead.analysisStatus === "FAILED" && (
            <Button
              onClick={() => analyze.mutate()}
              disabled={analyze.isPending}
            >
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Opportunity Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-700">
                {lead.opportunitySummary ?? "No opportunity summary yet."}
              </p>
              {lead.analysisSummary && (
                <p className="mt-3 text-sm text-slate-600">
                  {lead.analysisSummary}
                </p>
              )}
              {lead.recommendedPitch && (
                <div className="mt-4 rounded-lg bg-blue-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Recommended outreach
                  </p>
                  <p className="mt-2 text-sm text-blue-950">
                    {lead.recommendedPitch}
                  </p>
                  <p className="mt-2 text-xs text-blue-700">
                    {lead.outreachRecommendation ?? "Recommendation pending"} ·{" "}
                    {lead.recommendedChannel ?? "Channel pending"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          {(primarySignal || lead.socialPreQualificationScore > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Social Signal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Original evidence
                  </p>
                  <p className="mt-2 rounded-lg bg-slate-50 p-3 leading-6 text-slate-700">
                    {primarySignal?.content ??
                      lead.sourceContent ??
                      "No source text captured."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {primarySignal?.sourceUrl && (
                      <a
                        href={primarySignal.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-700"
                      >
                        Open original <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {primarySignal?.profileUrl && (
                      <a
                        href={primarySignal.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-700"
                      >
                        Open profile <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <Metric
                    label="Prequalification"
                    value={`${lead.socialPreQualificationScore}/100`}
                  />
                  <Metric
                    label="Buyer intent"
                    value={`${lead.buyerIntentScore}/100`}
                  />
                  <Metric
                    label="Urgency"
                    value={lead.opportunityUrgency.replaceAll("_", " ")}
                  />
                  <Metric
                    label="Identity"
                    value={
                      primarySignal?.authorType
                        ? `${primarySignal.authorType.replaceAll("_", " ")} (${primarySignal.authorTypeConfidence}%)`
                        : "Unknown"
                    }
                  />
                </div>
                {primaryAction && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
                      <ClipboardCheck className="h-4 w-4" />
                      Recommended manual action · {primaryAction.status}
                    </p>
                    <p className="mt-2 text-sm text-blue-950">
                      {primaryAction.suggestedText ??
                        primaryAction.content ??
                        primaryAction.title}
                    </p>
                    <p className="mt-2 text-xs text-blue-700">
                      {primaryAction.actionType ?? primaryAction.platform}
                      {primaryAction.expiresAt
                        ? ` · expires ${new Date(primaryAction.expiresAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {score ? (
                <div className="space-y-3">
                  {scoreRows.map(([label, key, weight]) => (
                    <div
                      key={key}
                      className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-100 pb-2 text-sm"
                    >
                      <span className="text-slate-600">{label}</span>
                      <span className="font-medium">
                        {Math.round((score[key] * weight) / 100)} / {weight}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 text-sm font-semibold">
                    <span>Total</span>
                    <span>
                      {score.overall} / 100 {score.temperature}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Base {score.baseScore}, penalty {score.penalty}, confidence{" "}
                    {score.confidence}%.
                  </p>
                  {score.explanation && (
                    <p className="text-sm text-slate-700">
                      {score.explanation}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No score breakdown is available yet.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <EvidenceBlock title="Fact" value={lead.evidence} />
              <EvidenceBlock
                title="AI Interpretation"
                value={lead.aiInterpretation}
              />
              <EvidenceBlock title="Unknown" value={lead.unknowns} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Score History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.scores.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {item.overall} {item.temperature}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                    {item.isManualOverride && (
                      <Badge className="ml-2 border-amber-200 bg-amber-50 text-amber-700">
                        Override
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {item.confidence}% confidence
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row
                icon={Building2}
                text={lead.company?.name ?? "Not assigned"}
              />
              <Row
                icon={MapPin}
                text={
                  [lead.company?.city, lead.company?.country]
                    .filter(Boolean)
                    .join(", ") || "Location unknown"
                }
              />
              <Metric
                label="Mobile specialization"
                value={lead.company?.hasMobileService ? "Visible" : "Not clear"}
              />
              <Metric
                label="Flutter specialization"
                value={
                  lead.company?.hasFlutterService ? "Visible" : "Not clear"
                }
              />
              <Metric
                label="Partnership fit"
                value={`${lead.company?.partnershipFitScore ?? 0}/100`}
              />
              <Metric
                label="Company quality"
                value={`${lead.company?.companyQualityScore ?? 0}/100`}
              />
              <Metric
                label="Analysis confidence"
                value={`${lead.company?.companyAnalysisConfidence ?? 0}%`}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row
                icon={UserRound}
                text={
                  lead.contact
                    ? `${lead.contact.fullName} · ${lead.contact.role ?? "Role unknown"}`
                    : "Not assigned"
                }
              />
              <Row
                icon={Mail}
                text={lead.contact?.email ?? "Email unavailable"}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Phase 6 Ranking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Metric
                label="Ranking score"
                value={`${lead.rankingScore || 0}/100`}
              />
              {(lead.rankReason ?? []).length ? (
                <ul className="list-disc space-y-1 pl-4 text-slate-600">
                  {lead.rankReason.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">
                  Ranking will appear after analytics refresh.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={feedback.isPending}
                  onClick={() => feedback.mutate("LIKE")}
                >
                  <ThumbsUp className="h-4 w-4" />
                  Like
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={feedback.isPending}
                  onClick={() => feedback.mutate("NEUTRAL")}
                >
                  Neutral
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={feedback.isPending}
                  onClick={() => feedback.mutate("DISLIKE")}
                >
                  <ThumbsDown className="h-4 w-4" />
                  Dislike
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Email Outreach</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Metric
                label="Eligibility"
                value={
                  eligibility.data?.eligible
                    ? "Ready"
                    : (eligibility.data?.reasons[0] ?? "Checking")
                }
              />
              {eligibility.data?.warnings.length ? (
                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                  {eligibility.data.warnings.join(" ")}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => generateOutreach.mutate()}
                  disabled={generateOutreach.isPending}
                >
                  Generate Email
                </Button>
                <Button asChild variant="outline">
                  <Link href="/outreach">View outreach</Link>
                </Button>
              </div>
              {generateOutreach.data && (
                <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
                  Draft generated: {generateOutreach.data.subject}
                </p>
              )}
              {generateOutreach.error && (
                <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  {generateOutreach.error.message}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Manual Override</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => {
                  const scoreValue = Number(
                    window.prompt(
                      "Override score 0-100",
                      String(lead.overallScore),
                    ),
                  );
                  const reason = window.prompt("Override reason");
                  if (Number.isFinite(scoreValue) && reason)
                    overrideScore.mutate({ score: scoreValue, reason });
                }}
              >
                Set override
              </Button>
              {lead.scoreOverrideReason && (
                <p className="mt-3 text-xs text-slate-500">
                  Original {lead.scoreOverrideOriginal}, override{" "}
                  {lead.scoreOverrideScore}: {lead.scoreOverrideReason}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ icon: Icon, text }: { icon: typeof Building2; text: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-600">
      <Icon className="h-4 w-4 text-slate-400" />
      {text}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function EvidenceBlock({ title, value }: { title: string; value: unknown }) {
  const text = Array.isArray(value)
    ? value.join(", ")
    : typeof value === "object" && value
      ? JSON.stringify(value)
      : String(value ?? "None yet");
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
    </div>
  );
}

function temperatureClass(value: string) {
  if (value === "HOT") return "border-red-200 bg-red-50 text-red-700";
  if (value === "STRONG")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "REVIEW") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "REJECT") return "border-slate-300 bg-slate-100 text-slate-600";
  return "";
}

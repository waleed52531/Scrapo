"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowUpRight } from "lucide-react";
import type { Lead } from "@scrapo/types";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingState } from "@/components/data-states";
import { apiList } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReviewPage() {
  const query = useQuery({
    queryKey: ["review-leads"],
    queryFn: () => apiList<Lead>("/leads?limit=100&sortBy=createdAt"),
  });
  if (query.isLoading) return <LoadingState label="Loading review queue..." />;
  if (query.error || !query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const leads = query.data.data.filter(
    (lead) =>
      lead.temperature === "REVIEW" ||
      lead.analysisStatus === "FAILED" ||
      lead.analysisConfidence < 70 ||
      lead.status === "INVALID",
  );

  return (
    <>
      <PageHeader
        title="Review Queue"
        description="AI-uncertain, failed, invalid, and review-band leads that need a human decision."
      />
      <Card>
        <CardHeader>
          <CardTitle>Needs review</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="grid min-h-40 place-items-center text-sm text-slate-500">
              No leads need review right now.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <Link
                  href={`/leads/${lead.id}`}
                  key={lead.id}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 hover:text-blue-700"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {lead.company?.name ?? lead.title}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {reason(lead)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge>{lead.temperature}</Badge>
                    <span className="text-sm font-semibold">
                      {lead.overallScore}
                    </span>
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function reason(lead: Lead) {
  if (lead.analysisStatus === "FAILED") return "Analysis failed";
  if (lead.status === "INVALID")
    return (
      lead.invalidReason?.replaceAll("_", " ").toLowerCase() ?? "Invalid lead"
    );
  if (lead.analysisConfidence < 70)
    return `AI uncertain (${lead.analysisConfidence}% confidence)`;
  return "Review score band";
}

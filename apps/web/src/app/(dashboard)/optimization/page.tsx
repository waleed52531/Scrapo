"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OptimizationRecommendation } from "@scrapo/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

export default function OptimizationPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["optimization-recommendations"],
    queryFn: () =>
      apiFetch<OptimizationRecommendation[]>("/optimization/recommendations"),
  });
  const action = useMutation({
    mutationFn: ({
      id,
      actionName,
    }: {
      id?: string;
      actionName: "generate" | "accept" | "reject" | "dismiss";
    }) =>
      apiFetch(
        actionName === "generate"
          ? "/optimization/recommendations/generate"
          : `/optimization/recommendations/${id}/${actionName}`,
        { method: "POST" },
      ),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["optimization-recommendations"] }),
  });

  if (query.isLoading) return <LoadingState label="Loading recommendations…" />;
  if (query.isError)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;

  return (
    <>
      <PageHeader
        title="Optimization"
        description="Review source/query performance recommendations. Nothing is auto-applied unless you explicitly accept it."
        action={
          <Button
            disabled={action.isPending}
            onClick={() => action.mutate({ actionName: "generate" })}
          >
            Generate recommendations
          </Button>
        }
      />
      <div className="grid gap-4">
        {(query.data ?? []).map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <CardTitle>{item.title}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.description}
                  </p>
                </div>
                <Badge>{item.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="mb-4 max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                {JSON.stringify(item.evidence, null, 2)}
              </pre>
              {item.status === "NEW" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({ id: item.id, actionName: "accept" })
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({ id: item.id, actionName: "reject" })
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({ id: item.id, actionName: "dismiss" })
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
        {query.data?.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-slate-500">
              No recommendations yet. Generate recommendations after you have
              lead and outreach history.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

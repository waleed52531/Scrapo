"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@scrapo/types";
import { ErrorState, LoadingState } from "@/components/data-states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

export default function NotificationsPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<Notification[]>("/notifications"),
  });
  const action = useMutation({
    mutationFn: (path: string) =>
      apiFetch(path, { method: path.endsWith("read") ? "PATCH" : "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (query.isLoading) return <LoadingState label="Loading notifications…" />;
  if (query.isError)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;

  const unread = (query.data ?? []).filter((item) => !item.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="In-app alerts for hot leads, replies, failures, reports, and automation events."
        action={
          <Button
            variant="outline"
            disabled={action.isPending || unread === 0}
            onClick={() => action.mutate("/notifications/read-all")}
          >
            Mark all read
          </Button>
        }
      />
      <div className="grid gap-3">
        {(query.data ?? []).map((item) => (
          <Card key={item.id} className={item.readAt ? "opacity-70" : ""}>
            <CardContent className="flex flex-col justify-between gap-3 pt-5 sm:flex-row sm:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-950">{item.title}</h3>
                  <Badge>{item.type}</Badge>
                  {!item.readAt ? (
                    <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                      Unread
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              {!item.readAt ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate(`/notifications/${item.id}/read`)
                  }
                >
                  Mark read
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
        {query.data?.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-slate-500">
              No notifications yet.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

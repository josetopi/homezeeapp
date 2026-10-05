import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { listNotifications, markNotificationsRead } from "@/lib/server/homezee";
import { formatWhen } from "@/lib/format";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/_app/notifications")({ component: Notifications });

function Notifications() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const marked = useRef(false);
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => listNotifications() });
  const read = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      await qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });

  useEffect(() => {
    if (marked.current) return;
    if (q.data && q.data.some((n) => !n.read)) {
      marked.current = true;
      read.mutate();
    }
  }, [q.data, read]);

  return (
    <div className="flex h-full flex-col px-4 pt-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Notificações</h1>
      <p className="mt-1 text-sm text-muted">Visit requests, messages, offers, and Pro match alerts.</p>
      <div className="mt-4 flex-1 space-y-1 overflow-y-auto pb-4">
        {q.data && q.data.length > 0 ? (
          q.data.map((n) => (
            <button
              key={n.id}
              type="button"
              className="w-full rounded-2xl px-3 py-3 text-left hover:bg-secondary"
              onClick={() => {
                const d = n.data;
                if (typeof d.listingId === "number") {
                  void nav({ to: "/listing/$id", params: { id: String(d.listingId) } });
                } else if (typeof d.conversationId === "number") {
                  void nav({ to: "/messages/$id", params: { id: String(d.conversationId) } });
                } else if (n.type.startsWith("visit") || n.type === "visit_slots") {
                  void nav({ to: "/visits" });
                } else if (n.type.startsWith("offer")) {
                  void nav({ to: "/offers" });
                }
              }}
            >
              <p className="font-medium">{n.title}</p>
              <p className="text-sm text-muted">{n.body}</p>
              <p className="mt-1 text-xs text-subtle">{formatWhen(n.createdAt)}</p>
            </button>
          ))
        ) : (
          <EmptyState icon={<Bell className="size-6" />} title="You're all caught up" body="Alerts about visits, chats, and matches will land here." />
        )}
      </div>
    </div>
  );
}

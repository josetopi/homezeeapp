import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { listConversations } from "@/lib/server/homezee";
import { formatWhen } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/messages")({ component: Messages });

function Messages() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["conversations"], queryFn: () => listConversations() });
  return (
    <div className="flex h-full flex-col px-4 pt-4">
      <h1 className="font-display text-2xl tracking-tight">Mensagens</h1>
      <p className="mt-1 text-sm text-muted">Conversas sobre casas da Homezee. Agenda as visitas no separador Visitas.</p>
      <div className="mt-4 flex-1 space-y-1 overflow-y-auto">
        {q.isPending
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
          : q.data && q.data.length > 0
            ? q.data.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => nav({ to: "/messages/$id", params: { id: String(c.id) } })}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left hover:bg-secondary"
                >
                  <Avatar src={c.otherAvatar ?? c.listingPhoto} name={c.otherName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <p className="truncate font-medium">{c.otherName}</p>
                      <span className="text-xs text-subtle">{c.lastAt ? formatWhen(c.lastAt) : ""}</span>
                    </div>
                    <p className="truncate text-sm text-muted">{c.lastMessage ?? c.listingTitle}</p>
                  </div>
                </button>
              ))
            : (
                <EmptyState
                  icon={<MessageCircle className="size-6" />}
                  title="Ainda sem conversas"
                  body="Abre uma casa da Homezee para falar com o vendedor. Para casas de portais, usa o anúncio original."
                />
              )}
      </div>
    </div>
  );
}

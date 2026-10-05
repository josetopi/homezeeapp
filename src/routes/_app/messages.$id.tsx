import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, Send } from "lucide-react";
import { getMessages, sendMessage } from "@/lib/server/homezee";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/messages/$id")({ component: Thread });

function Thread() {
  const { id } = Route.useParams();
  const convoId = Number(id);
  const user = useCurrentUser();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const q = useQuery({
    queryKey: ["messages", convoId],
    queryFn: () => getMessages({ data: convoId }),
    refetchInterval: 4000,
  });
  const send = useMutation({
    mutationFn: () => sendMessage({ data: { conversationId: convoId, body } }),
    onSuccess: async () => {
      setBody("");
      await qc.invalidateQueries({ queryKey: ["messages", convoId] });
      await qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const data = q.data;
  return (
    <div className="flex h-[calc(100dvh-4.25rem)] flex-col">
      <header className="flex items-center gap-2 border-b border-border px-2 py-2">
        <Link to="/messages" className="grid size-11 place-items-center">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate font-medium">{data?.conversation.otherName ?? "Chat"}</p>
          {data ? (
            <Link
              to="/listing/$id"
              params={{ id: String(data.conversation.listingId) }}
              className="truncate text-xs text-muted"
            >
              {data.conversation.listingTitle}
            </Link>
          ) : null}
        </div>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {data?.messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <p
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                  mine ? "rounded-br-md bg-primary text-primary-fg" : "rounded-bl-md bg-secondary text-fg",
                )}
              >
                {m.body}
              </p>
            </div>
          );
        })}
        <p className="px-2 pt-4 text-center text-xs text-subtle">
          Chat can discuss times — a visit is only official after both sides confirm it in Visits.
        </p>
      </div>
      <form
        className="flex gap-2 border-t border-border px-3 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate();
        }}
      >
        <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" />
        <Button type="submit" size="icon" disabled={send.isPending || !body.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

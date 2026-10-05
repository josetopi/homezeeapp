import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListingRow } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { getSuggestions } from "@/lib/server/homezee";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/suggestions")({ component: Suggestions });

function Suggestions() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["suggestions"], queryFn: () => getSuggestions() });

  if (q.isPending) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  if (q.data?.locked) {
    return (
      <div className="px-4 pt-6">
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="Sugestões Smart"
          body="Pro ranks homes that match your taste even when they sit outside the current filters."
          action={
            <Button asChild>
              <Link to="/pro">Unlock with Pro</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const listings = q.data?.listings ?? [];

  return (
    <div className="flex h-full flex-col px-4 pt-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Sugestões Smart</h1>
      <p className="mt-1 text-sm text-muted">Highest-match homes outside the main feed, ranked by your swipe history.</p>
      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pb-4">
        {listings.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title="Keep swiping"
            body="Once we know your taste, high-match homes will show up here."
          />
        ) : (
          listings.map((l) => (
            <ListingRow
              key={l.id}
              listing={l}
              onOpen={() => nav({ to: "/listing/$id", params: { id: String(l.id) } })}
            />
          ))
        )}
      </div>
    </div>
  );
}

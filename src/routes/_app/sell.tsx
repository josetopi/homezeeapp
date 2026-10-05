import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { ListingRow } from "@/components/listing-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { myListings } from "@/lib/server/homezee";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/sell")({ component: Sell });

function Sell() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["my-listings"], queryFn: () => myListings() });
  return (
    <div className="flex h-full flex-col px-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tight">Os teus anúncios</h1>
        <Button size="sm" asChild>
          <Link to="/sell/new">
            <Plus className="size-4" />
            New
          </Link>
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted">Only Active homes appear in buyer feeds.</p>
      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pb-4">
        {q.isPending
          ? [0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          : q.data && q.data.length > 0
            ? q.data.map((l) => (
                <div key={l.id} className="relative">
                  <ListingRow listing={l} onOpen={() => nav({ to: "/sell/$id", params: { id: String(l.id) } })} />
                  <Badge className="absolute top-3 right-12 capitalize">{l.status.replace("_", " ")}</Badge>
                </div>
              ))
            : (
                <EmptyState
                  icon={<Plus className="size-6" />}
                  title="Anunciar uma casa"
                  body="Add photos and details. Paused, sold, or under-offer listings drop out of the swipe stack automatically."
                  action={
                    <Button asChild>
                      <Link to="/sell/new">Create listing</Link>
                    </Button>
                  }
                />
              )}
      </div>
    </div>
  );
}

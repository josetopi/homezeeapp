import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListingRow } from "@/components/listing-card";
import { listFavorites } from "@/lib/server/homezee";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/favorites")({ component: Favorites });

function Favorites() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["favorites"], queryFn: () => listFavorites() });
  return (
    <div className="flex h-full flex-col px-4 pt-4">
      <h1 className="font-display text-2xl tracking-tight">Casas guardadas</h1>
      <p className="mt-1 text-sm text-muted">Todas as tuas favoritas, da Homezee e dos portais.</p>
      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pb-4">
        {q.isPending
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          : q.data && q.data.length > 0
            ? q.data.map((l) => (
                <ListingRow key={l.id} listing={l} onOpen={() => nav({ to: "/listing/$id", params: { id: String(l.id) } })} />
              ))
            : (
                <EmptyState
                  icon={<Heart className="size-6" />}
                  title="Ainda não tens favoritos"
                  body="Desliza para a direita para guardar uma casa."
                />
              )}
      </div>
    </div>
  );
}

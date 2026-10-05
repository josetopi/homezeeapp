import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListingPhoto, ListingFacts } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  boostListing,
  getListing,
  listingAnalytics,
  setSaleHandling,
  updateListingStatus,
} from "@/lib/server/homezee";
import type { ListingStatus } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/sell/$id")({ component: ManageListing });

function ManageListing() {
  const { id } = Route.useParams();
  const listingId = Number(id);
  const qc = useQueryClient();
  const listing = useQuery({ queryKey: ["listing", listingId], queryFn: () => getListing({ data: listingId }) });
  const stats = useQuery({ queryKey: ["analytics", listingId], queryFn: () => listingAnalytics({ data: listingId }) });

  const status = useMutation({
    mutationFn: (s: ListingStatus) => updateListingStatus({ data: { listingId, status: s } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["listing", listingId] });
      await qc.invalidateQueries({ queryKey: ["my-listings"] });
    },
  });
  const boost = useMutation({
    mutationFn: () => boostListing({ data: listingId }),
    onSuccess: async () => {
      toast.success("Boosted for 7 days");
      await qc.invalidateQueries({ queryKey: ["listing", listingId] });
    },
  });
  const handling = useMutation({
    mutationFn: (h: "independent" | "in_app") => setSaleHandling({ data: { listingId, handling: h } }),
    onSuccess: async () => {
      toast.success("Sale handling updated");
      await qc.invalidateQueries({ queryKey: ["listing", listingId] });
    },
  });

  const l = listing.data;
  if (listing.isPending || !l) {
    return (
      <div className="p-4">
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 overflow-y-auto px-4 py-4 pb-10">
      <ListingPhoto listing={l} className="h-56 rounded-3xl" />
      <ListingFacts listing={l} />
      <Badge className="capitalize">{l.status.replace("_", " ")}</Badge>

      <section>
        <h2 className="text-sm font-medium tracking-wide text-muted uppercase">Analytics</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Stat label="Swipes" value={stats.data?.swipes} />
          <Stat label="Likes" value={stats.data?.likes} />
          <Stat label="Favorites" value={stats.data?.favorites} />
          <Stat label="Pedidos de visita" value={stats.data?.visitRequests} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium tracking-wide text-muted uppercase">Status</h2>
        <div className="grid grid-cols-2 gap-2">
          {(["active", "paused", "under_offer", "sold"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={l.status === s ? "default" : "outline"}
              onClick={() => status.mutate(s)}
              className="capitalize"
            >
              {s.replace("_", " ")}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium tracking-wide text-muted uppercase">Promoted listing</h2>
        <p className="text-sm text-muted">Pay to lift this home in the swipe stack for a week.</p>
        <Button variant="outline" onClick={() => boost.mutate()} disabled={boost.isPending || l.promoted}>
          {l.promoted ? "Currently boosted" : "Boost visibility"}
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium tracking-wide text-muted uppercase">After a visit</h2>
        <p className="text-sm text-muted">
          Handle the sale yourself, or run it in-app. In-app closings collect 2.5% — 1% to a matched verified agent, 1.5% to
          homezee.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={l.saleHandling === "independent" ? "default" : "outline"}
            size="sm"
            onClick={() => handling.mutate("independent")}
          >
            Independent
          </Button>
          <Button
            variant={l.saleHandling === "in_app" ? "default" : "outline"}
            size="sm"
            onClick={() => handling.mutate("in_app")}
          >
            In-app (2.5%)
          </Button>
        </div>
      </section>

      <Link to="/visits" className="block text-sm font-medium text-primary">
        Review visit requests
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl bg-secondary p-3">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="font-display text-2xl tabular-nums">{value ?? "—"}</p>
    </div>
  );
}

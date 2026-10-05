import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Handshake } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listOffers, listVisits, respondOffer, submitOffer } from "@/lib/server/homezee";
import { formatPrice } from "@/lib/format";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/offers")({ component: OffersPage });

function OffersPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const offers = useQuery({ queryKey: ["offers"], queryFn: () => listOffers() });
  const visits = useQuery({ queryKey: ["visits"], queryFn: () => listVisits() });
  const completed = visits.data?.filter((v) => v.buyerId === user?.id && v.status === "completed") ?? [];
  const [listingId, setListingId] = useState<number | "">("");
  const [amount, setAmount] = useState(0);

  const submit = useMutation({
    mutationFn: () => submitOffer({ data: { listingId: Number(listingId), amount } }),
    onSuccess: async () => {
      toast.success("Offer submitted");
      await qc.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const incoming = offers.data?.filter((o) => o.sellerId === user?.id) ?? [];
  const outgoing = offers.data?.filter((o) => o.buyerId === user?.id) ?? [];

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pt-4 pb-8">
      <h1 className="font-display text-2xl tracking-tight">Propostas</h1>
      <p className="mt-1 text-sm text-muted">Formal bids after a completed visit. Accept, counter, or reject in-app.</p>

      {completed.length > 0 ? (
        <form
          className="mt-4 space-y-2 rounded-2xl bg-secondary p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (listingId) submit.mutate();
          }}
        >
          <p className="text-sm font-medium">Submit an offer</p>
          <select
            className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm"
            value={listingId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setListingId(id);
              const v = completed.find((x) => x.listingId === id);
              if (v) setAmount(v.listingPrice);
            }}
          >
            <option value="">Choose a toured home</option>
            {completed.map((v) => (
              <option key={v.id} value={v.listingId}>
                {v.listingTitle} · {formatPrice(v.listingPrice)}
              </option>
            ))}
          </select>
          <Input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Offer amount" />
          <Button type="submit" className="w-full" disabled={!listingId || submit.isPending}>
            Send offer
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted">Complete a visit to unlock offering.</p>
      )}

      <Tabs defaultValue="out" className="mt-5">
        <TabsList>
          <TabsTrigger value="out">Sent</TabsTrigger>
          <TabsTrigger value="in">Received</TabsTrigger>
        </TabsList>
        <TabsContent value="out" className="mt-3 space-y-3">
          {offers.isPending ? <Skeleton className="h-24 rounded-2xl" /> : <OfferList items={outgoing} mine="buyer" />}
        </TabsContent>
        <TabsContent value="in" className="mt-3 space-y-3">
          {offers.isPending ? <Skeleton className="h-24 rounded-2xl" /> : <OfferList items={incoming} mine="seller" />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OfferList({
  items,
  mine,
}: {
  items: Awaited<ReturnType<typeof listOffers>>;
  mine: "buyer" | "seller";
}) {
  const qc = useQueryClient();
  const [counter, setCounter] = useState<Record<number, number>>({});
  const act = useMutation({
    mutationFn: (p: { offerId: number; action: "accept" | "reject" | "counter"; counterAmount?: number }) =>
      respondOffer({ data: p }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["offers"] });
      toast.success("Updated");
    },
    onError: (e) => toast.error(e.message),
  });

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Handshake className="size-6" />}
        title="No offers"
        body="After a completed tour, buyers can bid here. Sellers accept, counter, or reject."
      />
    );
  }

  return (
    <>
      {items.map((o) => (
        <article key={o.id} className="rounded-2xl border border-border bg-elevated p-3">
          <div className="flex gap-3">
            {o.listingPhoto ? <img src={o.listingPhoto} alt="" className="size-14 rounded-xl object-cover" /> : null}
            <div className="min-w-0 flex-1">
              <Link to="/listing/$id" params={{ id: String(o.listingId) }} className="font-medium">
                {o.listingTitle}
              </Link>
              <p className="text-sm text-muted">Ask {formatPrice(o.listingPrice)}</p>
              <p className="font-display text-xl">{formatPrice(o.amount)}</p>
              {o.counterAmount ? <p className="text-sm">Counter {formatPrice(o.counterAmount)}</p> : null}
              <Badge className="mt-1 capitalize">{o.status}</Badge>
            </div>
          </div>
          {mine === "seller" && o.status === "pending" ? (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <Button size="sm" onClick={() => act.mutate({ offerId: o.id, action: "accept" })}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => act.mutate({ offerId: o.id, action: "reject" })}>
                  Reject
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Counter"
                  value={counter[o.id] ?? ""}
                  onChange={(e) => setCounter((c) => ({ ...c, [o.id]: Number(e.target.value) }))}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act.mutate({ offerId: o.id, action: "counter", counterAmount: counter[o.id] })}
                >
                  Counter
                </Button>
              </div>
            </div>
          ) : null}
          {mine === "buyer" && o.status === "countered" ? (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => act.mutate({ offerId: o.id, action: "accept" })}>
                Accept counter
              </Button>
              <Button size="sm" variant="outline" onClick={() => act.mutate({ offerId: o.id, action: "reject" })}>
                Decline
              </Button>
            </div>
          ) : null}
        </article>
      ))}
    </>
  );
}

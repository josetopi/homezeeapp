import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { completeVisit, declineVisit, listVisits, pickVisitSlot, proposeVisitSlots } from "@/lib/server/homezee";
import { formatPrice, formatWhen } from "@/lib/format";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import type { Visit } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/visits")({ component: VisitsPage });

function VisitsPage() {
  const user = useCurrentUser();
  const q = useQuery({ queryKey: ["visits"], queryFn: () => listVisits() });
  const incoming = q.data?.filter((v) => v.sellerId === user?.id) ?? [];
  const outgoing = q.data?.filter((v) => v.buyerId === user?.id) ?? [];

  return (
    <div className="flex h-full flex-col px-4 pt-4">
      <h1 className="font-display text-2xl tracking-tight">Visitas</h1>
      <p className="mt-1 text-sm text-muted">Pedidos, horários propostos e visitas confirmadas.</p>
      <Tabs defaultValue="outgoing" className="mt-4 flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="outgoing">Os meus pedidos</TabsTrigger>
          <TabsTrigger value="incoming">Recebidos</TabsTrigger>
        </TabsList>
        <TabsContent value="outgoing" className="mt-4 flex-1 overflow-y-auto">
          <VisitList loading={q.isPending} items={outgoing} mine="buyer" />
        </TabsContent>
        <TabsContent value="incoming" className="mt-4 flex-1 overflow-y-auto">
          <VisitList loading={q.isPending} items={incoming} mine="seller" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VisitList({ loading, items, mine }: { loading: boolean; items: Visit[]; mine: "buyer" | "seller" }) {
  if (loading) return <Skeleton className="h-28 rounded-2xl" />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="size-6" />}
        title={mine === "buyer" ? "Ainda sem visitas" : "Ainda sem pedidos recebidos"}
        body={
          mine === "buyer"
            ? "Desliza uma casa para cima para pedir visita. O vendedor propõe os horários aqui."
            : "Os pedidos de visita às tuas casas aparecem aqui."
        }
      />
    );
  }
  return (
    <div className="space-y-3 pb-6">
      {items.map((v) => (
        <VisitCard key={v.id} visit={v} mine={mine} />
      ))}
    </div>
  );
}

function VisitCard({ visit, mine }: { visit: Visit; mine: "buyer" | "seller" }) {
  const qc = useQueryClient();
  const [slotA, setSlotA] = useState("");
  const [slotB, setSlotB] = useState("");
  const [slotC, setSlotC] = useState("");

  const propose = useMutation({
    mutationFn: () =>
      proposeVisitSlots({
        data: { visitId: visit.id, slots: [slotA, slotB, slotC].filter(Boolean).map((s) => new Date(s).toISOString()) },
      }),
    onSuccess: async () => {
      toast.success("Times sent");
      await qc.invalidateQueries({ queryKey: ["visits"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const pick = useMutation({
    mutationFn: (slot: string) => pickVisitSlot({ data: { visitId: visit.id, slot } }),
    onSuccess: async () => {
      toast.success("Visita confirmada");
      await qc.invalidateQueries({ queryKey: ["visits"] });
    },
  });
  const decline = useMutation({
    mutationFn: () => declineVisit({ data: visit.id }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["visits"] });
    },
  });
  const complete = useMutation({
    mutationFn: () => completeVisit({ data: visit.id }),
    onSuccess: async () => {
      toast.success("Visita realizada — podes enviar propostas");
      await qc.invalidateQueries({ queryKey: ["visits"] });
    },
  });

  return (
    <article className="rounded-2xl border border-border bg-elevated p-3">
      <div className="flex gap-3">
        {visit.listingPhoto ? (
          <img src={visit.listingPhoto} alt="" className="size-16 rounded-xl object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <Link to="/listing/$id" params={{ id: String(visit.listingId) }} className="font-medium">
            {visit.listingTitle}
          </Link>
          <p className="text-sm text-muted">
            {visit.listingAddress} · {formatPrice(visit.listingPrice)}
          </p>
          <Badge className="mt-1 capitalize">{({requested:"Pedida",slots_proposed:"Horários propostos",confirmed:"Confirmada",completed:"Realizada",declined:"Recusada",cancelled:"Cancelada"} as Record<string,string>)[visit.status]}</Badge>
        </div>
      </div>
      {mine === "seller" ? (
        <div className="mt-3 flex items-center gap-2">
          <Avatar src={visit.buyerAvatar} name={visit.buyerName} className="size-8" />
          <p className="text-sm">
            {visit.buyerName}
            <span className="text-muted"> requested a tour</span>
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">Anunciante: {visit.sellerName}</p>
      )}

      {visit.status === "requested" && mine === "seller" ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Propõe pelo menos dois horários</p>
          <Input type="datetime-local" value={slotA} onChange={(e) => setSlotA(e.target.value)} />
          <Input type="datetime-local" value={slotB} onChange={(e) => setSlotB(e.target.value)} />
          <Input type="datetime-local" value={slotC} onChange={(e) => setSlotC(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => propose.mutate()} disabled={propose.isPending}>
              Send times
            </Button>
            <Button size="sm" variant="outline" onClick={() => decline.mutate()}>
              Recusar
            </Button>
          </div>
        </div>
      ) : null}

      {visit.status === "slots_proposed" && mine === "buyer" ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Escolhe um horário</p>
          {visit.proposedSlots.map((s) => (
            <Button key={s} variant="outline" className="w-full justify-start" onClick={() => pick.mutate(s)}>
              {formatWhen(s)}
            </Button>
          ))}
        </div>
      ) : null}

      {visit.status === "slots_proposed" && mine === "seller" ? (
        <p className="mt-3 text-sm text-muted">Waiting on {visit.buyerName} to pick a time.</p>
      ) : null}

      {visit.status === "confirmed" ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium">Confirmada · {visit.confirmedSlot ? formatWhen(visit.confirmedSlot) : ""}</p>
          <Button size="sm" onClick={() => complete.mutate()} disabled={complete.isPending}>
            Mark visit complete
          </Button>
        </div>
      ) : null}

      {visit.status === "completed" && mine === "buyer" ? (
        <Button asChild size="sm" className="mt-3">
          <Link to="/offers">Make an offer</Link>
        </Button>
      ) : null}
    </article>
  );
}

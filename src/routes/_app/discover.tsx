import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal, Sparkles, Bell } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { SwipeDeck } from "@/components/swipe-deck";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { bootstrap, getFeed, recordSwipe, updateFilters } from "@/lib/server/homezee";
import { formatPriceCompact } from "@/lib/format";
import { FREE_DAILY_SWIPES, type Listing, type SwipeAction } from "@/lib/types";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/discover")({ component: Discover });

function Discover() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const boot = useQuery({
    queryKey: ["bootstrap", user?.id],
    enabled: Boolean(user),
    queryFn: () =>
      bootstrap({
        data: { displayName: user?.displayName, avatarUrl: user?.profileImageUrl },
      }),
  });
  const feed = useQuery({
    queryKey: ["feed"],
    queryFn: () => getFeed(),
    refetchInterval: q => q.state.data?.portal?.searching ? 4000 : false,
  });

  const swipe = useMutation({
    mutationFn: ({ listing, action }: { listing: Listing; action: SwipeAction }) =>
      recordSwipe({ data: { listingId: listing.id, action } }),
    onSuccess: async (res, vars) => {
      if (res.capped) {
        toast("Atingiste o limite diário");
        await qc.invalidateQueries({ queryKey: ["feed"] });
        return;
      }
      if (vars.action === "up" && vars.listing.origin !== "external") {
        toast.success("Visita pedida. Escolhe um horário em Visitas quando o vendedor responder.");
      }
      if (vars.action === "right") toast("Guardado nos favoritos");
      qc.setQueryData(["feed"], (old: Awaited<ReturnType<typeof getFeed>> | undefined) => {
        if (!old) return old;
        return {
          ...old,
          listings: old.listings.filter((l) => l.id !== vars.listing.id),
          remaining: old.remaining == null ? null : Math.max(0, old.remaining - 1),
        };
      });
      await qc.invalidateQueries({ queryKey: ["bootstrap"] });
      await qc.invalidateQueries({ queryKey: ["favorites"] });
      await qc.invalidateQueries({ queryKey: ["visits"] });
      await qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const profile = boot.data?.profile;
  const remaining = feed.data?.remaining;
  const listings = feed.data?.listings ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <Logo />
        <div className="flex items-center gap-1">
          <Link to="/suggestions" className="grid size-11 place-items-center rounded-full text-muted">
            <Sparkles className="size-5" />
          </Link>
          <Link to="/notifications" className="grid size-11 place-items-center rounded-full text-muted">
            <Bell className="size-5" />
          </Link>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button type="button" aria-label="Filtros" className="grid size-11 place-items-center rounded-full text-muted">
                <SlidersHorizontal className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle>Filtros</SheetTitle>
              {profile ? (
                <FiltersForm
                  initial={{
                    location: profile.filterLocation,
                    maxPrice: profile.filterMaxPrice ?? 0,
                    type: profile.filterPropertyType,
                    beds: profile.filterMinBedrooms,
                  }}
                  onSave={async (vals) => {
                    await updateFilters({
                      data: {
                        filterLocation: vals.location,
                        filterMaxPrice: vals.maxPrice || null,
                        filterPropertyType: vals.type,
                        filterMinBedrooms: vals.beds,
                      },
                    });
                    await qc.invalidateQueries();
                    setSheetOpen(false);
                  }}
                />
              ) : null}
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {remaining != null ? (
        <p className="px-5 pb-1 text-center text-xs tabular-nums text-subtle">
          {remaining} de {FREE_DAILY_SWIPES} swipes disponíveis hoje
        </p>
      ) : (
        <p className="px-5 pb-1 text-center text-xs text-subtle">Swipes ilimitados · Pro</p>
      )}

      <div className="px-5 pb-2 text-center text-xs text-muted" aria-live="polite">
        {feed.data?.portal?.searching ? "A procurar casas nos portais…" : profile?.filterLocation ? `${feed.data?.portal?.received ?? 0} casas encontradas nos portais · ${profile.filterLocation}` : "Escolhe uma cidade nos filtros para pesquisar nos portais"}
        {feed.data?.portal?.errors?.length ? <details className="mt-1"><summary>Algumas fontes não responderam</summary><p className="pt-2">{feed.data.portal.errors.join(" · ")}</p><Button variant="ghost" size="sm" onClick={()=>feed.refetch()}>Tentar novamente</Button></details> : null}
      </div>
      {feed.isError ? <EmptyState icon={<SlidersHorizontal className="size-6"/>} title="Não foi possível carregar as casas" body="Tenta novamente." action={<Button onClick={()=>feed.refetch()}>Repetir</Button>} /> : feed.isPending ? (
        <div className="flex-1 px-4 pt-2">
          <Skeleton className="h-full rounded-3xl" />
        </div>
      ) : feed.data?.capped ? (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="That's today's stack"
          body="Free accounts get 100 swipes a day. Go Pro for unlimited cards, Smart Suggestions, and full market stats."
          action={
            <Button asChild>
              <Link to="/pro">Unlock Pro</Link>
            </Button>
          }
        />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={<SlidersHorizontal className="size-6" />}
          title="Sem casas nesta pesquisa"
          body={feed.data?.portal?.searching ? "A pesquisa está a decorrer. Os resultados aparecem aqui automaticamente." : "Não encontrámos casas disponíveis nesta pesquisa. Podes ajustar os filtros ou ver outra cidade."}
        />
      ) : (
        <SwipeDeck
          key={`${profile?.filterLocation ?? ""}-${profile?.filterMaxPrice ?? ""}-${profile?.filterPropertyType ?? ""}-${profile?.filterMinBedrooms ?? 0}`}
          listings={listings}
          disabled={swipe.isPending}
          onSwipe={async (listing, action) => {
            try { await swipe.mutateAsync({ listing, action }); } catch { toast.error("Não foi possível guardar a escolha. Atualiza para tentar novamente."); await feed.refetch(); }
          }}
        />
      )}
    </div>
  );
}

function FiltersForm({
  initial,
  onSave,
}: {
  initial: { location: string; maxPrice: number; type: string; beds: number };
  onSave: (v: { location: string; maxPrice: number; type: string; beds: number }) => Promise<void>;
}) {
  const [location, setLocation] = useState(initial.location);
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice);
  const [type, setType] = useState(initial.type);
  const [beds, setBeds] = useState(initial.beds);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave({ location, maxPrice, type, beds });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="loc">Localização</Label>
        <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Cidade, por exemplo Braga" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <Label>Preço máximo</Label>
          <span className="tabular-nums">{maxPrice ? formatPriceCompact(maxPrice) : "Sem limite"}</span>
        </div>
        <Input aria-label="Preço máximo" type="number" min={0} step={1000} placeholder="Sem limite" value={maxPrice || ""} onChange={e=>setMaxPrice(Number(e.target.value))}/>
        <p className="text-xs text-muted">Deixa vazio para pesquisar sem limite de preço.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pt">Tipo de imóvel</Label>
        <select
          id="pt"
          className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="any">Todos</option>
          <option value="house">Moradia</option>
          <option value="condo">Apartamento</option>
          <option value="townhouse">Moradia em banda</option>
          <option value="apartment">Apartamento</option>
          <option value="land">Terreno</option>
          <option value="farm">Quinta</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bd">Quartos</Label>
        <select
          id="bd"
          className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm"
          value={beds}
          onChange={(e) => setBeds(Number(e.target.value))}
        >
          <option value={0}>Todos</option>
          <option value={1}>1+</option>
          <option value={2}>2+</option>
          <option value={3}>3+</option>
          <option value={4}>4+</option>
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        Aplicar filtros
      </Button>
    </form>
  );
}

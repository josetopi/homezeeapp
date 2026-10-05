import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { bootstrap, saveOnboarding } from "@/lib/server/homezee";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { formatPriceCompact } from "@/lib/format";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

function Onboarding() {
  const { user, isPending } = useCurrentUserState();
  const nav = useNavigate();
  const qc = useQueryClient();
  const boot = useQuery({
    queryKey: ["bootstrap", user?.id],
    enabled: Boolean(user),
    queryFn: () =>
      bootstrap({
        data: { displayName: user?.displayName, avatarUrl: user?.profileImageUrl },
      }),
  });
  const [name, setName] = useState(user?.displayName ?? "");
  const [role, setRole] = useState<"buyer" | "seller" | "agent">("buyer");
  const [location, setLocation] = useState("");
  const [maxPrice, setMaxPrice] = useState(0);
  const [type, setType] = useState("any");
  const [beds, setBeds] = useState(0);

  const save = useMutation({
    mutationFn: () =>
      saveOnboarding({
        data: {
          displayName: name,
          role,
          filterLocation: location,
          filterMaxPrice: maxPrice || null,
          filterPropertyType: type,
          filterMinBedrooms: beds,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries();
      await nav({ to: role === "seller" ? "/sell" : "/discover" });
    },
  });

  if (isPending) return <div className="phone-shell" />;
  if (!user) return <RedirectToSignIn />;
  if (boot.data?.profile.onboarded) return <Navigate to="/discover" />;

  return (
    <div className="phone-shell">
      <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
        <Logo />
        <h1 className="mt-8 font-display text-3xl tracking-tight">A tua próxima casa.</h1>
        <p className="mt-1 text-sm text-muted">Diz-nos o que procuras. Podes mudar tudo depois.</p>

        <form
          className="mt-8 flex flex-1 flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="n">O teu nome</Label>
            <Input id="n" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Quero</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["buyer", "Comprar"],
                  ["seller", "Vender"],
                  ["agent", "Mediar"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRole(id)}
                  className={`rounded-2xl py-3 text-sm font-medium ${
                    role === id ? "bg-primary text-primary-fg" : "bg-secondary text-fg"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc">Cidade ou zona</Label>
            <Input
              id="loc"
              placeholder="Braga, Porto, Lisboa…"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label>Preço máximo</Label>
              <span className="tabular-nums">{maxPrice ? formatPriceCompact(maxPrice) : "Sem limite"}</span>
            </div>
            <Input aria-label="Preço máximo" type="number" min={0} placeholder="Sem limite" value={maxPrice || ""} onChange={e=>setMaxPrice(Number(e.target.value))}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Tipo de imóvel</Label>
            <select
              id="type"
              className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="any">Todos</option>
              <option value="house">Moradia</option>
              <option value="condo">Apartamento</option>
              <option value="townhouse">Moradia em banda</option>
              <option value="apartment">Apartamento</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="beds">Mínimo de quartos</Label>
            <select
              id="beds"
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
          <Button type="submit" className="mt-auto w-full" disabled={save.isPending}>
            {save.isPending ? "A guardar…" : "Descobrir casas"}
          </Button>
        </form>
      </main>
    </div>
  );
}

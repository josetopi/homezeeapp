import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Building2,
  ChevronRight,
  Handshake,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { bootstrap, updateProfile } from "@/lib/server/homezee";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FREE_DAILY_SWIPES } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const boot = useQuery({
    queryKey: ["bootstrap", user?.id],
    enabled: Boolean(user),
    queryFn: () =>
      bootstrap({ data: { displayName: user?.displayName, avatarUrl: user?.profileImageUrl } }),
  });
  const p = boot.data?.profile;
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [role, setRole] = useState<"buyer" | "seller" | "agent">("buyer");
  const [editing, setEditing] = useState(false);

  const save = useMutation({
    mutationFn: () => updateProfile({ data: { displayName: name, bio, role } }),
    onSuccess: async () => {
      toast.success("Perfil guardado");
      setEditing(false);
      await qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });

  if (!p) return null;

  const remaining = p.isPro ? null : Math.max(0, FREE_DAILY_SWIPES - p.swipeCountToday);
  const topCities = Object.entries(p.taste.cities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="space-y-5 overflow-y-auto px-4 py-4 pb-10">
      <div className="flex items-center gap-3">
        <Avatar src={p.avatarUrl ?? user?.profileImageUrl} name={p.displayName} className="size-14" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight">{p.displayName}</h1>
          <p className="text-sm text-muted capitalize">{p.role}{p.isPro ? " · Pro" : ""}</p>
        </div>
      </div>

      <p className="rounded-2xl bg-secondary px-4 py-3 text-sm">
        {remaining == null
          ? "Unlimited swipes today."
          : `${remaining} of ${FREE_DAILY_SWIPES} swipes left today.`}
      </p>

      {topCities.length > 0 ? (
        <p className="text-sm text-muted">
          Preferências: {topCities.map(([c]) => c).join(", ")}.
        </p>
      ) : (
        <p className="text-sm text-muted">Guarda algumas casas para personalizar as sugestões.</p>
      )}

      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="nm">Name</Label>
            <Input id="nm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["buyer", "seller", "agent"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-2xl py-2 text-sm font-medium capitalize ${
                  role === r ? "bg-primary text-primary-fg" : "bg-secondary"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Button type="submit" className="w-full" disabled={save.isPending}>
            Guardar
          </Button>
        </form>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setName(p.displayName);
            setBio(p.bio);
            setRole(p.role);
            setEditing(true);
          }}
        >
          Edit profile
        </Button>
      )}

      <nav className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-elevated">
        <Row to="/sell" icon={<Building2 className="size-4" />} label="Anunciar uma casa" />
        <Row to="/offers" icon={<Handshake className="size-4" />} label="Propostas" />
        <Row to="/stats" icon={<BarChart3 className="size-4" />} label="Estatísticas do mercado" />
        <Row to="/suggestions" icon={<Sparkles className="size-4" />} label="Sugestões Smart" />
        <Row to="/pro" icon={<Sparkles className="size-4" />} label="homezee Pro" />
        <Row to="/agent" icon={<UserRound className="size-4" />} label="Sou mediador" />
        <Row to="/admin" icon={<Shield className="size-4" />} label="Admin" />
      </nav>

      <div className="rounded-2xl bg-secondary px-4 py-3">
        <UserButton />
      </div>
    </div>
  );
}

function Row({
  to,
  icon,
  label,
}: {
  to: "/sell" | "/offers" | "/stats" | "/suggestions" | "/pro" | "/agent" | "/admin";
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium">
      <span className="grid size-8 place-items-center rounded-full bg-secondary text-fg">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-4 text-subtle" />
    </Link>
  );
}

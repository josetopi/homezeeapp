import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { activatePro, bootstrap } from "@/lib/server/homezee";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/_app/pro")({ component: ProPage });

const perks = [
  "Unlimited daily swipes",
  "Smart Suggestions ranked by taste",
  "Smart Notifications for matches and good deals",
  "Full Market Statistics dashboard",
];

function ProPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const boot = useQuery({
    queryKey: ["bootstrap", user?.id],
    enabled: Boolean(user),
    queryFn: () =>
      bootstrap({ data: { displayName: user?.displayName, avatarUrl: user?.profileImageUrl } }),
  });
  const go = useMutation({
    mutationFn: (plan: "monthly" | "yearly") => activatePro({ data: plan }),
    onSuccess: async () => {
      toast.success("Pro is on");
      await qc.invalidateQueries();
    },
  });
  const isPro = boot.data?.profile.isPro;

  return (
    <div className="space-y-6 overflow-y-auto px-4 py-4 pb-10">
      <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">homezee pro</p>
      <p className="mb-4 rounded-xl bg-secondary p-3 text-sm text-muted">Planos em preparação. Não são efetuadas cobranças nesta versão.</p>
      <h1 className="font-display text-3xl tracking-tight">See more. Miss less.</h1>
      <p className="text-sm text-muted">
        Free accounts cap at 100 swipes a day and a teaser of the market. Pro opens the full stack.
      </p>
      <ul className="space-y-2">
        {perks.map((p) => (
          <li key={p} className="flex items-center gap-2 text-sm">
            <span className="grid size-6 place-items-center rounded-full bg-like/15 text-like">
              <Check className="size-3.5" />
            </span>
            {p}
          </li>
        ))}
      </ul>
      {isPro ? (
        <p className="rounded-2xl bg-secondary p-4 text-sm">
          You're on Pro ({boot.data?.profile.proPlan}).{" "}
          <Link to="/suggestions" className="font-medium text-primary">
            Open Smart Suggestions
          </Link>
        </p>
      ) : (
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => go.mutate("monthly")}
            className="rounded-2xl border border-border bg-elevated p-4 text-left"
          >
            <p className="text-sm text-muted">Mensal</p>
            <p className="font-display text-3xl">$19.99</p>
          </button>
          <button
            type="button"
            onClick={() => go.mutate("yearly")}
            className="rounded-2xl border-2 border-primary bg-elevated p-4 text-left"
          >
            <p className="text-sm text-muted">Yearly · two months free</p>
            <p className="font-display text-3xl">$119.99</p>
          </button>
        </div>
      )}
    </div>
  );
}

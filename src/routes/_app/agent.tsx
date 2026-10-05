import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyAgent, bootstrap, myTransactions } from "@/lib/server/homezee";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_app/agent")({ component: AgentPage });

function AgentPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const boot = useQuery({
    queryKey: ["bootstrap", user?.id],
    enabled: Boolean(user),
    queryFn: () =>
      bootstrap({ data: { displayName: user?.displayName, avatarUrl: user?.profileImageUrl } }),
  });
  const tx = useQuery({ queryKey: ["tx"], queryFn: () => myTransactions() });
  const [license, setLicense] = useState("");
  const [area, setArea] = useState("");
  const [specialty, setSpecialty] = useState("house");
  const apply = useMutation({
    mutationFn: () =>
      applyAgent({ data: { licenseNumber: license, coverageArea: area, specialty } }),
    onSuccess: async () => {
      toast.success("Application submitted");
      await qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const profile = boot.data?.profile;
  const matched = tx.data?.rows.filter((r) => r.agentFee > 0) ?? [];

  return (
    <div className="space-y-5 overflow-y-auto px-4 py-4 pb-10">
      <h1 className="font-display text-2xl tracking-tight">Verified agents</h1>
      <p className="text-sm text-muted">
        Apply with a license number, coverage area, and specialty. Admins review applications. Approved agents are randomly
        matched to in-app closings in their area for a 1% fee share.
      </p>
      {profile?.agentStatus ? (
        <Badge className="capitalize">{profile.agentStatus}</Badge>
      ) : null}

      <form
        className="space-y-3 rounded-2xl bg-secondary p-4"
        onSubmit={(e) => {
          e.preventDefault();
          apply.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="lic">License number</Label>
          <Input id="lic" required value={license} onChange={(e) => setLicense(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="area">Coverage area</Label>
          <Input
            id="area"
            required
            placeholder="Austin, Dallas or Any"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sp">Specialty</Label>
          <select
            id="sp"
            className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          >
            <option value="any">Any</option>
            <option value="house">House</option>
            <option value="condo">Condo</option>
            <option value="townhouse">Townhouse</option>
            <option value="apartment">Apartment</option>
          </select>
        </div>
        <Button type="submit" className="w-full" disabled={apply.isPending}>
          {profile?.agentStatus ? "Resubmit" : "Apply"}
        </Button>
      </form>

      {profile?.isAgent ? (
        <section>
          <h2 className="text-sm font-medium tracking-wide text-muted uppercase">Matched closings</h2>
          <div className="mt-2 space-y-2">
            {matched.length === 0 ? (
              <p className="text-sm text-muted">No matches yet. Closings in your coverage will appear here.</p>
            ) : (
              matched.map((t) => (
                <div key={t.id} className="rounded-2xl border border-border bg-elevated p-3">
                  <p className="font-medium">{t.listingTitle}</p>
                  <p className="text-sm text-muted">
                    Sale {formatPrice(t.salePrice)} · Your share {formatPrice(t.agentFee)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

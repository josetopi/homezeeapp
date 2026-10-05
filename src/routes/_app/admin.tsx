import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bootstrap, claimAdmin, listAgentApplications, reviewAgent } from "@/lib/server/homezee";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { EmptyState } from "@/components/empty-state";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_app/admin")({ component: AdminPage });

function AdminPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const boot = useQuery({
    queryKey: ["bootstrap", user?.id],
    enabled: Boolean(user),
    queryFn: () =>
      bootstrap({ data: { displayName: user?.displayName, avatarUrl: user?.profileImageUrl } }),
  });
  const claim = useMutation({
    mutationFn: () => claimAdmin(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("Admin claimed");
    },
  });
  const isAdmin = boot.data?.profile.isAdmin;
  const apps = useQuery({
    queryKey: ["agent-apps"],
    queryFn: () => listAgentApplications(),
    enabled: Boolean(isAdmin),
  });
  const review = useMutation({
    mutationFn: (p: { applicationId: number; status: "approved" | "rejected" }) => reviewAgent({ data: p }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agent-apps"] });
    },
  });

  return (
    <div className="space-y-5 overflow-y-auto px-4 py-4 pb-10">
      <h1 className="font-display text-2xl tracking-tight">Admin</h1>
      <p className="text-sm text-muted">Review agent applications. The first member can claim admin if none exists.</p>
      {!isAdmin ? (
        <Button onClick={() => claim.mutate()} disabled={claim.isPending}>
          Claim admin (if open)
        </Button>
      ) : null}
      {isAdmin && apps.data ? (
        <div className="space-y-3">
          {apps.data.length === 0 ? (
            <EmptyState icon={<Shield className="size-6" />} title="No applications" body="Agent applications will show here." />
          ) : (
            apps.data.map((a) => (
              <article key={a.id} className="rounded-2xl border border-border bg-elevated p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.displayName}</p>
                    <p className="text-sm text-muted">{a.licenseNumber}</p>
                    <p className="text-sm text-muted">
                      {a.coverageArea} · {a.specialty}
                    </p>
                  </div>
                  <Badge className="capitalize">{a.status}</Badge>
                </div>
                {a.status === "pending" ? (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => review.mutate({ applicationId: a.id, status: "approved" })}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => review.mutate({ applicationId: a.id, status: "rejected" })}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

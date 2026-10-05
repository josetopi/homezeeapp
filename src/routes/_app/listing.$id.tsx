import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, MessageCircle, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { ListingBody, ListingPhoto } from "@/components/listing-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getListing, openConversation, requestVisit } from "@/lib/server/homezee";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/listing/$id")({ component: ListingPage });

function ListingPage() {
  const { id } = Route.useParams();
  const listingId = Number(id);
  const nav = useNavigate();
  const qc = useQueryClient();
  const user = useCurrentUser();
  const q = useQuery({ queryKey: ["listing", listingId], queryFn: () => getListing({ data: listingId }) });
  const visit = useMutation({
    mutationFn: () => requestVisit({ data: listingId }),
    onSuccess: async () => {
      toast.success("Visita pedida");
      await qc.invalidateQueries({ queryKey: ["visits"] });
      await nav({ to: "/visits" });
    },
    onError: (e) => toast.error(e.message),
  });
  const chat = useMutation({
    mutationFn: () => openConversation({ data: listingId }),
    onSuccess: (res) => nav({ to: "/messages/$id", params: { id: String(res.conversationId) } }),
    onError: (e) => toast.error(e.message),
  });

  const listing = q.data;
  if (q.isPending) {
    return (
      <div className="p-4">
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );
  }
  if (!listing) {
    return <p className="p-6 text-sm text-muted">Anúncio não encontrado.</p>;
  }
  const mine = listing.sellerId === user?.id;

  return (
    <div className="flex h-[calc(100dvh-4.25rem)] flex-col overflow-y-auto">
      <div className="relative">
        <ListingPhoto listing={listing} className="h-80 w-full" />
        <Link
          to="/favorites"
          className="absolute top-3 left-3 grid size-10 place-items-center rounded-full bg-elevated/90 text-fg"
        >
          <ChevronLeft className="size-5" />
        </Link>
      </div>
      <div className="space-y-4 px-4 py-4">
        <ListingBody listing={listing} />
        <div className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
          <Avatar src={listing.sellerAvatar} name={listing.sellerName} />
          <div>
            <p className="text-sm font-medium">{listing.sellerName}</p>
            <p className="text-xs text-muted">Anunciante</p>
          </div>
        </div>
        {listing.origin === "external" ? <div className="space-y-3 pb-6"><p className="text-sm text-muted">Anúncio de {listing.source}. A disponibilidade e a visita são confirmadas no portal original.</p><Button asChild className="w-full"><a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer">Pedir visita no {listing.source}</a></Button></div> : !mine ? (
          <div className="grid grid-cols-2 gap-2 pb-6">
            <Button variant="outline" onClick={() => chat.mutate()} disabled={chat.isPending}>
              <MessageCircle className="size-4" />
              Mensagem
            </Button>
            <Button onClick={() => visit.mutate()} disabled={visit.isPending}>
              <CalendarClock className="size-4" />
              Pedir visita
            </Button>
          </div>
        ) : (
          <Button asChild variant="outline" className="w-full">
            <Link to="/sell/$id" params={{ id: String(listing.id) }}>
              Manage listing
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

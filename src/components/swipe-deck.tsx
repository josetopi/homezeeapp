import { useEffect, useRef, useState, type ReactNode } from "react";
import { Heart, X, CalendarClock } from "lucide-react";
import type { Listing, SwipeAction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ListingPhoto } from "@/components/listing-card";

const EXIT_MS = 280;

export function SwipeDeck({
  listings,
  onSwipe,
  disabled,
}: {
  listings: Listing[];
  onSwipe: (listing: Listing, action: SwipeAction) => void | Promise<void>;
  disabled?: boolean;
}) {
  const dismissed = useRef(new Set<number>());
  const [gone, setGone] = useState<number | null>(null);
  const [exit, setExit] = useState<{ dx: number; dy: number; rot: number } | null>(null);
  const [, bump] = useState(0);

  const stack = listings.filter((l) => !dismissed.current.has(l.id) || l.id === gone);
  const top = stack[0];
  const next = stack[1];

  function commit(listing: Listing, action: SwipeAction, fly: { dx: number; dy: number; rot: number }) {
    if (disabled || gone != null) return;
    if (action === "up" && listing.origin === "external" && listing.sourceUrl) {
      window.open(listing.sourceUrl, "_blank", "noopener,noreferrer");
    }
    dismissed.current.add(listing.id);
    setGone(listing.id);
    setExit(fly);
    window.setTimeout(() => {
      setGone(null);
      setExit(null);
      bump((n) => n + 1);
      void onSwipe(listing, action);
    }, EXIT_MS);
  }

  if (!top) return null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative mx-auto min-h-0 w-full flex-1">
        {next ? (
          <div className="absolute inset-x-4 top-3 bottom-2 overflow-hidden rounded-3xl bg-elevated shadow-card scale-[0.96] opacity-80">
            <ListingPhoto listing={next} className="h-full w-full" overlay />
          </div>
        ) : null}
        <SwipeCard
          key={top.id}
          listing={top}
          disabled={disabled || gone != null}
          fly={gone === top.id ? exit : null}
          onDecide={(action, fly) => commit(top, action, fly)}
        />
      </div>
      <div className="flex items-center justify-center gap-5 py-3">
        <RoundAction
          label="Passar"
          className="size-14 border-primary/25 text-primary"
          onClick={() => commit(top, "left", { dx: -520, dy: 40, rot: -18 })}
        >
          <X className="size-7" />
        </RoundAction>
        <RoundAction
          label="Pedir visita"
          className="size-16 border-visit/30 text-visit"
          onClick={() => commit(top, "up", { dx: 0, dy: -640, rot: 0 })}
        >
          <CalendarClock className="size-7" />
        </RoundAction>
        <RoundAction
          label="Guardar"
          className="size-14 border-like/30 text-like"
          onClick={() => commit(top, "right", { dx: 520, dy: 40, rot: 18 })}
        >
          <Heart className="size-7 fill-current" />
        </RoundAction>
      </div>
    </div>
  );
}

function RoundAction({
  children,
  label,
  className,
  onClick,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid place-items-center rounded-full border-4 bg-elevated shadow-btn transition-transform duration-150 hover:scale-105 active:scale-95",
        className,
      )}
    >
      {children}
    </button>
  );
}

function SwipeCard({
  listing,
  onDecide,
  disabled,
  fly,
}: {
  listing: Listing;
  onDecide: (action: SwipeAction, fly: { dx: number; dy: number; rot: number }) => void;
  disabled?: boolean;
  fly: { dx: number; dy: number; rot: number } | null;
}) {
  const [mapOpen, setMapOpen] = useState(false);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number; dragging: boolean } | null>(null);
  const decide = useRef(onDecide);
  decide.current = onDecide;
  const [pos, setPos] = useState({ dx: 0, dy: 0, dragging: false });

  useEffect(() => {
    function move(e: PointerEvent) {
      if (!drag.current?.dragging) return;
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      drag.current.dx = dx;
      drag.current.dy = dy;
      setPos({ dx, dy, dragging: true });
    }
    function up() {
      if (!drag.current?.dragging) return;
      const { dx, dy } = drag.current;
      drag.current.dragging = false;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (dy < -90 && absY > absX) {
        decide.current("up", { dx: dx * 0.2, dy: -640, rot: 0 });
        return;
      }
      if (absX > 110) {
        decide.current(dx > 0 ? "right" : "left", {
          dx: dx > 0 ? 560 : -560,
          dy,
          rot: dx > 0 ? 22 : -22,
        });
        return;
      }
      setPos({ dx: 0, dy: 0, dragging: false });
    }
    window.addEventListener("pointermove", move);
    function cancel(){drag.current = null; setPos({dx:0,dy:0,dragging:false});}
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, []);

  const dx = fly?.dx ?? pos.dx;
  const dy = fly?.dy ?? pos.dy;
  const rot = fly?.rot ?? dx / 18;
  const likeO = Math.min(1, Math.max(0, dx / 120));
  const nopeO = Math.min(1, Math.max(0, -dx / 120));
  const visitO = Math.min(1, Math.max(0, -dy / 110 - Math.abs(dx) / 200));

  return (
    <div
      data-active-listing={listing.title}
      className="absolute inset-x-3 top-0 bottom-0 flex flex-col overflow-hidden rounded-3xl bg-elevated shadow-card"
      style={{
        transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
        transition: pos.dragging && !fly ? "none" : `transform ${EXIT_MS}ms var(--ease-out-smooth)`,
        touchAction: mapOpen ? "auto" : "none",
      }}
      onPointerDown={(e) => {
        if (disabled || mapOpen) return;
        if ((e.target as HTMLElement).closest("button")) return;
        drag.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, dragging: true };
        // Keep click targets available for photo navigation.
      }}
    >
      <ListingPhoto
        listing={listing}
        overlay
        className="h-full w-full shrink-0"
        onMapChange={setMapOpen}
        stamps={
          <>
            <span className="stamp top-16 left-5 text-like" style={{ opacity: likeO, transform: "rotate(-18deg)" }}>
              Like
            </span>
            <span className="stamp top-16 right-5 text-nope" style={{ opacity: nopeO, transform: "rotate(16deg)" }}>
              Nope
            </span>
            <span className="stamp bottom-8 left-1/2 -translate-x-1/2 text-visit" style={{ opacity: visitO }}>
              Visit
            </span>
          </>
        }
      />

    </div>
  );
}

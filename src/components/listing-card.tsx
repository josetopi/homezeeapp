import { useState, type ReactNode, type MouseEvent, type PointerEvent } from "react";
import { MapPin, Maximize2 } from "lucide-react";
import type { Listing } from "@/lib/types";
import { formatBedsBaths, formatPrice, formatSqft, propertyLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function ListingPhoto({ listing, className, stamps, overlay = false, onMapChange }: {
  listing: Listing; className?: string; stamps?: ReactNode; overlay?: boolean; onMapChange?: (open: boolean) => void;
}) {
  const photos = listing.photos;
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(14);
  const [failed, setFailed] = useState(false);
  const map = i === photos.length;
  const total = photos.length + 1;
  function change(next: number) { setI(next); setFailed(false); onMapChange?.(next === photos.length); }
  function onTap(e: MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    change((i + (e.clientX - rect.left < rect.width / 2 ? -1 : 1) + total) % total);
  }
  const query = listing.geo ? `${listing.geo.lat},${listing.geo.lon}` : listing.isDemo ? `${listing.city}, Portugal` : listing.mapQuery || `${listing.address}, ${listing.city}, Portugal`;
  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)} data-map-open={map}>
      {map ? <div className="absolute inset-0" onPointerDown={e=>e.stopPropagation()}>
        <iframe title={`Mapa de ${listing.title}`} className="size-full border-0" src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <div className="absolute inset-x-3 top-8 flex items-center justify-between gap-2">
          <button className="map-control" onClick={()=>change(0)}>‹ Fotografias</button>
          <span className="rounded-full bg-elevated/95 px-3 py-2 text-xs text-fg">Localização aproximada</span>
        </div>
        <div className="absolute right-3 bottom-8 flex flex-col gap-1">
          <button aria-label="Aproximar mapa" className="map-control" onClick={()=>setZoom(z=>Math.min(19,z+1))}>+</button>
          <button aria-label="Afastar mapa" className="map-control" onClick={()=>setZoom(z=>Math.max(3,z-1))}>−</button>
        </div>
      </div> : <>
        {photos[i] && !failed ? <img src={photos[i]} alt={listing.title} className="size-full object-cover" draggable={false} onError={()=>setFailed(true)} /> : <div className="grid size-full place-items-center text-muted">Fotografia indisponível</div>}
        <div className="absolute inset-0" onClick={onTap} role="presentation" />
        <div className="scrim-top pointer-events-none absolute inset-x-0 top-0 h-24" />
        <div className="scrim-bottom pointer-events-none absolute inset-x-0 bottom-0 h-3/5" />
        <Badge className="pointer-events-none absolute top-7 left-4 bg-elevated/90 text-fg">{listing.isDemo ? "Demonstração" : listing.source || "Homezee"}</Badge>
        {listing.isGoodDeal && !listing.isDemo ? <Badge variant="like" className="pointer-events-none absolute top-7 right-4">Bom preço</Badge> : null}
        {overlay ? <div className="photo-copy pointer-events-none absolute inset-x-5 bottom-6 text-primary-fg">
          <p className="text-sm font-semibold opacity-90">{listing.city} · {propertyLabel(listing.propertyType)}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{formatPrice(listing.price)}</p>
          <p className="mt-2 text-xl font-bold leading-tight">{listing.title}</p>
          <p className="mt-2 text-sm opacity-90">{listing.bedsUnknown ? "Tipologia por confirmar" : `T${listing.bedrooms}`} · {listing.areaUnknown ? "Área por confirmar" : formatSqft(listing.sqft)}</p>
          <p className="mt-2 line-clamp-2 text-sm opacity-85">{listing.address}</p>
        </div> : null}
        <button aria-label="Ver mapa" onClick={()=>change(photos.length)} className="absolute top-16 right-3 grid size-11 place-items-center rounded-full bg-elevated/90 text-fg"><MapPin className="size-5"/></button>
        {stamps}
      </>}
      <div className="absolute inset-x-3 top-3 flex gap-1" onPointerDown={e=>e.stopPropagation()}>
        {Array.from({length:total},(_,idx)=><button key={idx} aria-label={idx===photos.length ? "Mapa" : `Fotografia ${idx+1}`} onClick={()=>change(idx)} className="photo-segment flex-1 py-1"><span className={cn("block h-0.5 rounded-full",idx===i?"bg-elevated":"bg-elevated/40")}/></button>)}
      </div>
    </div>
  );
}

export function ListingFacts({ listing }: { listing: Listing }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-extrabold tracking-tight">{formatPrice(listing.price)}</p>
        <span className="text-xs font-medium tracking-wide text-muted uppercase">
          {propertyLabel(listing.propertyType)}
        </span>
      </div>
      <p className="flex items-center gap-1 text-sm text-fg">
        <MapPin className="size-3.5 text-muted" />
        {listing.address}
      </p>
      <p className="text-sm text-muted">
        {listing.neighborhood ? `${listing.neighborhood} · ` : ""}
        {listing.city}, {listing.state}
      </p>
      <p className="text-sm font-medium">
        {listing.bedsUnknown ? "Tipologia por confirmar" : formatBedsBaths(listing.bedrooms, listing.bathrooms)}
        <span className="text-subtle"> · </span>
        {formatSqft(listing.sqft)}
        {listing.yearBuilt ? (
          <>
            <span className="text-subtle"> · </span>
            Ano {listing.yearBuilt}
          </>
        ) : null}
      </p>
    </div>
  );
}

export function ListingBody({ listing, compact = false }: { listing: Listing; compact?: boolean }) {
  if (compact) {
    return (
      <div className="space-y-1">
        <p className="truncate text-sm font-semibold">{listing.title}</p>
        <p className="text-sm font-medium">
          {listing.bedsUnknown ? "Tipologia por confirmar" : formatBedsBaths(listing.bedrooms, listing.bathrooms)}
          <span className="text-subtle"> · </span>
          {formatSqft(listing.sqft)}
          <span className="text-subtle"> · </span>
          {propertyLabel(listing.propertyType)}
        </p>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">{listing.description}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <ListingFacts listing={listing} />
      <p className="text-sm leading-relaxed text-muted">{listing.description}</p>
      <p className="text-xs tracking-wide text-subtle uppercase">{listing.style}</p>
    </div>
  );
}

export function ListingRow({ listing, onOpen }: { listing: Listing; onOpen?: () => void }) {
  const photo = listing.photos[0] ?? "/listings/01a.jpg";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full gap-3 rounded-2xl bg-elevated p-2 text-left shadow-sm ring-1 ring-border/80"
    >
      <img src={photo} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1 py-1">
        <p className="truncate font-medium">{listing.title}</p>
        <p className="truncate text-sm text-muted">
          {listing.city} · {listing.bedsUnknown ? "Tipologia por confirmar" : formatBedsBaths(listing.bedrooms, listing.bathrooms)}
        </p>
        <p className="mt-1 text-lg font-extrabold tracking-tight">{formatPrice(listing.price)}</p>
      </div>
      <Maximize2 className="mt-2 mr-1 size-4 text-subtle" />
    </button>
  );
}

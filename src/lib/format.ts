const usd = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const compactUsd = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatPrice(n: number) {
  return usd.format(n);
}

export function formatPriceCompact(n: number) {
  return compactUsd.format(n);
}

export function formatSqft(n: number) {
  return `${n.toLocaleString("pt-PT")} m²`;
}

export function formatBedsBaths(beds: number, baths: number) {
  const b = Number.isInteger(baths) ? String(baths) : baths.toFixed(1);
  return `T${beds}${baths > 0 ? ` · ${b} WC` : ""}`;
}

export function formatWhen(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-PT", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDay(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-PT", { month: "short", day: "numeric", year: "numeric" });
}

export function propertyLabel(type: string) {
  const map: Record<string, string> = {
    house: "Moradia",
    condo: "Apartamento",
    townhouse: "Moradia em banda",
    apartment: "Apartamento",
    land: "Terreno", farm: "Quinta",
  };
  return map[type] ?? type;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "H";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { marketStats } from "@/lib/server/homezee";
import { formatPriceCompact } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ListingRow } from "@/components/listing-card";
import { useNavigate } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/stats")({ component: StatsPage });

function StatsPage() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["stats"], queryFn: () => marketStats() });
  const data = q.data;

  if (q.isPending || !data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const months = [...new Set(data.snapshots.map((s) => s.month))];
  const trend = months.map((month) => {
    const rows = data.snapshots.filter((s) => s.month === month);
    const avg = Math.round(rows.reduce((a, r) => a + r.avgPrice, 0) / Math.max(1, rows.length));
    const volume = rows.reduce((a, r) => a + r.listingCount, 0);
    return { month: month.slice(5), avg, volume };
  });
  const locked = !data.isPro;

  return (
    <div className="space-y-6 overflow-y-auto px-4 py-4 pb-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Estatísticas do mercado</h1>
        <p className="mt-1 text-sm text-muted">
          Built from live listings on homezee — price trends, volume, and deal quality.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Price trend</h2>
        <div className="mt-2 h-48 rounded-2xl bg-elevated p-2 ring-1 ring-border">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-subtle)" />
              <YAxis
                tickFormatter={(v) => formatPriceCompact(Number(v))}
                width={56}
                tick={{ fontSize: 11 }}
                stroke="var(--color-subtle)"
              />
              <Tooltip formatter={(v) => formatPriceCompact(Number(v ?? 0))} />
              <Area type="monotone" dataKey="avg" stroke="var(--color-primary)" fill="url(#priceFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="relative">
        <div className={cn(locked && "pointer-events-none blur-sm")}>
          <section>
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Average by city</h2>
            <div className="mt-2 h-56 rounded-2xl bg-elevated p-2 ring-1 ring-border">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byCity.slice(0, 8)}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="city" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={48} stroke="var(--color-subtle)" />
                  <YAxis tickFormatter={(v) => formatPriceCompact(Number(v))} width={56} tick={{ fontSize: 11 }} stroke="var(--color-subtle)" />
                  <Tooltip formatter={(v) => formatPriceCompact(Number(v ?? 0))} />
                  <Bar dataKey="avgPrice" fill="var(--color-fg)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Listing volume</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {data.volume.map((v) => (
                <div key={v.status} className="rounded-2xl bg-secondary p-3">
                  <p className="text-xs tracking-wide text-muted uppercase">{v.status.replace("_", " ")}</p>
                  <p className="text-2xl font-extrabold tabular-nums">{v.count}</p>
                </div>
              ))}
              <div className="rounded-2xl bg-secondary p-3">
                <p className="text-xs tracking-wide text-muted uppercase">Closings</p>
                <p className="text-2xl font-extrabold tabular-nums">{data.closings}</p>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Deal quality</h2>
            <p className="mt-1 text-sm text-muted">Priced below the live city average.</p>
            <div className="mt-3 space-y-3">
              {data.goodDeals.map((l) => (
                <ListingRow
                  key={l.id}
                  listing={l}
                  onOpen={() => nav({ to: "/listing/$id", params: { id: String(l.id) } })}
                />
              ))}
            </div>
          </section>
        </div>
        {locked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-start rounded-2xl bg-surface/70 pt-24 text-center">
            <p className="font-semibold">Full dashboard is Pro</p>
            <p className="mt-1 max-w-xs text-sm text-muted">City averages, volume, and deal flags unlock with a plan.</p>
            <Button asChild className="mt-4">
              <Link to="/pro">Go Pro</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

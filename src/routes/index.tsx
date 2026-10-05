import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Heart, CalendarClock, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (!isPending && user) return <Navigate to="/discover" />;

  return (
    <div className="phone-shell">
      <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10">
        <header className="flex items-center justify-between pt-6">
          <Logo />
          <SignInGate fallback={<Link to="/login" className="text-sm font-medium text-primary">Entrar</Link>}>
            <Link to="/discover" className="text-sm font-medium text-primary">
              Abrir app
            </Link>
          </SignInGate>
        </header>

        <div className="relative mt-6 flex-1">
          <div className="absolute inset-x-6 top-6 rounded-3xl bg-elevated shadow-card opacity-50 scale-95" />
          <div className="relative overflow-hidden rounded-3xl bg-elevated shadow-card">
            <div className="relative h-80">
              <img
                src="/listings/01a.jpg"
                alt="Featured home"
                className="size-full object-cover"
              />
              <div className="scrim-bottom absolute inset-x-0 bottom-0 h-28" />
              <div className="absolute bottom-4 left-4 text-primary-fg">
                <p className="font-display text-2xl">385 000 €</p>
                <p className="text-sm opacity-90">Braga · fotografia ilustrativa</p>
              </div>
              <span className="stamp top-8 left-5 text-like" style={{ opacity: 0.9, transform: "rotate(-18deg)" }}>
                Like
              </span>
            </div>
            <div className="flex items-center justify-center gap-4 py-4">
              <span className="grid size-12 place-items-center rounded-full border-4 border-primary/20 text-primary">
                <span className="text-lg font-bold">×</span>
              </span>
              <span className="grid size-14 place-items-center rounded-full border-4 border-visit/25 text-visit">
                <CalendarClock className="size-6" />
              </span>
              <span className="grid size-12 place-items-center rounded-full border-4 border-like/25 text-like">
                <Heart className="size-5 fill-current" />
              </span>
            </div>
          </div>
        </div>

        <section className="mt-8 space-y-3">
          <h1 className="font-display text-4xl leading-none tracking-tight">
            Swipe homes.
            <br />
            Tour in-app.
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            Set a price cap, swipe the feed, favorite what fits, and request a visit with an upward swipe.
            Offers open only after a confirmed tour.
          </p>
          <ul className="space-y-2 pt-1 text-sm text-fg">
            <Row icon={<SlidersHorizontal className="size-4" />} text="Filters for city, price, type, and bedrooms" />
            <Row icon={<Heart className="size-4" />} text="Taste learning that ranks the next card" />
            <Row icon={<CalendarClock className="size-4" />} text="Visits, chat, and offers stay on the record" />
          </ul>
        </section>

        <div className="mt-8 space-y-3">
          {user ? (
            <Button asChild className="w-full">
              <Link to="/discover">Continuar</Link>
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link to="/login">Start swiping</Link>
            </Button>
          )}
          <a
            href="/homezee-source.zip"
            download="homezee-source.zip"
            className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-elevated text-sm font-semibold text-fg"
          >
            Download source code
          </a>
        </div>
      </main>
    </div>
  );
}

function Row({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-8 place-items-center rounded-full bg-secondary text-fg">{icon}</span>
      {text}
    </li>
  );
}

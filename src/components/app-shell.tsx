import { Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Heart, Home, MessageCircle, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { bootstrap } from "@/lib/server/homezee";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";

const tabs = [
  { to: "/discover", label: "Discover", icon: Home },
  { to: "/favorites", label: "Guardados", icon: Heart },
  { to: "/messages", label: "Mensagens", icon: MessageCircle },
  { to: "/visits", label: "Visitas", icon: CalendarDays },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function AppShell() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const boot = useQuery({
    queryKey: ["bootstrap", user?.id],
    enabled: Boolean(user),
    queryFn: () =>
      bootstrap({
        data: { displayName: user?.displayName, avatarUrl: user?.profileImageUrl },
      }),
  });

  if (isPending) {
    return (
      <div className="phone-shell">
        <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface px-4 pt-8">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-6 flex-1 rounded-3xl" />
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (boot.isPending) {
    return (
      <div className="phone-shell">
        <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface px-4 pt-8">
          <Logo />
          <Skeleton className="mt-6 flex-1 rounded-3xl" />
        </div>
      </div>
    );
  }
  if (boot.data && !boot.data.profile.onboarded && pathname !== "/onboarding") {
    return <Navigate to="/onboarding" />;
  }

  const unread = boot.data?.unread ?? 0;

  return (
    <div className="phone-shell">
      <div className="mx-auto flex h-dvh max-w-md flex-col bg-surface shadow-card">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
        <nav className="sticky bottom-0 z-30 flex border-t border-border bg-elevated/95 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
          {tabs.map((t) => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-primary" : "text-subtle",
                )}
              >
                <Icon className={cn("size-5", active && "fill-primary/15")} />
                {t.label}
                {t.to === "/messages" && unread > 0 ? (
                  <span className="absolute top-1 right-1/4 size-2 rounded-full bg-primary" />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

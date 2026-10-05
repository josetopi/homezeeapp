import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isPending) return <div className="phone-shell" />;
  if (user) return <Navigate to="/discover" />;

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({ email, password, name: name || email.split("@")[0]! });
        if (res.error) throw new Error(res.error.message);
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message);
      }
      window.location.href = "/discover";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="phone-shell">
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
        <Logo className="mb-8 self-center" />
        <h1 className="font-display text-3xl font-medium tracking-tight">Encontra a tua casa.</h1>
        <p className="mt-2 text-sm text-muted">Entra para descobrir casas e guardar as tuas favoritas.</p>

        {authEnabled ? (
          <div className="mt-8 space-y-3">
            {(import.meta.env.VITE_GROK_LOGIN === "true" ? GROK_PROVIDERS : []).map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/discover" })}
              >
                Continue with {p.label}
              </Button>
            ))}
            <div className="flex items-center gap-3 py-2 text-xs tracking-wide text-subtle uppercase">
              <span className="h-px flex-1 bg-border" />
              Email e palavra-passe
              <span className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={onEmail} className="space-y-3">
              {mode === "up" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Palavra-passe</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-primary">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "A entrar…" : mode === "up" ? "Criar conta" : "Entrar"}
              </Button>
            </form>
            <button
              type="button"
              className="w-full text-sm text-muted"
              onClick={() => setMode(mode === "up" ? "in" : "up")}
            >
              {mode === "up" ? "Já tens conta? Entra" : "És novo? Cria uma conta"}
            </button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">Sign-in is disabled.</p>
        )}

        <Link to="/" className="mt-8 text-center text-sm text-muted">
          Voltar ao início
        </Link>
      </main>
    </div>
  );
}

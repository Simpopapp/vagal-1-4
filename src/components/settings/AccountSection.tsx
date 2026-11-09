import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { syncAll } from "@/lib/db/sync";
import type { User } from "@supabase/supabase-js";

/**
 * Account and sync (F7). Signing in is never required to use the app — it
 * only turns on synchronization across devices. Email, Google and Sign in
 * with Lovable are offered side by side.
 */
export function AccountSection() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signInEmail(mode: "in" | "up") {
    setBusy(true);
    try {
      const { error } =
        mode === "in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) {
        toast.error(error.message);
      } else if (mode === "up") {
        toast.success("Conta criada. Confirme o e-mail para entrar.");
      } else {
        toast.success("Você entrou.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function signInOAuth(provider: "google" | "lovable") {
    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Você saiu. Seus dados continuam neste aparelho.");
  }

  async function syncNow() {
    if (!user) return;
    setSyncing(true);
    try {
      const summary = await syncAll(user.id);
      toast.success(`Sincronizado: ${summary.pushed} enviados, ${summary.pulled} recebidos.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A sincronização falhou.");
    } finally {
      setSyncing(false);
    }
  }

  if (!ready) {
    return (
      <Card>
        <CardContent className="p-5 text-muted-foreground">Vendo se você já entrou…</CardContent>
      </Card>
    );
  }

  if (user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conta e sincronização</CardTitle>
          <CardDescription>Você entrou como {user.email}.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => void syncNow()} disabled={syncing}>
            {syncing ? "Sincronizando…" : "Sincronizar agora"}
          </Button>
          <Button variant="outline" onClick={() => void signOut()}>
            Sair
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conta e sincronização</CardTitle>
        <CardDescription>
          Opcional: entre para ter seu vocabulário em outros aparelhos. Sem conta, tudo
          continua funcionando aqui.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void signInOAuth("google")}>
            Entrar com Google
          </Button>
          <Button variant="outline" onClick={() => void signInOAuth("lovable")}>
            Entrar com Lovable
          </Button>
        </div>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void signInEmail("in");
          }}
        >
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            aria-label="E-mail"
          />
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="senha (mínimo 6 caracteres)"
            aria-label="Senha"
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              Entrar
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void signInEmail("up")}>
              Criar conta
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

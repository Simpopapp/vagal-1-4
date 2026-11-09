import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AccountSection } from "@/components/settings/AccountSection";
import { ProviderSection } from "@/components/settings/ProviderSection";
import { getLevel, getTouchMode, resetLocalData, setLevel, setTouchMode } from "@/lib/db/repo";
import { LEVELS, type Level, type TouchMode } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes — Letra e Palavra" },
      {
        name: "description",
        content:
          "Escolha o seu nível, o que acontece ao tocar numa palavra, e comece do zero quando quiser.",
      },
      { property: "og:title", content: "Ajustes — Letra e Palavra" },
      {
        property: "og:description",
        content: "Nível, modo de toque e o botão de recomeçar. Nada mais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const LEVEL_LABELS: Record<Level, string> = {
  a1: "A1 — começo",
  a2: "A2 — básico",
  b1: "B1 — intermediário",
  b2: "B2 — bom",
  c1: "C1 — avançado",
  c2: "C2 — quase nativo",
};

const TOUCH_LABELS: Record<TouchMode, { title: string; body: string }> = {
  card: {
    title: "Mostrar o card na hora",
    body: "Você toca e vê o significado imediatamente. O card é criado sob demanda.",
  },
  collect: {
    title: "Só anotar e continuar lendo",
    body: "Você toca, a palavra é guardada, e a leitura não para. Os cards vêm depois.",
  },
};

function SettingsPage() {
  const [level, setLevelState] = useState<Level>("b1");
  const [touchMode, setTouchModeState] = useState<TouchMode>("collect");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([getLevel(), getTouchMode()]).then(([l, t]) => {
      if (!alive) return;
      setLevelState(l);
      setTouchModeState(t);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function chooseLevel(next: Level) {
    setLevelState(next);
    await setLevel(next);
    toast.success(`Nível ajustado para ${next.toUpperCase()}`);
  }

  async function chooseTouch(next: TouchMode) {
    setTouchModeState(next);
    await setTouchMode(next);
    toast.success("Modo de toque atualizado");
  }

  async function startOver() {
    await resetLocalData();
    toast.success("Tudo apagado. Você pode começar de novo.");
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-display text-3xl">Ajustes</h1>
        <p className="text-muted-foreground">
          Poucas escolhas, e elas mudam o que você vê em todas as músicas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seu nível</CardTitle>
          <CardDescription>
            Define o quanto uma palavra precisa ser explicada, e o que é sugerido para você.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <Button
              key={l}
              size="sm"
              variant={ready && level === l ? "default" : "outline"}
              onClick={() => void chooseLevel(l)}
            >
              {LEVEL_LABELS[l]}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ao tocar numa palavra</CardTitle>
          <CardDescription>
            Você pode mudar a qualquer momento, no meio de uma música.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(TOUCH_LABELS) as TouchMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => void chooseTouch(mode)}
              className={
                ready && touchMode === mode
                  ? "w-full rounded-lg border border-primary bg-secondary/60 p-4 text-left"
                  : "w-full rounded-lg border border-border p-4 text-left hover:bg-secondary/40"
              }
            >
              <div className="font-medium">{TOUCH_LABELS[mode].title}</div>
              <div className="text-sm text-muted-foreground">{TOUCH_LABELS[mode].body}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      <ProviderSection />

      <AccountSection />

      <Card>
        <CardHeader>
          <CardTitle>Começar do zero</CardTitle>
          <CardDescription>
            Apaga músicas, palavras, cards e o histórico de revisão deste aparelho.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Apagar tudo</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar tudo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Nada volta depois disso. Suas músicas e palavras somem deste aparelho.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => void startOver()}>
                  Apagar tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

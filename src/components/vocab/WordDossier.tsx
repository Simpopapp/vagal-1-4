import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCard, getDossier, findWordByHeadword } from "@/lib/db/repo";
import type { Card as StoredCard, Dossier, Word } from "@/lib/types";

/**
 * Everything known about one word (F3/F4 own the dossier generation). It shows
 * what already exists locally and never invents an explanation on the spot.
 */
export function WordDossier({ headword }: { headword: string }) {
  const [state, setState] = useState<{
    word: Word | undefined;
    card: StoredCard | undefined;
    dossier: Dossier | undefined;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    setState(null);
    void (async () => {
      const word = await findWordByHeadword(headword);
      const [card, dossier] = word
        ? await Promise.all([getCard(word.id), getDossier(word.id)])
        : [undefined, undefined];
      if (alive) setState({ word, card, dossier });
    })();
    return () => {
      alive = false;
    };
  }, [headword]);

  if (state === null) return <p className="text-muted-foreground">Procurando…</p>;

  if (!state.word) {
    return (
      <Card>
        <CardContent className="p-6">
          <p>Você ainda não marcou "{headword}".</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-display text-3xl">{state.word.surfaceForm}</h1>
        <p className="text-muted-foreground">
          {state.word.headword !== state.word.surfaceForm
            ? `forma de dicionário: ${state.word.headword}`
            : "forma de dicionário"}
        </p>
      </header>

      {state.card ? (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="rounded-lg border-l-4 border-context bg-secondary/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                nesta frase
              </div>
              <p className="text-lg">{state.card.card.inContext}</p>
            </div>
            <div className="rounded-lg border-l-4 border-literal bg-secondary/20 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                sentido literal
              </div>
              <p>{state.card.card.literal}</p>
            </div>
            <div
              className={`rounded-lg border-l-4 bg-secondary/20 p-4 ${
                state.card.card.insteadOf.verdict === "right"
                  ? "border-verdict-right"
                  : state.card.card.insteadOf.verdict === "wrong"
                    ? "border-verdict-wrong"
                    : "border-verdict-mcnc"
              }`}
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                em vez de…
              </div>
              <p>
                {state.card.card.insteadOf.word}{" "}
                <Badge variant="secondary">{state.card.card.insteadOf.verdict}</Badge>
              </p>
              <p className="text-sm text-muted-foreground">{state.card.card.insteadOf.reason}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5">
            <p>O card desta palavra ainda não foi gerado.</p>
          </CardContent>
        </Card>
      )}

      {state.dossier && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <DossierList title="usos frequentes" items={state.dossier.commonUses} />
            <DossierList title="combinações" items={state.dossier.collocations} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DossierList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="mt-1 list-disc pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCard,
  getDossier,
  listActiveWords,
  listAllSenses,
  listReviewsByWord,
  listSongs,
  saveReview,
  setWordStage,
} from "@/lib/db/repo";
import { MAX_GAP, planReview } from "@/lib/srs/scheduler";
import { buildSession, gradeVerdictChoice, type SessionItem } from "@/lib/srs/session";
import { VERDICTS, type Card as StoredCard, type Dossier, type Review, type Sense, type Song, type Verdict, type Word } from "@/lib/types";

const VERDICT_BUTTON: Record<Verdict, string> = {
  wrong: "✗ não cabe",
  right: "✓ cabe",
  mcnc: "◐ cabe, mas pior",
};

type Phase =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "item"; index: number; revealed: boolean }
  | { kind: "done"; total: number; correct: number };

/**
 * The practice session (F6). Every item is built on the song line the word
 * came from, the angle rotates (never the same one twice in a row), and the
 * answer schedules the next visit: a miss comes back in 10 minutes, a hit
 * goes further out.
 */
export function PracticeSession() {
  const [items, setItems] = useState<SessionItem[] | null>(null);
  const [songs, setSongs] = useState<Map<string, Song>>(new Map());
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const words = await listActiveWords();
      const [senseRows, songRows] = await Promise.all([listAllSenses(), listSongs()]);

      const cards = new Map<string, StoredCard>();
      const dossiers = new Map<string, Dossier>();
      const reviewsByWord = new Map<string, Review[]>();
      await Promise.all(
        words.map(async (word) => {
          const [card, dossier, reviews] = await Promise.all([
            getCard(word.id),
            getDossier(word.id),
            listReviewsByWord(word.id),
          ]);
          if (card) cards.set(word.id, card);
          if (dossier) dossiers.set(word.id, dossier);
          if (reviews.length > 0) reviewsByWord.set(word.id, reviews);
        }),
      );

      const sensesByWord = new Map<string, Sense[]>();
      for (const sense of senseRows) {
        const list = sensesByWord.get(sense.wordId) ?? [];
        list.push(sense);
        sensesByWord.set(sense.wordId, list);
      }

      if (!alive) return;
      const session = buildSession({
        words,
        cards,
        sensesByWord,
        reviewsByWord,
        dossiers,
        now: Date.now(),
      });
      setItems(session);
      setSongs(new Map(songRows.map((song) => [song.id, song])));
      setPhase(session.length === 0 ? { kind: "empty" } : { kind: "item", index: 0, revealed: false });
    })();
    return () => {
      alive = false;
    };
  }, []);

  const current: SessionItem | null = useMemo(() => {
    if (phase.kind !== "item" || items === null) return null;
    return items[phase.index] ?? null;
  }, [phase, items]);

  async function grade(correct: boolean) {
    if (!current || items === null || phase.kind !== "item") return;

    const now = Date.now();
    const plan = planReview({
      previousGapMs: current.previousGapMs,
      correct,
      lapseCount: current.lapseCount,
      now,
    });
    await saveReview({
      wordId: current.wordId,
      kind: current.kind,
      correct,
      reviewedAt: now,
      dueAt: plan.dueAt,
      lapseCount: plan.lapseCount,
    });
    await setWordStage(current.wordId, plan.gapMs >= MAX_GAP ? "mastered" : "learning");

    const nextCorrect = correctCount + (correct ? 1 : 0);
    setCorrectCount(nextCorrect);
    const nextIndex = phase.index + 1;
    setPhase(
      nextIndex >= items.length
        ? { kind: "done", total: items.length, correct: nextCorrect }
        : { kind: "item", index: nextIndex, revealed: false },
    );
  }

  if (phase.kind === "loading") {
    return <p className="text-muted-foreground">Preparando a sessão…</p>;
  }

  if (phase.kind === "empty") {
    return (
      <div className="space-y-5">
        <h1 className="text-display text-3xl">Praticar</h1>
        <Card>
          <CardContent className="p-6">
            <p>Nada para revisar agora.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Marque palavras numa música e espere os cards ficarem prontos — a revisão
              aparece aqui quando for hora.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase.kind === "done") {
    return (
      <div className="space-y-5">
        <h1 className="text-display text-3xl">Sessão feita</h1>
        <Card>
          <CardContent className="p-6">
            <p>
              {phase.correct} de {phase.total} certa{phase.total === 1 ? "" : "s"}.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              O que você errou volta daqui a pouco; o que acertou foi para mais longe.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!current || items === null) return null;
  const revealed = phase.kind === "item" && phase.revealed;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-display text-3xl">Praticar</h1>
        <p className="text-muted-foreground">
          {phase.kind === "item" ? phase.index + 1 : 1} de {items.length}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{promptFor(current)}</CardTitle>
          <CardDescription>{songHint(current, songs)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ItemBody item={current} revealed={revealed} />

          {current.kind === "synonym-fits" && !revealed ? (
            <div className="flex flex-wrap gap-2">
              {VERDICTS.map((verdict) => (
                <Button
                  key={verdict}
                  variant="outline"
                  onClick={() => {
                    setPhase({ kind: "item", index: phase.kind === "item" ? phase.index : 0, revealed: true });
                    void grade(gradeVerdictChoice(verdict, current.verdict ?? "mcnc"));
                  }}
                >
                  {VERDICT_BUTTON[verdict]}
                </Button>
              ))}
            </div>
          ) : !revealed ? (
            <Button
              onClick={() =>
                setPhase({ kind: "item", index: phase.kind === "item" ? phase.index : 0, revealed: true })
              }
            >
              Revelar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void grade(false)}>
                Errei
              </Button>
              <Button onClick={() => void grade(true)}>Acertei</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function promptFor(item: SessionItem): string {
  switch (item.kind) {
    case "context-meaning":
      return `O que "${item.surfaceForm}" significa nessa frase?`;
    case "synonym-fits":
      return `"${item.synonym}" caberia no lugar de "${item.surfaceForm}" aqui?`;
    case "lyrics-gap":
      return "Qual palavra está faltando na frase?";
    case "confusable-choice":
      return "Qual dessas é a palavra da frase?";
    case "reappearance":
      return `"${item.surfaceForm}" apareceu de novo, em outra música. O que ela quer dizer em cada uma?`;
  }
}

function songHint(item: SessionItem, songs: Map<string, Song>): string {
  void songs;
  return "da sua música";
}

function ItemBody({ item, revealed }: { item: SessionItem; revealed: boolean }) {
  const gapLine = item.line.replace(new RegExp(`\\b${escapeRegExp(item.surfaceForm)}\\b`, "i"), "_____");

  return (
    <div className="space-y-3">
      {item.kind === "lyrics-gap" ? (
        <p className="text-lg italic" data-lyrics-body>
          {gapLine}
        </p>
      ) : (
        <p className="text-lg italic" data-lyrics-body>
          {item.line}
        </p>
      )}

      {item.kind === "reappearance" && item.otherLine && (
        <p className="text-lg italic text-muted-foreground" data-lyrics-body>
          {item.otherLine}
        </p>
      )}

      {item.kind === "confusable-choice" && item.options && !revealed && (
        <p className="text-muted-foreground">{item.options.join(" · ")}</p>
      )}

      {revealed && (
        <div className="rounded-lg border-l-4 border-context bg-secondary/40 p-4">
          <p>{item.answer}</p>
          {item.kind === "synonym-fits" && item.verdict && (
            <p className="mt-1 text-sm text-muted-foreground">
              veredito certo: {VERDICT_BUTTON[item.verdict]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

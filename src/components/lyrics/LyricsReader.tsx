import { memo, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WordCardPanel } from "@/components/card/WordCardPanel";
import {
  enqueueCard,
  findWordByHeadword,
  getCard,
  getLevel,
  getSong,
  getTouchMode,
  saveSense,
  saveWord,
} from "@/lib/db/repo";
import { isWordToken, tokenize } from "@/lib/words/tokenize";
import { lemma } from "@/lib/words/lemma";
import type { Card as StoredCard, Song, TouchMode, Word } from "@/lib/types";

const NO_MARKS: Set<string> = new Set();

/**
 * One lyric line. Memoized because a full song is thousands of tappable tokens
 * and a tap must repaint only the line it landed on, not the whole lyric.
 */
const LyricLine = memo(function LyricLine({
  line,
  stanzaIndex,
  lineIndex,
  marked,
  onMark,
}: {
  line: string;
  stanzaIndex: number;
  lineIndex: number;
  marked: Set<string>;
  onMark: (surface: string, line: string, stanzaIndex: number, lineIndex: number) => void;
}) {
  return (
    <p className="lyrics-line">
      {tokenize(line).map((token, i) =>
        isWordToken(token) ? (
          <button
            key={i}
            type="button"
            onClick={() => onMark(token, line, stanzaIndex, lineIndex)}
            className={
              marked.has(token) ? "word-marked rounded px-0.5" : "rounded px-0.5 hover:bg-secondary"
            }
          >
            {token}
          </button>
        ) : (
          <span key={i}>{token}</span>
        ),
      )}
    </p>
  );
});

/**
 * The reading screen (F2). Words are tappable and a tap records the word *and*
 * the exact line it came from, because the line is what gets studied later
 * (PRD D4).
 *
 * The persisted touch mode decides what a tap does: `collect` only notes the
 * word and never interrupts the reading, `card` also opens what is already
 * known about it. Neither mode generates a card synchronously — that is the
 * queue's job (PRD D8).
 */
export function LyricsReader({ songId }: { songId: string }) {
  const [song, setSong] = useState<Song | undefined | null>(null);
  const [touchMode, setTouchModeState] = useState<TouchMode>("collect");
  const [markedLines, setMarkedLines] = useState<Map<string, Set<string>>>(new Map());
  const [collected, setCollected] = useState<Map<string, boolean>>(new Map());
  const [panel, setPanel] = useState<{ word: Word; card: StoredCard | undefined } | null>(null);
  const touchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    setSong(null);
    setMarkedLines(new Map());
    setCollected(new Map());
    setPanel(null);
    touchedRef.current = new Set();
    void Promise.all([getSong(songId), getTouchMode()]).then(([row, mode]) => {
      if (!alive) return;
      setSong(row ?? undefined);
      setTouchModeState(mode);
    });
    return () => {
      alive = false;
    };
  }, [songId]);

  const persistMark = useCallback(
    async (surface: string, line: string, stanzaIndex: number, lineIndex: number) => {
      const language = song!.language;
      const headword = lemma(surface, language);
      const existing = await findWordByHeadword(headword);
      const now = Date.now();

      const word: Word = existing
        ? { ...existing, lastSeenAt: now, surfaceForm: surface }
        : await saveWord({
            headword,
            surfaceForm: surface,
            language,
            level: await getLevel(),
            stage: "new",
            status: "active",
            favorite: false,
            firstSeenAt: now,
            lastSeenAt: now,
          });

      await saveSense({
        wordId: word.id,
        songId: song!.id,
        headword,
        surfaceForm: surface,
        line,
        stanzaIndex,
        lineIndex,
        createdAt: now,
      });

      // Queue only: generation happens in the background, never inside the tap.
      await enqueueCard(word.id);

      const card = await getCard(word.id);
      setCollected((prev) => new Map(prev).set(word.id, card !== undefined));
      if (touchMode === "card") setPanel({ word, card });
    },
    [song, touchMode],
  );

  /**
   * The mark is painted before anything is written — reading must never wait on
   * storage. Persistence follows in the background.
   */
  const markWord = useCallback(
    (surface: string, line: string, stanzaIndex: number, lineIndex: number) => {
      const key = `${stanzaIndex}:${lineIndex}:${surface}`;
      if (touchedRef.current.has(key)) {
        // Tocar numa palavra já marcada abre o que se sabe dela (PRD: vale
        // nos dois modos) — sem remarcar nem reenfileirar.
        void (async () => {
          const word = await findWordByHeadword(lemma(surface, song!.language));
          if (!word) return;
          const card = await getCard(word.id);
          setPanel({ word, card });
        })();
        return;
      }
      touchedRef.current.add(key);

      const lineKey = `${stanzaIndex}:${lineIndex}`;
      setMarkedLines((prev) => {
        const next = new Map(prev);
        const marks = new Set(next.get(lineKey) ?? NO_MARKS);
        marks.add(surface);
        next.set(lineKey, marks);
        return next;
      });

      void persistMark(surface, line, stanzaIndex, lineIndex);
    },
    [persistMark],
  );

  if (song === null) {
    return <p className="text-muted-foreground">Abrindo a música…</p>;
  }

  if (song === undefined) {
    return (
      <Card>
        <CardContent className="p-6">
          <p>Essa música não está mais guardada neste aparelho.</p>
        </CardContent>
      </Card>
    );
  }

  const stanzas = song.lyrics.split(/\n\s*\n/).filter((stanza) => stanza.trim().length > 0);
  const collectedCount = collected.size;
  const readyCount = [...collected.values()].filter(Boolean).length;

  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-display text-3xl">{song.title}</h1>
        <p className="text-muted-foreground">{song.artist}</p>
        <p className="text-sm text-muted-foreground">
          {touchMode === "collect"
            ? "Tocar numa palavra só anota. A leitura não para."
            : "Tocar numa palavra abre o que já se sabe dela."}
        </p>
      </header>

      <div className="space-y-6" data-lyrics-body>
        {stanzas.map((stanza, stanzaIndex) => (
          <div key={stanzaIndex} className="space-y-1">
            {stanza.split("\n").map((line, lineIndex) => (
              <LyricLine
                key={lineIndex}
                line={line}
                stanzaIndex={stanzaIndex}
                lineIndex={lineIndex}
                marked={markedLines.get(`${stanzaIndex}:${lineIndex}`) ?? NO_MARKS}
                onMark={markWord}
              />
            ))}
          </div>
        ))}
      </div>

      {panel && (
        <WordCardPanel
          word={panel.word}
          card={panel.card}
          open
          onOpenChange={(open) => {
            if (!open) setPanel(null);
          }}
        />
      )}

      <footer className="space-y-3 border-t border-border pt-4">
        {collectedCount > 0 && (
          <p>
            Você coletou {collectedCount} palavra{collectedCount === 1 ? "" : "s"} aqui
            {readyCount > 0 ? ` · ${readyCount} pronta${readyCount === 1 ? "" : "s"}` : ""}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <a href={song.sourceUrl} target="_blank" rel="noreferrer">
              Ver no {sourceName(song.sourceUrl)}
            </a>
          </Button>
          <span className="text-sm text-muted-foreground">
            A letra vem do {sourceName(song.sourceUrl)}, palavra por palavra.
          </span>
        </div>
      </footer>
    </article>
  );
}

function sourceName(url: string): string {
  if (url.includes("vagalume")) return "Vagalume";
  try {
    return new URL(url).hostname;
  } catch {
    return "site de origem";
  }
}

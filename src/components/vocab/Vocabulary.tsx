import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  listActiveWords,
  listAllSenses,
  listDifficultWordIds,
  listSongs,
} from "@/lib/db/repo";
import { cn } from "@/lib/utils";
import type { Sense, Song, Word, WordStage } from "@/lib/types";

const STAGES: readonly WordStage[] = ["new", "learning", "mastered"];

const STAGE_LABEL: Record<WordStage, string> = {
  new: "novas",
  learning: "aprendendo",
  mastered: "vencidas",
};

type Axis = "all" | "favorites" | "difficult" | "recent" | "by-song" | "by-stage";

const AXES: readonly { id: Axis; label: string }[] = [
  { id: "all", label: "todas" },
  { id: "favorites", label: "favoritas" },
  { id: "difficult", label: "difíceis" },
  { id: "recent", label: "recém-coletadas" },
  { id: "by-song", label: "por música" },
  { id: "by-stage", label: "por estágio" },
];

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The vocabulary area — the center of the app (F5). Every marked word is
 * here, organizable by the axes the planning asks for: favorites, difficult
 * (missed in practice), recently collected, by song of origin, by learning
 * stage. The count on each entry is how many times the word appeared across
 * the user's songs.
 */
export function Vocabulary() {
  const [words, setWords] = useState<Word[] | null>(null);
  const [senses, setSenses] = useState<Sense[]>([]);
  const [songs, setSongs] = useState<Map<string, Song>>(new Map());
  const [difficult, setDifficult] = useState<Set<string>>(new Set());
  const [axis, setAxis] = useState<Axis>("all");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [wordRows, senseRows, songRows, difficultIds] = await Promise.all([
        listActiveWords(),
        listAllSenses(),
        listSongs(),
        listDifficultWordIds(),
      ]);
      if (!alive) return;
      setWords(wordRows);
      setSenses(senseRows);
      setSongs(new Map(songRows.map((song) => [song.id, song])));
      setDifficult(difficultIds);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** How many lines of how many songs each word appeared in. */
  const frequency = useMemo(() => {
    const map = new Map<string, number>();
    for (const sense of senses) {
      map.set(sense.wordId, (map.get(sense.wordId) ?? 0) + 1);
    }
    return map;
  }, [senses]);

  const shown = useMemo(() => {
    if (words === null) return null;
    let rows = words;
    if (axis === "favorites") rows = rows.filter((w) => w.favorite);
    if (axis === "difficult") rows = rows.filter((w) => difficult.has(w.id));
    if (axis === "recent") {
      const since = Date.now() - RECENT_WINDOW_MS;
      rows = rows.filter((w) => w.firstSeenAt >= since);
    }
    const needle = filter.trim().toLowerCase();
    if (needle.length > 0) {
      rows = rows.filter(
        (w) =>
          w.headword.toLowerCase().includes(needle) ||
          w.surfaceForm.toLowerCase().includes(needle),
      );
    }
    return rows;
  }, [words, axis, difficult, filter]);

  const bySong = useMemo(() => {
    if (shown === null || axis !== "by-song") return null;
    const groups = new Map<string, Word[]>();
    const wordIds = new Set(shown.map((w) => w.id));
    for (const sense of senses) {
      if (!wordIds.has(sense.wordId)) continue;
      const word = shown.find((w) => w.id === sense.wordId);
      if (!word) continue;
      const list = groups.get(sense.songId) ?? [];
      if (!list.includes(word)) list.push(word);
      groups.set(sense.songId, list);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [shown, senses, axis]);

  const byStage = useMemo(() => {
    if (shown === null || axis !== "by-stage") return null;
    return STAGES.map((stage) => ({
      stage,
      rows: shown.filter((w) => w.stage === stage),
    })).filter((group) => group.rows.length > 0);
  }, [shown, axis]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-display text-3xl">Vocabulário</h1>
        <p className="text-muted-foreground">
          {words === null
            ? "Lendo suas palavras…"
            : words.length === 0
              ? "Você ainda não marcou nenhuma palavra. Abra uma música e toque numa que não conhece."
              : `${words.length} palavra${words.length === 1 ? "" : "s"} que você encontrou nas músicas.`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {AXES.map((a) => (
          <Chip key={a.id} active={axis === a.id} onClick={() => setAxis(a.id)} label={a.label} />
        ))}
      </div>

      {words !== null && words.length > 0 && (
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="procurar no vocabulário"
          aria-label="Procurar no vocabulário"
          className="max-w-sm"
        />
      )}

      {shown !== null && shown.length === 0 && words !== null && words.length > 0 && (
        <p className="text-muted-foreground">Nenhuma palavra nessa visão.</p>
      )}

      {shown !== null && axis !== "by-song" && axis !== "by-stage" && (
        <WordList words={shown} frequency={frequency} />
      )}

      {bySong && (
        <div className="space-y-5">
          {bySong.map(([songId, rows]) => (
            <section key={songId} className="space-y-2">
              <h2 className="text-sm text-muted-foreground">
                {songs.get(songId)
                  ? `${songs.get(songId)!.title} — ${songs.get(songId)!.artist}`
                  : "música não guardada"}
              </h2>
              <WordList words={rows} frequency={frequency} />
            </section>
          ))}
        </div>
      )}

      {byStage && (
        <div className="space-y-5">
          {byStage.map((group) => (
            <section key={group.stage} className="space-y-2">
              <h2 className="text-sm text-muted-foreground">{STAGE_LABEL[group.stage]}</h2>
              <WordList words={group.rows} frequency={frequency} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function WordList({ words, frequency }: { words: Word[]; frequency: Map<string, number> }) {
  if (words.length === 0) return null;
  return (
    <ul className="grid gap-2">
      {words.map((word) => (
        <li key={word.id}>
          <Link to="/vocab/$headword" params={{ headword: word.headword }}>
            <Card className="transition-colors hover:bg-secondary/50">
              <CardContent className="flex items-center gap-3 p-3">
                <span className="text-lg">{word.surfaceForm}</span>
                {word.surfaceForm !== word.headword && (
                  <span className="text-sm text-muted-foreground">→ {word.headword}</span>
                )}
                <span className="ml-auto flex items-center gap-2">
                  {(frequency.get(word.id) ?? 0) > 1 && (
                    <span className="text-xs text-muted-foreground">
                      {frequency.get(word.id)}× nas suas músicas
                    </span>
                  )}
                  <Badge variant="secondary">{STAGE_LABEL[word.stage]}</Badge>
                  {word.favorite && <span aria-label="favorita">★</span>}
                </span>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-primary bg-secondary text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

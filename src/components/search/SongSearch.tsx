import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listSongs, saveSong } from "@/lib/db/repo";
import { decideSearch } from "@/lib/songs/decision";
import { collectSong, searchByText } from "@/lib/songs/songs.functions";
import { detectLanguage } from "@/lib/words/language";
import type { Candidate, Song } from "@/lib/types";

/**
 * The search entry (F1 owns the AI interpretation). The user types the song
 * the way they remember it; the app resolves it against the lyrics source and
 * shows what it actually found before collecting anything.
 */
export function SongSearch() {
  const navigate = useNavigate();
  const runSearch = useServerFn(searchByText);
  const runCollect = useServerFn(collectSong);

  const [query, setQuery] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "searching" }
    | { kind: "results"; candidates: Candidate[] }
    | { kind: "none" }
    | { kind: "collecting"; candidate: Candidate }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [recent, setRecent] = useState<Song[]>([]);

  useEffect(() => {
    let alive = true;
    void listSongs().then((rows) => {
      if (alive) setRecent(rows.slice(0, 5));
    });
    return () => {
      alive = false;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length === 0) return;

    setState({ kind: "searching" });
    try {
      const candidates = await runSearch({ data: { query: trimmed } });
      const decision = decideSearch(candidates);
      if (decision.kind === "auto") {
        // Confiança alta: vai direto para a letra, sem lista intermediária.
        await choose(decision.candidate);
      } else if (decision.kind === "choose") {
        setState({ kind: "results", candidates: decision.candidates });
      } else {
        setState({ kind: "none" });
      }
    } catch {
      setState({ kind: "error", message: "A busca não conseguiu responder agora." });
    }
  }

  async function choose(candidate: Candidate) {
    setState({ kind: "collecting", candidate });
    try {
      const resolved = await runCollect({ data: { url: candidate.url } });
      if (resolved.status !== "ok" || !resolved.lyrics || !resolved.sourceUrl) {
        setState({ kind: "error", message: "Essa página não tem a letra completa." });
        return;
      }

      const song = await saveSong({
        artist: candidate.artist,
        title: candidate.title,
        sourceUrl: resolved.sourceUrl,
        lyrics: resolved.lyrics,
        language: detectLanguage(resolved.lyrics),
        addedAt: Date.now(),
      });

      toast.success(`"${song.title}" pronta para ler`);
      await navigate({ to: "/song/$id", params: { id: song.id } });
    } catch {
      setState({ kind: "error", message: "Não foi possível trazer a letra agora." });
    }
  }

  const busyUrl = state.kind === "collecting" ? state.candidate.url : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-3xl">Que música é essa?</h1>
        <p className="text-muted-foreground">
          Escreva música e cantor do jeito que você lembra. Não precisa acertar o nome.
        </p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="queen bohemian rhapsody"
          aria-label="Música e cantor"
          className="h-12 text-base"
        />
        <Button type="submit" size="lg" disabled={state.kind === "searching"}>
          Buscar
        </Button>
      </form>

      {state.kind === "searching" && <p className="text-muted-foreground">Procurando…</p>}

      {state.kind === "none" && (
        <Card>
          <CardContent className="p-5">
            <p>Não achei essa música.</p>
            <p className="text-sm text-muted-foreground">
              Tente escrever o cantor primeiro, ou parte do título que você tem certeza.
            </p>
          </CardContent>
        </Card>
      )}

      {state.kind === "error" && (
        <Card>
          <CardContent className="p-5">
            <p className="text-destructive">{state.message}</p>
          </CardContent>
        </Card>
      )}

      {state.kind === "results" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Era essa?</p>
          <ul className="grid gap-2">
            {state.candidates.map((candidate) => {
            const busy = busyUrl === candidate.url;
            return (
              <li key={candidate.url}>
                <Card>
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{candidate.title}</div>
                      <div className="truncate text-sm text-muted-foreground">
                        {candidate.artist} · {candidate.reason}
                      </div>
                    </div>
                    <Button
                      className="ml-auto shrink-0"
                      size="sm"
                      disabled={busyUrl !== null}
                      onClick={() => void choose(candidate)}
                    >
                      {busy ? "Trazendo…" : "Ler"}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
          </ul>
        </div>
      )}

      {recent.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Suas músicas</div>
          <ul className="grid gap-2">
            {recent.map((song) => (
              <li key={song.id}>
                <Button
                  variant="ghost"
                  className="w-full justify-start truncate px-3"
                  onClick={() => void navigate({ to: "/song/$id", params: { id: song.id } })}
                >
                  {song.title} — {song.artist}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

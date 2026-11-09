import { Book, Check, CircleDot, Quote, X } from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { Card as StoredCard, Verdict, Word } from "@/lib/types";

/**
 * The word card as a bottom sheet (F3). It slides up over the lower part of
 * the screen and never covers the whole lyric, so the line being read stays
 * visible above it.
 *
 * Three layers, each with its own color token and icon (PRD D14):
 *   literal   — Book, cool neutral, the secondary layer;
 *   inContext — Quote, warm ochre, the hero of the card;
 *   insteadOf — verdict ✗/✓/◐ with one line of reason.
 *
 * While the card is still in the generation queue the panel opens with a
 * skeleton and fills in when the card arrives; a generation failure keeps the
 * word visible instead of pretending nothing happened.
 */

const VERDICT_STYLE: Record<
  Verdict,
  { label: string; textClass: string; borderClass: string; Icon: typeof Check }
> = {
  wrong: {
    label: "não cabe aqui",
    textClass: "text-verdict-wrong",
    borderClass: "border-verdict-wrong",
    Icon: X,
  },
  right: {
    label: "cabe aqui",
    textClass: "text-verdict-right",
    borderClass: "border-verdict-right",
    Icon: Check,
  },
  mcnc: {
    label: "certo, mas menos cabível",
    textClass: "text-verdict-mcnc",
    borderClass: "border-verdict-mcnc",
    Icon: CircleDot,
  },
};

export function WordCardPanel({
  word,
  card,
  failed,
  open,
  onOpenChange,
}: {
  word: Word;
  card: StoredCard | undefined;
  /** True when the queue gave up on this word — the word stays visible. */
  failed?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[72vh] w-full max-w-2xl">
        <DrawerHeader>
          <DrawerTitle className="text-display text-2xl">{word.surfaceForm}</DrawerTitle>
          <DrawerDescription>
            {word.headword !== word.surfaceForm
              ? `forma de dicionário: ${word.headword}`
              : "palavra do seu vocabulário"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-3 overflow-y-auto px-4 pb-6">
          {card ? (
            <CardBody card={card} />
          ) : failed ? (
            <p className="rounded-lg border border-border bg-secondary/20 p-4 text-sm">
              Não consegui gerar o card de "{word.headword}" agora. A palavra continua
              guardada no seu vocabulário e a geração tenta de novo mais tarde.
            </p>
          ) : (
            <CardSkeleton />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function CardBody({ card }: { card: StoredCard }) {
  const verdict = VERDICT_STYLE[card.card.insteadOf.verdict];
  const VerdictIcon = verdict.Icon;

  return (
    <>
      <div className="rounded-lg border-l-4 border-context bg-secondary/40 p-4">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-context">
          <Quote className="size-3.5" aria-hidden />
          nesta frase
        </div>
        <p className="mt-1 text-lg">{card.card.inContext}</p>
      </div>

      <div className="rounded-lg border-l-4 border-literal bg-secondary/20 p-4">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-literal">
          <Book className="size-3.5" aria-hidden />
          sentido literal
        </div>
        <p className="mt-1">{card.card.literal}</p>
      </div>

      <div className={`rounded-lg border-l-4 bg-secondary/20 p-4 ${verdict.borderClass}`}>
        <div
          className={`flex items-center gap-1.5 text-xs uppercase tracking-wide ${verdict.textClass}`}
        >
          <VerdictIcon className="size-3.5" aria-hidden />
          em vez de "{card.card.insteadOf.word}" — {verdict.label}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{card.card.insteadOf.reason}</p>
      </div>
    </>
  );
}

/** The progressive-fill skeleton: the panel opens instantly and fills in. */
function CardSkeleton() {
  return (
    <div className="space-y-3" aria-label="gerando o card">
      <div className="rounded-lg border-l-4 border-context bg-secondary/40 p-4">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-5 w-3/4 animate-pulse rounded bg-muted" />
      </div>
      <div className="rounded-lg border-l-4 border-literal bg-secondary/20 p-4">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
      <div className="rounded-lg border-l-4 border-verdict-mcnc bg-secondary/20 p-4">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      <p className="text-sm text-muted-foreground">Gerando o card desta palavra…</p>
    </div>
  );
}

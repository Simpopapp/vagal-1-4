import { createFileRoute } from "@tanstack/react-router";

import { PracticeSession } from "@/components/practice/PracticeSession";

export const Route = createFileRoute("/practice")({
  head: () => ({
    meta: [
      { title: "Praticar — Letra e Palavra" },
      {
        name: "description",
        content:
          "A sessão de hoje: o que está vencido, o que você errou e o que está perto de vencer — sem contar nada que ainda não é hora.",
      },
      { property: "og:title", content: "Praticar — Letra e Palavra" },
      {
        property: "og:description",
        content:
          "Revisão espaçada com a frase da música: você responde, confere, e o que você errou volta amanhã.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PracticePage,
});

function PracticePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <PracticeSession />
    </div>
  );
}

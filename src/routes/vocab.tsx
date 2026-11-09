import { createFileRoute } from "@tanstack/react-router";

import { Vocabulary } from "@/components/vocab/Vocabulary";

export const Route = createFileRoute("/vocab")({
  head: () => ({
    meta: [
      { title: "Vocabulário — Letra e Palavra" },
      {
        name: "description",
        content:
          "Cada palavra que você marcou, organizada por música, categoria, frequência e estágio de aprendizado — com o card completo e a frase de origem.",
      },
      { property: "og:title", content: "Vocabulário — Letra e Palavra" },
      {
        property: "og:description",
        content:
          "A área central do app: o que você já encontrou nas músicas, pronto para ser estudado de verdade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VocabularyPage,
});

function VocabularyPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <Vocabulary />
    </div>
  );
}

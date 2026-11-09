import { createFileRoute } from "@tanstack/react-router";

import { WordDossier } from "@/components/vocab/WordDossier";

export const Route = createFileRoute("/vocab/$headword")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.headword} — vocabulário — Letra e Palavra` },
      {
        name: "description",
        content: `O dossiê completo de "${params.headword}": o significado literal, o que quer dizer na sua frase, combinações frequentes e as parecidas que confundem.`,
      },
      { property: "og:title", content: `${params.headword} — Letra e Palavra` },
      {
        property: "og:description",
        content:
          "Não só a tradução: o sentido no contexto, as combinações que a palavra costuma ter e o que evitar.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WordDossierPage,
});

function WordDossierPage() {
  const { headword } = Route.useParams();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <WordDossier headword={headword} />
    </div>
  );
}

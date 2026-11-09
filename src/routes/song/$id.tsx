import { createFileRoute } from "@tanstack/react-router";

import { LyricsReader } from "@/components/lyrics/LyricsReader";

export const Route = createFileRoute("/song/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Ler a música — Letra e Palavra" },
      {
        name: "description",
        content:
          "A letra completa, com as estrofes no lugar certo. Toque em qualquer palavra que não conhece para anotar no seu vocabulário.",
      },
      { property: "og:title", content: "Ler a música — Letra e Palavra" },
      {
        property: "og:description",
        content: "Leia a letra inteira e anote as palavras que não conhece, direto na frase.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SongPage,
});

function SongPage() {
  const { id } = Route.useParams();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <LyricsReader songId={id} />
    </div>
  );
}

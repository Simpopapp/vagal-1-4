import { createFileRoute } from "@tanstack/react-router";

import { SongSearch } from "@/components/search/SongSearch";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Buscar música — Letra e Palavra" },
      {
        name: "description",
        content:
          "Digite música e cantor do jeito que vier — a busca entende, acha a letra completa e você começa a marcar as palavras que não conhece.",
      },
      { property: "og:title", content: "Buscar música — Letra e Palavra" },
      {
        property: "og:description",
        content:
          "Escreva como você lembraria da música, sem acertar o nome. A busca interpreta, procura e confirma com você.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <SongSearch />
    </div>
  );
}

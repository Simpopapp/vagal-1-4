# Roadmap — project1 (app de estudo de idiomas por letras de música)

Executar em ordem de dependência. Só avança com a linha de Gates verde.
Marcar `[x]` somente com números reais.

## F0 — Fundação
- [x] shell do app + rotas reais (`/`, `/vocab`, `/vocab/$headword`, `/practice`, `/settings`, `/song/$id`) sem placeholder
- [x] tokens de design (3 cores de tradução + vereditos) e fontes via `<link>` no `__root`
- [x] wrapper IndexedDB: stores `songs, words, senses, cards, dossiers, reviews, queue, settings`
- [x] types centrais (`Interpretation`, `Candidate`, `Resolved`, `WordCard`, `Dossier`)
- Gates: typecheck `tsgo -b --noEmit` exit 0 · `app-routing.test.tsx` verde · wrapper 13 testes verdes · 0 cores hardcoded nos componentes do app (4 ocorrências só em primitivos shadcn gerados em `src/components/ui`)

## F1 — Achar a música
- [x] `vagalume.server.ts`: `suggest` / `artistSongLinks` (exclui `-traducao`) / `extractLyrics` (atributos variáveis + recusa quando não há bloco)
- [x] pipeline artista→lista→fuzzy (`resolveCandidates`) + `searchByText` com splits artista/título
- [ ] `interpret.ts`: IA `gpt-6-astra` + `Interpretation` validada — **bloqueado: workspace sem créditos (402 `payment_required`, confirmado por probe em 2026-11-09)**
- [x] limiares 0.85 / 0.55 na UI (`src/lib/songs/decision.ts` + `SongSearch`): >=0.85 auto-aceita, 0.55–0.85 mostra "era essa?" (máx 3), <0.55 pede mais info
- [x] UI de busca: resultados com motivo do match, vazio honesto no `none`, erro real no fracasso
- [x] fallbacks do PRD 3.2.5 no `resolveCandidates` (título sozinho + prefixos progressivos + artista) — caso `quen / bohemian rapsody` passou a resolver
- Gates: 11 testes de fonte verdes · 8 testes de decisão verdes · 7 casos E14 ao vivo verdes (`RUN_LIVE=1`, 2026-11-09): `bohemian rapsody quen`→Queen, `let it be beatles`→Beatles, `the thunder roll`→Garth Brooks, Legião com/sem acento, inventada→`none`, Jimmy Clay nunca auto-aceito

## F2 — Ler e marcar (dois modos)
- [x] render por estrofe, palavra tocável, tokenização sem quebrar apóstrofo/hífen/`feat.`
- [x] modo card (abre na hora) e modo coleta (só marca, sem delay), switch persistido
- [x] resumo ao fim da música ("coletou N, M prontas")
- Gates: 28 testes de tokenização verdes · coleta não dispara geração síncrona (só `enqueueCard`, nenhuma chamada de IA) · marcação dentro de um frame (5.8–18.8 ms medidos, resolução da medição = 1 frame de 16.7 ms) · 0 erros de console

## F3 — Card da palavra
- [x] `card.ts` + `schemas.ts`: `WordCard` com literal / na frase / ao invés de + veredito ✗✓◐ (zod valida antes da tela; server fn `generateCard` devolve resultado tipado)
- [x] painel deslizante (`vaul`) com esqueleto e preenchimento progressivo (`WordCardPanel`, max 72vh, não cobre a letra)
- [x] tokens de cor e ícone para as três camadas (Book/Quote/✗✓◐; corrigido `border-verdict` inexistente no dossiê)
- Gates: `verdict` sempre um dos três (schema zod) · card inválido → falha com palavra preservada (estado `failed` no painel) · geração real de 10 palavras **bloqueada por créditos de IA**

## F4 — Fila em segundo plano
- [x] fila durável no IndexedDB, sobrevive a reload e offline, backoff 2^n (30s base, máx 5 tentativas), idempotente (`src/lib/queue/worker.ts`)
- [x] indicador "N prontas · M na fila" no shell (`QueueIndicator`), worker inicia com a página
- [x] pausa global quando a IA está sem créditos (fila preservada, sem queimar tentativas)
- Gates: 8 testes do worker verdes (12 cards, idempotência, reload, backoff, pausa por créditos) · geração real depende de créditos de IA

## F5 — Vocabulário
- [x] listas por música, frequência (N× nas suas músicas) e estágio · Favoritas / Difíceis (erros na prática) / Recém-coletadas (7 dias) + busca textual
- [ ] dossiê sob demanda validado por schema — schema pronto (`dossierSchema`), geração **bloqueada por créditos de IA**
- Gates: eixos implementados na UI · categoria gramatical depende de dados de IA · virtualização de 500 palavras pendente

## F6 — Prática
- [x] SRS próprio: `src/lib/srs/scheduler.ts` puro (gap, lapse, ângulo) sem storage nem relógio próprio
- [x] itens na tela: "significado nesse contexto" · "esse sinônimo cabe aqui?" (corrigido pelo veredito) · lacuna na letra · parecidas confundidas (com dossiê)
- [x] reaparição conta como revisão (só com 2+ músicas; mostra as duas frases)
- [x] sessão completa: `src/lib/srs/session.ts` (builder puro) + `PracticeSession` interativa (revelar → acertei/errei → `planReview` → estágio)
- Gates: 13 testes do scheduler verdes · 7 testes de sessão verdes (vencida entra, não-vencida não, ângulo nunca repete, veredito corrige synonym-fits)

## F7 — Offline, sync e conta
- [x] service worker (`public/sw.js`: navegação network-first com fallback, assets/fontes cache-first, `/~oauth` e `/api` fora do cache)
- [x] migrations `public` com `GRANT` + RLS por `auth.uid()` — 7 tabelas, 4 políticas cada, conferidas por query
- [x] auth email (`enable_email_auth`) + Google + Lovable · sync idempotente (`src/lib/db/sync.ts`: upsert por `source_url`/`headword`/id estável)
- Gates: RLS/GRANT conferidos por query · fluxo real no browser verde (busca→letra→5 palavras→vocabulário→prática, 0 erros de console) · login social configurado (teste real de OAuth depende de interação do usuário)

## Fechamento
- [ ] gates globais da seção 9 do PRD (vitest, build, fluxo real no browser, offline, anti-invenção, sem cor hardcoded, `head()` por rota)
- [ ] checagem de 5 min / 10 tentativas nos arquivos novos

**Próximo remix:** todo o não-IA está feito (F0–F2, F4, F6, F7 completos; F3/F5 com UI e schemas prontos). Resta só o que depende de créditos de IA (402 `payment_required` confirmado em 2026-11-09): F1 `interpret.ts` (interpretação da busca por IA), geração real de cards (a fila, o painel e o worker já estão prontos e testados — basta os créditos voltarem), dossiê sob demanda, e pré-marcação de palavras na letra.


Próximo remix: itens dependentes de IA ficam `[~] pendente-IA` e não bloqueiam; seguir para project2 (criar PRD e roadmap a partir de project2.md).

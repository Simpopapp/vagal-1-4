# PRD — app de estudo de idiomas por letras de música

O **COMO** do `project1`. Derivado do planejamento, confirmado no código e na rede
antes de ser escrito. Nada aqui é suposição: as seções 0 e 1 registram o que foi
verificado nesta sandbox, e as fases (seção 6) só usam o que existe no ambiente.

Precedência: no **escopo**, `project1` > este arquivo > `roadmap-proj1`.
No **como**, este arquivo manda.

---

## 0. Base de evidência (verificado, não assumido)

| # | Verificação | Resultado |
|---|---|---|
| E1 | `src/integrations/` antes deste remix | inexistente — nenhum backend conectado |
| E2 | Lovable Cloud | **habilitado** nesta sessão; `attachSupabaseAuth` registrado em `functionMiddleware` de `src/start.ts` |
| E3 | `@lovable.dev/ai-gateway` | instalado `0.1.11`; `package.json` confirma; `listModels()` → `workspace_models: "included"`, 66 modelos |
| E4 | `openai/gpt-6-astra` | disponível, superfícies `chat-completions` + `responses`, `data_retention: "zero"` |
| E5 | API pública do Vagalume (`/api/search/`, `/api/lyrics/`, `/api/artist/`) | **morta** — todas `404` |
| E6 | `https://suggest.vagalume.com.br/json?q=` | **viva** — `200`, JSON `response.docs[]` |
| E7 | Docs do suggest: música tem `title`+`band`+`url`; artista tem `url` terminado em `/` e **sem** `title` | confirma por inspeção |
| E8 | Suggest é **prefixo** e **trava em 10 docs** | `q="let it be"` → 10 docs, **0 músicas**; `q="hello"` → 0 músicas; `q="bohemian rhapsody"` → 10 músicas |
| E9 | Consequência de E8 | suggest **serve para artista**, **não serve para título** |
| E10 | Página de artista `https://www.vagalume.com.br/queen/` | `200`, embute a lista completa: **756** links `/<artist>/<song>.html` |
| E11 | Tradução polui a lista | links `*-traducao.html` presentes e **precisam ser excluídos** |
| E12 | Container da letra | `<div id=lyrics>` em Queen, `<div id=lyrics data-plugin=googleTranslate>` em Legião Urbana — **atributos variam**, regex que exige `>` após `lyrics` falha em silêncio |
| E13 | Estrutura interna | `<br>` = quebra de verso, `<br><br>` = estrofe |
| E14 | Pipeline artista→lista→fuzzy (seção 3) | 7/8 casos difíceis corretos; `The Thunder Roll` → `the-thunder-rolls.html` (r=0.97, plural errado na fonte); `I'm Flying / Jimmy Clay` → **r=0.56 errado** (artist resolveu `/clay/`) |
| E15 | Vitest configurado | `vitest.config.ts` + `src/test/setup.ts` + `src/test/app-routing.test.tsx` existem |
| E16 | PWA/service worker | **não existe** — offline é construção, não herança |
| E17 | `src/routes/index.tsx` | placeholder `data-lovable-blank-page-placeholder` — precisa ser substituído |

E14 é o fato mais importante do PRD: o pipeline funciona, mas **falha em silêncio**
sem limiar de confiança. Todo o desenho de resolução (seção 3) existe por causa dele.

---

## 1. Decisões técnicas

Numeradas. Uma decisão por linha de raciocínio. Mudanças posteriores entram na
seção 12, nunca reescrevem estas.

**D1 — Local-first, não server-first.**
O planejamento exige leitura e vocabulário offline (E16: nada disso existe hoje).
A fonte de verdade da interface é **IndexedDB**; Lovable Cloud é **sincronização**,
não pré-requisito de uso. O app tem que funcionar sem conta. Consequência: nenhuma
tela depende de sessão para abrir; a sessão só liga o sync.

**D2 — Vagalume é a única fonte de letra, e a IA nunca escreve letra.**
A IA interpreta, procura e escolhe. O texto exibido é sempre o que a fonte devolveu
(seção 4.4 tem a checagem que torna isso estrutural, não uma instrução de prompt).

**D3 — Resolução em duas etapas, artista primeiro.**
Por E8/E9, tentar adivinhar o slug do título é o caminho frágil. O caminho robusto:
IA extrai `title`+`artist` → suggest resolve o **artista** (confiável) → a página do
artista dá a **lista real de títulos** → fuzzy match do título contra a lista.
O slug nunca é adivinhado: vem da fonte.

**D4 — Limiar de confiança é parte do produto, não detalhe técnico.**
E14 mostrou uma entrega errada com aparência de sucesso. Sem limiar, o app ensina a
música errada. Bar: `>= 0.85` auto-aceita; `0.55–0.85` mostra 2–3 cards "era essa?";
`< 0.55` pede mais informação. Nunca mostra letra com score baixo.

**D5 — `openai/gpt-6-astra` na superfície `responses`, com `response_format` JSON.**
E3/E4: disponível no workspace, retenção zero. É o default de chat/texto. Saída
estruturada é obrigatória (o card tem veredito ✗/✓/◐ que entra em revisão espaçada —
lixo aqui envenena o estudo para sempre).

**D6 — Validador antes da tela.**
Toda saída de IA passa por `zod` no servidor **antes** de chegar ao cliente. Se o
JSON não vale, a chamada falha e o usuário vê "não consegui" com a palavra preservada.
Nada de renderizar parcial não validado.

**D7 — Identidade da palavra é o lema, não a forma superficial.**
O planejamento diz que a mesma palavra em outra música deve se ligar à existente, e
que a mesma palavra com outro sentido não se duplica. Então a chave do vocabulário é
`headword` = lema normalizado (`flying` → `fly`, `went` → `go`), e o sentido fica
numa tabela separada por música/frase. Sem isso, o vocabulário vira lista suja.

**D8 — Fila de geração é explícita e durável.**
No modo coleta o toque não pode esperar IA. A marcação grava no IndexedDB e **engata
uma tarefa**; a fila sobrevive a recarregar a página e a ficar offline (E16). Um
indicador discreto mostra "7 de 12 prontas".

**D9 — Dossiê é sob demanda, card é imediato.**
O card responde ao toque; o dossiê (usos, combinações, registro, falsos cognatos) é
gerado quando a palavra é aberta ou em segundo plano ocioso. Controla custo de IA e
mantém o toque instantâneo.

**D10 — Revisão espaçada própria, sem biblioteca.**
A lógica é pequena e precisa ser testável contra as regras do planejamento (errar
mais ⇒ voltar mais, ângulo variado, reaparição conta como revisão). Biblioteca de
SRS imporía um modelo de cartas que não é o nosso.

**D11 — Autenticação só habilita sync.**
Email/senha, Google e Sign in with Lovable quando o usuário quiser sincronizar.
Nada no núcleo depende disso. Email precisa de `enable_email_auth` na mesma vez em
que o código de senha for escrito.

**D12 — Sem dependência nova sem justificativa.**
Já existem: `zod`, `@tanstack/react-query`, `sonner`, `lucide-react`, `date-fns`,
toda a pilha Radix, `vaul` (painel deslizante), `cmdk`. Para IndexedDB não há
equivalente instalado — decisão registrada em D13.

**D13 — Wrapper próprio de IndexedDB, sem instalar `idb`.**
O acesso necessário é estreito (put/get, índices por `headword`, `songId`, `status`,
`due`), e um wrapper de ~150 linhas é testável em node com `fake-indexeddb`,
que já é padrão de teste. Evita uma dependência cujo valor aqui é marginal e
mantém o controle do esquema de migração de stores.

**D14 — Tailwind v4 com tokens, sem cor hardcoded.**
O `src/styles.css` já define o sistema em `oklch` com `@theme inline`. Componentes
usam classes semânticas (`bg-card`, `text-muted-foreground`). As três traduções do
card precisam de cor e ícone próprios: viram tokens novos (`--literal`, `--context`,
`--verdict-*`), não utilidades soltas.

**D15 — Fontes via `<link>` no `__root`, nunca `@import` remoto em `styles.css`.**
O build Lightning CSS resolve `@import` do disco; um `@import` de URL quebra.
A direção visual é a da seção 5.

---

## 2. Arquitetura de módulos

```text
src/
  lib/
    db/            indexeddb.ts (wrapper D13), schema.ts (stores+versões),
                   repo.ts (CRUD tipado), sync.ts (fila de push/pull)
    lyrics/        vagalume.server.ts (fetch+parse), resolve.ts (pipeline D3/D4),
                   slug.ts, types.ts
    ai/            gateway.server.ts (chamadas D5), schemas.ts (zod D6),
                   prompts.ts, card.ts, dossier.ts, interpret.ts, suggest.ts
    words/         lemma.ts (D7), level.ts (régua), premark.ts, memory.ts
    srs/           scheduler.ts (D10), queues.ts, stats.ts
    offline/       queue.ts (D8), net.ts, sw-register.ts
  functions/       *.functions.ts (createServerFn, cliente-seguro)
  components/      lyrics/ vocab/ card/ practice/ shell/
  routes/          index.tsx, vocab.tsx, vocab/$headword.tsx, practice.tsx,
                   song/$id.tsx, settings.tsx, api/public/lyrics.ts
```

Regras de fronteira (E1 + regras do template):
- `*.server.ts` nunca é importado por componente; só por `*.functions.ts` ou rota `/api`.
- `src/lib/lyrics/vagalume.server.ts` e `src/lib/ai/*.server.ts` ficam fora do bundle do cliente.
- Rotas `api/public/*` verificam o chamador dentro do handler.

---

## 3. Resolução da música (o coração de "achar a música")

### 3.1 Contrato

```ts
type Interpretation = {
  title: string; artist: string; confidence: number;
  alternatives: { title: string; artist: string }[];   // até 3
  ambiguous: boolean;
};
type Candidate = {
  artist: string; title: string; url: string;          // path canônico do Vagalume
  score: number;                                        // 0..1 (D4)
  reason: string;                                       // "artista exato + título idêntico"
};
type Resolved = {
  status: "ok" | "choose" | "none";
  candidates: Candidate[];                              // ok: 1; choose: 2..3
  lyrics?: string;                                      // texto limpo, da fonte
  sourceUrl?: string;
};
```

### 3.2 Pipeline (ordem exata)

1. **Interpretar** (IA, D5/D6): texto bruto → `Interpretation`. A IA nunca vê a
   fonte; só lê o que o usuário digitou.
2. **Resolver artista**: `GET https://suggest.vagalume.com.br/json?q=<artist>`;
   filtra docs **sem** `title` e com `url` terminado em `/`; pontua por igualdade
   normalizada de `band` (acento e case ignorados). Empate → 2 primeiros.
3. **Listar músicas do artista**: `GET <base><artistUrl>`; extrai
   `/<artist-slug>/<song>.html`; **descarta `*-traducao.html`** (E11); deduplica.
4. **Casar título**: normaliza (sem acento, sem case, não-alnum→espaço) e compara
   com `difflib`-equivalente sobre o slug aberto. Guarda o melhor `score`.
5. **Fallbacks**, nesta ordem, se o melhor `score < 0.85`:
   a. `q=<title>` no suggest e filtra docs **com** `title` (E8 — pega quando o título
      é distintivo);
   b. variações do título (tirar `the `, `a `, `( )`, `feat. ...`, `-`/`_`);
   c. `q=<artist> <title>`;
   d. busca por trecho, quando o usuário colou parte da letra.
6. **Decidir (D4)**: `>= 0.85` → `ok`; `0.55..0.85` → `choose`; `< 0.55` → `none`.
7. **Buscar a letra**: `GET <base><url>`, extrair pelo container de E12:
   ```
   <div [^>]* \bid= ["']?lyrics ["']? [^>]*> ( ... ) </div>
   ```
   `<br>`→`\n`, `<br><br>`→estrofe, remover tags, `unescape`, colapsar 3+ linhas
   em branco, `trim`. **Recusar** se o resultado tiver `< 40` caracteres,
   `0` quebras de linha, ou cheirar a página de erro (título "Ops... 404").
8. **Cache**: letra boa vai para IndexedDB (e para a tabela `songs` no sync).
   Música já buscada abre sem rede.

### 3.3 Por que cada passo

- Passo 2 antes do 3: E9 prova que o suggest não resolve título de forma confiável.
- Passo 3: E10 dá a lista real; o slug nunca é adivinhado.
- Passo 5a: E8 mostra que `bohemian rhapsody` sim devolve músicas — vale tentar.
- Passo 7: E12 é o bug silencioso. Sem a checagem de recusa, o app mostraria
  "letra" vazia ou uma página 404 como se fosse letra.

---

## 4. Camada de IA

### 4.1 Chamada

`generateResponse` (superfície `responses`) com `model: "openai/gpt-6-astra"`,
saída JSON, `max_output_tokens` explícito, `maxRetries` padrão do SDK. Prompts em
`src/lib/ai/prompts.ts`, um por tarefa. Erro de gateway → mensagem honesta,
entrada do usuário preservada, nunca letra inventada.

### 4.2 Tarefas e saídas

| Tarefa | Entrada | Saída validada |
|---|---|---|
| interpretar | texto bruto | `Interpretation` |
| card | word, sentence, level | `WordCard` |
| dossiê | word, histórico | `Dossier` |
| pré-marcar | letra + nível | índices de palavras |
| sugerir sinonímia | word, contexto | `InsteadOf` |

### 4.3 `WordCard` (o card da palavra)

```ts
type Verdict = "wrong" | "right" | "mcnc";   // ✗ / ✓ / ◐
type WordCard = {
  headword: string;
  literal: string;            // cor/ícone próprios (D14)
  inContext: string;          // destaque do card
  insteadOf: {                // exatamente 1 sinônimo, o mais provável
    word: string; verdict: Verdict; reason: string;   // 1 linha de motivo
  };
  pronunciation?: string;
  register?: "formal" | "neutral" | "informal" | "slang";
  confidence: number;
};
```

Regras: `inContext` não pode ser cópia de `literal`; `reason` tem 1 frase;
`verdict` é um dos três, sem "depende".

### 4.4 A checagem anti-invenção (D2, estrutural)

`vagalume.server.ts` devolve **só** o texto extraído da fonte. Não existe caminho
no código que escreva em `song.lyrics` vindo de um modelo. O teste de gate da fase
procura no bundle do cliente qualquer chamada que popule letra a partir de IA e
confirma que a letra batida no banco é byte-identical ao que a fonte devolveu.

### 4.5 Nível e memória

- Nível declarado na primeira vez: `a1 a2 b1 b2 c1 c2`. É a régua de base.
- Palavras comuns ao nível **não** são sugeridas (lista de frequência + nível).
- Pré-marcação: a IA marca "provavelmente novas"; o usuário confirma ou ignora —
  revisar, não caçar.
- Descartada ou dominada ⇒ some de sugestões futuras.
- Palavra reaparecida em outra música ⇒ avisa, mostra o uso novo ao lado do antigo,
  e conta como revisão.

---

## 5. Direção visual

Uma direção só, commits depois não trocam.

- **Clima**: papel de caderno de música, escuro e calmo. Fundo quase-tinta,
  texto off-white quente. Nada de branco clínico nem gradiente roxo.
- **Tipografia**: display com caráter para título de música e nome de artista;
  texto de leitura com x-height generosa para a letra (a letra é o produto).
  Carregadas por `<link>` no `__root` (D15).
- **Letra**: estrofes com respiro, verso por linha, palavra clicável com
  sublinhado pontilhado **só** quando já coletada; a marcação do modo coleta é
  um marcador de cor, não um highlight berrante.
- **Card**: painel deslizante por baixo (`vaul`), nunca cobre a letra inteira;
  esqueleto visual enquanto enche (preenchimento progressivo).
- **Cores das três traduções**: literal (neutro), na frase (destaque, o mais forte),
  ao invés de (veredito: verde/âmbar/vermelho). Tokens novos, não utilidades soltas.
- **Modo card vs coleta**: um switch visível na tela da letra, estado lembrado.

---

## 6. Fases e critérios de aceite

Cada fase tem Gates reproduzíveis. Sem gate verde, sem `[x]`.

### F0 — Fundação
**Entrega**: shell do app, roteamento real, tokens, IndexedDB, types centrais.
- `index.tsx` sem placeholder; `/`, `/vocab`, `/practice`, `/settings` abrem.
- `__root` com `<Toaster />`, `<link>` de fontes, `head()` próprio; `index` com
  `head()` próprio (título/descrição/og do app, não "Lovable App").
- `db/` com stores `songs`, `words`, `senses`, `cards`, `dossiers`, `reviews`,
  `queue`, `settings`; `versionchange` sem deadlock; teste de round-trip.
- Gates: build OK; `app-routing.test.tsx` verde; teste do wrapper de IndexedDB
  (put/get/index por `headword`) verde; zero `bg-[#` em `src/components`.

### F1 — Achar a música
**Entrega**: buscar → interpretar → resolver → letra limpa em tela.
- `vagalume.server.ts`: `suggest`, `artistSongs`, `lyricsOf` com as regras 3.2/7.
- `resolve.ts`: pipeline 3.2 completo com os limiares de D4.
- `interpret.ts`: IA com `Interpretation` validada; fallback sem IA (palavras do
  texto) quando o gateway falha.
- UI: campo único ("música e cantor do jeito que vier"), 2–3 cards "era essa?"
  quando `choose`, vazio honesto quando `none`.
- Gates: os 8 casos de E14 rodam como teste; `bohemian rapsody quen` → Queen;
  `let it be beatles` → The Beatles; `the thunder roll` → Garth Brooks;
  palavra inventada → `none` (não letra errada); teste de que a letra vem da
  fonte (4.4).

### F2 — Ler e marcar (dois modos)
**Entrega**: letra em estrofes, palavra tocável, modo card / modo coleta.
- Render por estrofe; tokenização que não quebra apóstrofo, hífen, `feat.`.
- Modo card: toque abre o painel na hora.
- Modo coleta: toque **só marca**, sem abrir, sem delay; toque em marcada abre o card.
- Switch de modo na tela, preferência persistida.
- Resumo ao fim: "coletou N, M prontas".
- Gates: teste de tokenização (20+ casos, incl. `don't`, `anti-hero`, `o'clock`);
  teste de que coleta não dispara geração síncrona; tempo de toque medido
  (marcação < 16 ms de trabalho local, sem `await` de rede).

### F3 — Card da palavra
**Entrega**: `WordCard` completo, validado, com as três traduções e veredito.
- `card.ts` gera via IA; `schemas.ts` valida; painel deslizante com esqueleto e
  preenchimento progressivo.
- Cores/ícones das três camadas via tokens novos (D14).
- Gates: 10 palavras reais geram card válido; `verdict` sempre um dos três;
  card inválido → UI de falha com a palavra preservada; painel não cobre a letra.

### F4 — Fila em segundo plano (modo coleta de verdade)
**Entrega**: geração em fila, durável, com progresso.
- Fila no IndexedDB; sobrevive a reload e a offline; 1–2 workers simultâneos;
  retry com backoff; indicador "7 de 12 prontas".
- Gates: marcar 12 offline → 12 na fila → reload → fila intacta → online →
  12 cards; teste de idempotência (não gera duas vezes a mesma palavra).

### F5 — Vocabulário
**Entrega**: a área principal, organizada, com dossiê.
- Listas por música, categoria, frequência, estágio (nova/em estudo/dominada).
- Dossiê sob demanda: usos, combinações, registro, parecidas que confundem,
  falsos cognatos, o que evitar.
- Busca e filtro; Favoritas; Difíceis; Recém-coletadas.
- Gates: cada eixo de organização tested com dados semeados; dossiê valida schema;
  500 palavras rolam sem travar (virtualização).

### F6 — Prática
**Entrega**: revisão espaçada com os ângulos do planejamento.
- Contexto da música, não palavra solta; "significado nesse contexto";
  "esse sinônimo cabe aqui?" com os três vereditos; lacuna na letra da música de
  origem; escolher entre parecidas confundidas; reaparição conta como revisão;
  erro ⇒ volta mais e por outro ângulo.
- Gates: scheduler testado (errar ⇒ `due` mais curto; acertar ⇒ mais longo);
  cada tipo de item tem teste; um ciclo completo de sessão de revisão passa.

### F7 — Offline, sync e conta
**Entrega**: PWA offline de verdade + sincronização opcional.
- Service worker: letras, vocabulário e cards abrem offline; `/~oauth` **fora** do
  cache; fila offline entra e sai sozinha.
- Migrations Cloud: `songs`, `words`, `senses`, `cards`, `dossiers`, `reviews`,
  `user_settings` em `public`, com `GRANT` + RLS por `auth.uid()`.
- Auth: email/senha (`enable_email_auth` na mesma vez), Google, Lovable.
- Sync: push/pull idempotente, sem duplicar `headword`.
- Gates: app abre offline com letra e vocabulário; migration aplicada com GRANT e
  RLS verificados por query; sign-in de cada método funciona; sync não duplica.

---

## 7. Casos de borda obrigatórios

- Letra com `<br>` no meio de verso e estrofe de 1 linha.
- Título com acento, apóstrofo, hífen, `(live)`, `feat.`, `-traducao`.
- Artista com dois grafados (`Legião Urbana` / `Legiao Urbana`).
- Mesma música por dois artistas (cover) → `choose`, nunca chute.
- Gateway fora do ar → busca ainda resolve por fallback; card entra na fila.
- Palavra já dominada reaparece → não vira "nova".
- Usuário marca 300 palavras de uma vez → fila sem travar a UI.
- Reload no meio da geração → nada se perde, nada duplica.
- Vocabulário com 0 itens → vazio que explica o próximo passo.
- Letra de 400 linhas → leitura sem jank.

---

## 8. Tools e skills por tipo de trabalho

| Trabalho | Uso |
|---|---|
| IA (interpretar/card/dossiê) | `@lovable.dev/ai-gateway`, `responses`, `gpt-6-astra` (E4) |
| Schema/migrations Cloud | `lov_database--migration`, `supabase--read_query` p/ conferir RLS+GRANT |
| Login | `enable_email_auth`, `supabase--configure_social_auth`, `lovable.auth` |
| Testes | `bunx vitest run` |
| UI visual | Playwright no sandbox, screenshot por etapa |
| Portais/painéis | `vaul` (já instalado) |
| Notificações | `sonner` (já instalado) |
| Paralelismo do remix | `spawn_agent` (nunca `oc`) |

---

## 9. Gates globais (fechamento do remix)

1. `bunx vitest run` verde.
2. Build sem erro (`/tmp/observability/build-errors.log` limpo).
3. Fluxo real no browser: buscar música difíceis → letra → coletar 5 palavras →
   cards prontos → vocabulário → uma sessão de revisão.
4. Offline: recarregar sem rede e abrir letra + vocabulário.
5. Nenhuma letra gerada por IA (4.4).
6. Sem `bg-[#`, sem cor hardcoded em componentes.
7. `head()` único em cada rota de conteúdo.

---

## 10. Registro de decisões do remix

- R1. PRD e roadmap estavam `null` com o planejamento cheio → criados do zero
  (regra "1 existe"), remix **não** cancelado.
- R2. Cloud habilitado nesta sessão; local-first (D1) mantém o núcleo sem conta.
- R3. API pública do Vagalume está morta (E5); a resolução usa suggest + página de
  artista (D3), que foi medida em E10/E14.
- R4. Wrapper próprio de IndexedDB (D13) em vez de instalar `idb`.
- R5. SRS próprio (D10) em vez de biblioteca de flashcards.
- R6. Auth é fase final (F7), não pré-requisito: o planejamento não pede conta e
  exige offline.

---

## 11. O que este PRD **não** faz

- Não inventa letra, tradução ou veredito em código — tudo vem de IA validada ou
  da fonte.
- Não troca a direção visual depois de fixada.
- Não usa `oc`/monitor para produzir nada do remix.
- Não pergunta ao usuário no meio do remix; decide e registra aqui.

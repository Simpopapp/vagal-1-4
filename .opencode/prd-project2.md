# PRD — project2: configuração de provedores de IA nos ajustes

O **COMO** do `project2`. Derivado do planejamento (`project2.md`), confirmado no
código desta sandbox antes de ser escrito. As seções 0 e 1 registram o que foi
verificado; as fases (seção 8) só usam o que existe no ambiente.

Precedência: no **escopo**, `project2` > este arquivo > `roadmap-proj2`.
No **como**, este arquivo manda. Onde este PRD toca o projeto1 (fila, cards,
sync), o PRD do project1 continua mandando no que já existia — este arquivo só
adiciona a camada de provedor por cima, sem reescrever decisões antigas.

---

## 0. Base de evidência (verificado, não assumido)

| # | Verificação | Resultado |
|---|---|---|
| P1 | `src/lib/ai/gateway.server.ts` | toda chamada de IA passa por `askJson`; modelo fixo `openai/gpt-6-astra` via Lovable AI Gateway, superfície `responses` |
| P2 | `src/lib/queue/worker.ts` | o gerador é **injetável** (`GenerateCardFn`); `serverGenerate` é só o default — trocar o provedor não exige reescrever a fila |
| P3 | `src/lib/songs/cards.functions.ts` | a fronteira cliente/servidor já devolve resultado tipado (`ok` / `credits` / `failed`), nunca exceção de transporte |
| P4 | `src/lib/db/repo.ts` | ajustes vivem no store `settings` do IndexedDB via `getSetting`/`setSetting`; chaves tipadas em `Settings["key"]` |
| P5 | `src/lib/db/sync.ts` | o push sincroniza **todas** as linhas de `settings` para `user_settings` — uma chave de API gravada ali vazaria para a nuvem sem um filtro explícito |
| P6 | `src/routes/settings.tsx` | a aba de ajustes já tem seções em `Card` (nível, modo de toque, conta, recomeçar); a seção nova segue esse padrão |
| P7 | Créditos do workspace | AI Gateway responde 402 `payment_required` (probe de 2026-11-09) — o provedor padrão está sem saldo, o que torna este projeto ainda mais útil: o usuário pode apontar para um provedor próprio/gratuito |
| P8 | Endpoints OpenAI-compatíveis | Groq, OpenRouter, Together, Mistral, DeepSeek, Gemini (modo compatível) e Ollama expõem `POST {base}/chat/completions` e `GET {base}/models` no mesmo formato |
| P9 | CORS | chamadas diretas do navegador dependem do provedor permitir origem cruzada; Groq/OpenRouter/Together/Ollama permitem, outros podem recusar — a UI precisa de erro honesto para esse caso |
| P10 | `zod` | já instalado e já é o validador de toda saída de IA (PRD1 D6) — o caminho novo reusa os mesmos schemas |
| P11 | `src/lib/ai/schemas.ts` | `wordCardSchema` existe e é o contrato de validação do card; nenhum schema novo é necessário para o project2 |
| P12 | `src/components/ui/` | primitivos shadcn disponíveis: `select`, `input`, `label`, `button`, `card`, `badge`, `alert-dialog` — nenhum componente novo de base é preciso |

P5 é o fato mais importante deste PRD: sem um filtro no sync, o recurso novo
criaria um vazamento de credencial. A seção 7 torna a proteção estrutural.

---

## 1. Decisões técnicas

Numeradas. Uma decisão por linha de raciocínio. Mudanças posteriores entram na
seção 11, nunca reescrevem estas.

**E1 — O provedor padrão continua sendo o Lovable AI Gateway.**
Nada muda para quem nunca abrir a seção: `askJson` no servidor, modelo do
workspace, zero configuração. O recurso é opt-in.

**E2 — O catálogo é de provedores OpenAI-compatíveis.**
P8: um único cliente HTTP (`chat/completions` + `models`) cobre todos os
provedores da lista e o provedor customizado. Anthropic usa seu endpoint de
compatibilidade OpenAI (`https://api.anthropic.com/v1/`); quem não tem modo
compatível fica fora do catálogo em vez de gerar um segundo cliente.

**E3 — A chave de API nunca sai do aparelho.**
P5: o sync empurra todo o store `settings`. Então a chave vive sob a chave
`aiProviderKey`, e `sync.ts` ganha uma lista de exclusão (`LOCAL_ONLY_SETTINGS`)
que filtra essa chave no push **e** no pull. A configuração do provedor (sem
segredo) sincroniza normalmente; o segredo, nunca.

**E4 — Chamada direta do navegador quando o provedor é customizado.**
O servidor não conhece a chave do usuário (E3), então a chamada sai do
navegador direto para o provedor. Consequência aceita e registrada: P9 (CORS)
pode bloquear alguns provedores; a UI mostra o erro real ("o provedor recusou
a conexão a partir do navegador") em vez de falhar em silêncio.

**E5 — A lista de modelos vem do provedor, com fallback curado.**
`GET {baseUrl}/models` com a chave do usuário. Se a listagem falhar (rede,
CORS, provedor sem endpoint de modelos), a UI oferece a lista curada do
catálogo (`fallbackModels`) e ainda permite digitar o nome do modelo à mão.
Nunca uma lista vazia sem saída.

**E6 — Validação idêntica nos dois caminhos.**
P10/P11: o caminho direto usa os mesmos schemas zod do caminho servidor. Um
card inválido falha igual nos dois mundos; a UI de falha já existente
(palavra preservada) cobre os dois.

**E7 — A fila não sabe que provedor existe.**
P2: o worker recebe um `GenerateCardFn`. Um roteador novo (`resolveGenerator`)
lê a configuração guardada e devolve o gerador certo (servidor ou direto).
O worker, o indicador e o painel não mudam de comportamento.

**E8 — "Sem créditos" do gateway continua pausando a fila; erro de provedor
próprio não pausa.**
A pausa global existe porque o 402 do workspace atinge todas as chamadas. Com
provedor próprio, um 401/402 significa "a chave do usuário tem problema" —
isso é falha daquele item com mensagem clara, não pausa global.

**E9 — Sem dependência nova.**
P12 + `fetch` nativo cobrem tudo. Nenhum SDK de provedor é instalado.

**E10 — O provedor customizado aceita qualquer URL base.**
O usuário cola a URL base (ex.: `https://api.exemplo.com/v1`), opcionalmente
sem chave (ex.: Ollama local). A URL é validada (precisa ser `http(s)://`)
antes de salvar; Ollama entra no catálogo como provedor local sem chave.

---

## 2. Arquitetura de módulos

```text
src/
  lib/
    ai/
      providers.ts        catálogo + tipos + schema zod da configuração (contrato)
      client.ts           cliente HTTP OpenAI-compatível do navegador (novo)
      generate.ts         roteador: escolhe servidor ou direto pela config (novo)
      gateway.server.ts   caminho padrão (inalterado)
      card.ts             prompt do card (inalterado)
      schemas.ts          validação zod (inalterada)
    db/
      repo.ts             helpers get/setProviderConfig + get/setProviderKey
      sync.ts             filtro LOCAL_ONLY_SETTINGS (E3)
  components/
    settings/
      ProviderSection.tsx  a seção nova da aba de ajustes (novo)
  routes/
    settings.tsx          monta <ProviderSection /> entre "modo de toque" e "conta"
  test/
    providers.test.ts     catálogo e schema da configuração
    ai-client.test.ts     cliente HTTP: listagem, chat, erros (fetch mockado)
    generate.test.ts      roteador: servidor vs direto, fallback, pausa
    sync-filter.test.ts   a chave nunca entra no push nem no pull
```

Regras de fronteira (inalteradas do PRD1):
- `client.ts` e `generate.ts` são código de navegador: nunca importam
  `gateway.server.ts` nem nada `*.server.ts`.
- `gateway.server.ts` continua server-only; o roteador chama a server function
  existente (`generateCard`) para o caminho padrão, nunca o gateway direto.

---

## 3. Catálogo de provedores

Cada entrada: `id`, `name`, `baseUrl`, `needsKey`, `freeTier` (badge "grátis"),
`keyUrl` (onde conseguir a chave), `fallbackModels` (lista curada para o E5).

| id | nome | baseUrl | chave | grátis |
|---|---|---|---|---|
| `lovable` | Lovable Cloud (padrão) | — (servidor) | não | — |
| `openai` | OpenAI | `https://api.openai.com/v1` | sim | não |
| `groq` | Groq | `https://api.groq.com/openai/v1` | sim | **sim** |
| `openrouter` | OpenRouter | `https://openrouter.ai/api/v1` | sim | **sim** (modelos `:free`) |
| `together` | Together | `https://api.together.xyz/v1` | sim | **sim** (crédito inicial) |
| `mistral` | Mistral | `https://api.mistral.ai/v1` | sim | **sim** (tier gratuito) |
| `deepseek` | DeepSeek | `https://api.deepseek.com/v1` | sim | não |
| `gemini` | Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | sim | **sim** |
| `ollama` | Ollama (local) | `http://localhost:11434/v1` | não | **sim** (local) |
| `custom` | Outro provedor… | digitada pelo usuário | opcional | — |

A ordem de exibição coloca os gratuitos logo após o padrão. O badge "grátis"
é informativo ("tem opção gratuita"), não promessa de custo zero.

---

## 4. Contratos (fixados antes do trabalho paralelo)

```ts
// src/lib/ai/providers.ts
export type ProviderId =
  | "lovable" | "openai" | "groq" | "openrouter" | "together"
  | "mistral" | "deepseek" | "gemini" | "ollama" | "custom";

export type ProviderDef = {
  id: ProviderId;
  name: string;
  baseUrl: string;            // "" para `lovable`; editável quando `custom`
  needsKey: boolean;
  freeTier: boolean;
  keyUrl?: string;            // página de chaves do provedor
  fallbackModels: string[];   // E5
};

export const PROVIDERS: readonly ProviderDef[];

export type ProviderConfig = {
  provider: ProviderId;
  baseUrl?: string;           // obrigatória quando provider === "custom"
  model?: string;             // modelo escolhido; vazio = default do provedor
};

export const providerConfigSchema: ZodType<ProviderConfig>;
export function getProviderDef(id: ProviderId): ProviderDef;
export function isCustomProvider(config: ProviderConfig): boolean; // provider !== "lovable"

// src/lib/ai/client.ts  (navegador)
export class ProviderError extends Error {
  readonly kind: "auth" | "credits" | "cors" | "network" | "invalid-output" | "refused";
}
export async function listModels(config: ProviderConfig, apiKey: string): Promise<string[]>;
export async function testConnection(config: ProviderConfig, apiKey: string): Promise<{ ok: true; models: number }>;
export async function askProviderJson<T>(options: {
  config: ProviderConfig; apiKey: string; system: string; user: string;
  schema: { parse: (value: unknown) => T }; maxOutputTokens?: number;
}): Promise<T>;

// src/lib/ai/generate.ts  (navegador)
export function resolveGenerator(): Promise<GenerateCardFn>; // lê config guardada

// src/lib/db/repo.ts
export function getProviderConfig(): Promise<ProviderConfig>;        // default { provider: "lovable" }
export function setProviderConfig(config: ProviderConfig): Promise<Settings>;
export function getProviderKey(): Promise<string>;                   // "" quando não há
export function setProviderKey(key: string): Promise<Settings>;

// src/lib/db/sync.ts
export const LOCAL_ONLY_SETTINGS: readonly string[]; // ["aiProviderKey"]
```

`Settings["key"]` em `src/lib/types.ts` ganha `"aiProvider" | "aiProviderKey"`.
O valor de `aiProvider` é o JSON serializado de `ProviderConfig`; o de
`aiProviderKey` é a chave em texto puro **local** (E3).

---

## 5. Fluxo de geração com o roteador

```text
toque na palavra → enqueueCard (inalterado)
worker → resolveGenerator()
           ├─ config.provider === "lovable" → serverGenerate (caminho atual)
           └─ caso contrário → askProviderJson com a chave local
                ├─ ProviderError kind "auth"     → falha do item, msg "chave inválida"
                ├─ ProviderError kind "credits"  → falha do item, msg "sem saldo no provedor"
                ├─ ProviderError kind "cors"     → falha do item, msg "provedor não aceita chamada do navegador"
                └─ sucesso → saveCard (inalterado)
```

O modo card (toque abre na hora) usa o mesmo roteador — um único lugar decide
o caminho, então os dois modos nunca divergem.

---

## 6. A seção na aba de ajustes

`ProviderSection.tsx`, um `Card` no padrão das seções existentes (P6):

1. **Seletor de provedor** — lista do catálogo, com badge "grátis" onde
   `freeTier`. O padrão ("Lovable Cloud") vem primeiro e marcado como padrão.
2. **URL base** — visível só para `custom` (obrigatória) e `ollama`
   (pré-preenchida, editável). Validada como `http(s)://` antes de salvar.
3. **Chave de API** — visível quando `needsKey` (ou `custom`); campo senha com
   mostrar/ocultar; link "onde conseguir" (`keyUrl`) quando houver; nota
   visível: "a chave fica só neste aparelho".
4. **Modelo** — botão "carregar modelos" chama `listModels`; sucesso abre um
   seletor com a lista; falha cai no fallback curado + campo livre (E5).
5. **Testar conexão** — chama `testConnection` e mostra o resultado real:
   "conectado · N modelos" ou o erro honesto (auth/CORS/rede).
6. **Estado salvo** — ao abrir a aba, a seção reflete a configuração guardada
   (provedor, URL, modelo; a chave aparece como "••••••" quando existe, com
   opção de substituir ou remover).

Voltar para "Lovable Cloud" limpa URL/modelo customizados e mantém a chave
guardada (trocar de provedor e voltar não pode apagar o segredo do usuário).

---

## 7. Segurança (E3, estrutural)

- `LOCAL_ONLY_SETTINGS = ["aiProviderKey"]` em `sync.ts`; o push filtra essas
  chaves antes do upsert e o pull as ignora. Teste dedicado prova os dois lados.
- A chave nunca aparece em log, toast, URL ou payload de telemetria.
- O campo de chave é `type="password"` com autocomplete desligado.
- Nenhuma rota de servidor recebe a chave: o servidor só conhece o gateway do
  workspace. Isso é o que torna E4 (chamada direta) a única arquitetura correta.

---

## 8. Fases e critérios de aceite

### G0 — Contratos (agente principal)
**Entrega**: `providers.ts` completo, chaves novas em `types.ts`, helpers no
`repo.ts`, filtro no `sync.ts`.
- Gates: `providers.test.ts` verde (catálogo íntegro, schema rejeita config
  inválida, `custom` exige `baseUrl` http(s)) · `sync-filter.test.ts` verde ·
  `tsgo -b --noEmit` exit 0.

### G1 — Cliente e roteador (subagente s1-cliente-ia)
**Entrega**: `client.ts`, `generate.ts`, testes dos dois.
- `listModels` ordena e deduplica; `testConnection` distingue auth/CORS/rede;
  `askProviderJson` valida com o schema recebido e falha como `ProviderError`
  tipado — nunca devolve JSON parcial.
- `resolveGenerator` devolve o caminho servidor para `lovable` e o direto para
  os demais; erro de auth/credits do provedor próprio falha o item sem pausar
  a fila (E8).
- Gates: `ai-client.test.ts` e `generate.test.ts` verdes com `fetch` mockado
  (nenhuma chamada real) · nenhum import de `*.server.ts` no cliente ·
  `tsgo` exit 0.

### G2 — Seção de ajustes (subagente s2-ui-provedor)
**Entrega**: `ProviderSection.tsx` completo, contra os contratos da seção 4.
- Todos os estados da seção 6 visíveis e funcionais; nada de cor hardcoded;
  texto em pt-BR no tom das seções vizinhas.
- Gates: a seção renderiza com a config guardada · salvar persiste (reload
  mantém provedor/modelo; chave visível só como "••••••") · `tsgo` exit 0.

### G3 — Integração e gates globais (agente principal)
**Entrega**: `settings.tsx` monta a seção; worker usa `resolveGenerator`;
gates finais.
- Gates: `bunx vitest run` verde · build limpo · fluxo real no browser: abrir
  ajustes, escolher Groq, colar chave inválida → erro honesto; voltar para
  Lovable Cloud → config preservada · 0 erros de console.

---

## 9. Casos de borda obrigatórios

- Provedor sem endpoint `/models` → fallback curado + campo livre (E5).
- Chave certa, modelo apagado do provedor → erro de geração honesto no card.
- Usuário cola URL sem `https://` → validação barra antes de salvar.
- Ollama desligado → `testConnection` responde "não foi possível conectar".
- Trocar de provedor com fila pendente → a fila continua; o próximo item usa
  o provedor novo (o roteador lê a config a cada corrida).
- Config sincronizada em outro aparelho → provedor e modelo chegam pelo sync;
  a chave não (E3) — a seção mostra "falta a chave neste aparelho".
- Chave com espaços nas pontas → `trim` antes de salvar e antes de usar.

---

## 10. Tools e skills por tipo de trabalho

| Trabalho | Uso |
|---|---|
| Cliente HTTP do provedor | `fetch` nativo (E9), testado com mock |
| Validação | `zod` (P10), schemas existentes (P11) |
| UI da seção | primitivos shadcn já instalados (P12) |
| Testes | `bunx vitest run` |
| Verificação visual | Playwright no sandbox |
| Paralelismo | `spawn_agent` (skill `subagentes-3-pilares`), nunca `oc` |

---

## 11. Registro de decisões do remix

- Q1. O planejamento pede "principais provedores incluindo alternativas free":
  o catálogo marca `freeTier` em Groq, OpenRouter, Together, Mistral, Gemini e
  Ollama, e a ordem de exibição privilegia esses.
- Q2. A chave fica local-only (E3) porque P5 mostrou que o sync empurraria o
  segredo para a nuvem; a configuração sem segredo sincroniza normalmente.
- Q3. Anthropic ficou fora do catálogo inicial: seu modo OpenAI-compatível é
  parcial; entra por `custom` se o usuário quiser. Decisão revistável.
- Q4. Erro de provedor próprio não pausa a fila (E8): a pausa global existe
  para o 402 do workspace, não para a chave do usuário.
- Q5. (s2) A seleção de `custom` sem URL válida fica só na tela até a URL ser
  preenchida — gravar uma config incompleta quebraria a geração em silêncio.
- Q6. (s2) A chave é salva por botão explícito ("Salvar chave"), não a cada
  tecla: evita gravar segredos pela metade.
- Q7. (s1) Corpos de erro HTTP passam por redação da chave antes de virar
  mensagem — o provedor pode ecoar a chave no erro.
- Q8. (integração) O worker recebe `routedGenerate`, que resolve a config a
  cada item: trocar de provedor com fila pendente vale já no próximo item.

---

## 12. O que este PRD **não** faz

- Não muda o caminho padrão (gateway do workspace) nem o modelo default.
- Não envia a chave do usuário a nenhum servidor — nem o nosso.
- Não instala SDK de provedor (E9).
- Não altera fila, painel, schemas ou sync além do filtro de E3.
- Não pergunta ao usuário no meio do remix; decide e registra aqui.

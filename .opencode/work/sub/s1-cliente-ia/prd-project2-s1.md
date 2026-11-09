# prd-project2-s1 — o COMO do subagente s1 (cliente e roteador de IA)

Recorte do PRD central (`.opencode/prd-project2.md`). Onde houver conflito, o
central manda. Leia também `project2.md` e `roadmap-proj2.md` (centrais).

## Decisões centrais que este pacote segue

- **E2**: um cliente HTTP único cobre todos os provedores (OpenAI-compatível):
  `POST {base}/chat/completions` e `GET {base}/models`.
- **E4**: chamada direta do navegador; CORS pode falhar e vira erro distinto.
- **E6**: `askProviderJson` valida com o schema zod recebido; falha vira
  `ProviderError` `invalid-output`, nunca JSON parcial.
- **E8**: `auth`/`credits` do provedor próprio falham o item sem pausar a fila.
- **E9**: `fetch` nativo, nenhum SDK.
- **Fronteira**: `client.ts` e `generate.ts` são código de navegador — é
  proibido importar `gateway.server.ts` ou qualquer `*.server.ts`. O caminho
  padrão passa pela server function `generateCard` (que já existe), nunca pelo
  gateway direto.

## Contratos (fixados; implementar exatamente)

```ts
// src/lib/ai/client.ts
export class ProviderError extends Error {
  readonly kind: "auth" | "credits" | "cors" | "network" | "invalid-output" | "refused";
  constructor(kind, message, detail?);
}
export async function listModels(config: ProviderConfig, apiKey: string): Promise<string[]>;
export async function testConnection(config: ProviderConfig, apiKey: string): Promise<{ ok: true; models: number }>;
export async function askProviderJson<T>(options: {
  config: ProviderConfig; apiKey: string; system: string; user: string;
  schema: { parse: (value: unknown) => T }; maxOutputTokens?: number;
}): Promise<T>;

// src/lib/ai/generate.ts
export function resolveGenerator(): Promise<GenerateCardFn>;
```

`GenerateCardFn` vem de `src/lib/queue/worker.ts` (import type only).

## Regras de implementação do cliente

1. URL efetiva via `effectiveBaseUrl(config)` de `providers.ts`; endpoints
   `{base}/models` e `{base}/chat/completions`.
2. Header `Authorization: Bearer <apiKey>` só quando `apiKey` não vazia
   (Ollama/custom podem não ter chave). `Content-Type: application/json` sempre.
3. `listModels`: parseia `{ data: [{ id }] }`, filtra ids vazios, deduplica,
   ordena alfabeticamente. Falha de rede/HTTP → `ProviderError` tipado.
4. `testConnection`: chama `listModels` e devolve `{ ok: true, models: n }`.
5. `askProviderJson`: body `{ model, messages: [{role:"system"},{role:"user"}],
   response_format: { type: "json_object" }, max_tokens }`; o modelo é
   `config.model` — se vazio, erro `refused` ("nenhum modelo escolhido").
   Extrai `choices[0].message.content`, faz `JSON.parse`, valida com
   `schema.parse`. Qualquer quebra nesse caminho → `invalid-output`.
6. Mapeamento de erro HTTP: 401/403 → `auth`; 402 → `credits`; 429 →
   `refused` com mensagem de rate limit; `TypeError` de fetch (falha de rede
   ou CORS — o navegador não distingue) → `cors` com mensagem que mencione as
   duas possibilidades ("sem conexão ou o provedor não aceita chamadas do
   navegador"); demais → `refused` com o corpo do erro quando houver.
7. Timeout: `AbortSignal.timeout(30_000)` em todas as chamadas.
8. Nunca logar a chave; mensagens de erro nunca incluem `apiKey`.

## Regras do roteador (`generate.ts`)

```ts
export async function resolveGenerator(): Promise<GenerateCardFn> {
  const config = await getProviderConfig();
  if (!isCustomProvider(config)) return serverGenerate; // reexportado do worker
  const apiKey = await getProviderKey();
  return async (input) => {
    const card = await askProviderJson({
      config, apiKey,
      system: CARD_SYSTEM, // importado de @/lib/ai/card — ver nota abaixo
      user: `Palavra: ${input.headword}\nFrase da música: "${input.line}"\nNível do estudante: ${input.level}`,
      schema: { parse: (v: unknown) => wordCardSchema.parse(v) as WordCard },
      maxOutputTokens: 900,
    });
    return card;
  };
}
```

Nota: `src/lib/ai/card.ts` é server-only por causa do import de
`gateway.server.ts`. NÃO importe `card.ts` no navegador. Em vez disso, mova a
constante `SYSTEM` de `card.ts` para um módulo novo `src/lib/ai/prompts.ts`
(browser-safe, sem imports server) e faça `card.ts` importar de lá — essa é a
única edição fora dos seus arquivos que este pacote autoriza, e ela é
obrigatória para não duplicar o prompt. `prompts.ts` passa a ser seu também.

Erros do caminho direto: `ProviderError` sobe como está (o worker já trata
erro genérico como falha do item com mensagem — E8). Nunca lance
`QueuePausedError` no caminho direto.

## Testes esperados (fetch mockado com `vi.stubGlobal("fetch", ...)`)

`ai-client.test.ts`:
- `listModels` deduplica, ordena e filtra ids vazios.
- `listModels` sem chave não manda header `Authorization`.
- 401 → `ProviderError` kind `auth`; 402 → `credits`; fetch rejeitado → `cors`.
- `askProviderJson` devolve o valor validado; JSON quebrado → `invalid-output`;
  schema reprova → `invalid-output`; sem `config.model` → `refused`.
- a chave nunca aparece na mensagem de erro.

`generate.test.ts`:
- config `lovable` → devolve o gerador servidor (identidade: `serverGenerate`).
- config `groq` → devolve gerador direto que chama `askProviderJson` (mock do
  módulo `client.ts` com `vi.mock`) e devolve o card.
- IndexedDB: usar `fake-indexeddb` como os testes existentes
  (`src/test/local-store.test.ts` mostra o padrão) ou mockar `repo.ts`.

## Gates do pacote

- `bunx vitest run src/test/ai-client.test.ts src/test/generate.test.ts` verde.
- `bunx tsgo -b --noEmit` exit 0 (rode também os testes antigos de card se
  tocar em `card.ts`: `bunx vitest run` completo deve ficar verde).
- `rg "gateway.server" src/lib/ai/client.ts src/lib/ai/generate.ts src/lib/ai/prompts.ts`
  sem ocorrências.

## Registro de decisões do subagente

(preencher aqui, numerado, se algo divergir do plano — com justificativa)

## Proibições

- Não editar arquivos fora da lista de dono (exceção autorizada: a extração
  do prompt para `prompts.ts` e o ajuste do import em `card.ts`).
- Não instalar dependências.
- Não fazer chamadas de rede reais nos testes.
- Não perguntar nada ao usuário; decidir e registrar acima.

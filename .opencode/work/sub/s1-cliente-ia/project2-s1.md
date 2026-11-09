# project2-s1 — planejamento do subagente s1 (cliente e roteador de IA)

## Missão
Construir o cliente HTTP OpenAI-compatível do navegador e o roteador que
escolhe entre o gateway padrão (servidor) e o provedor do usuário (direto).
Sem esta peça, a seção de ajustes do project2 é só decoração: é aqui que a
chave local do usuário vira uma chamada real, validada e com erro honesto.

## Escopo
- `src/lib/ai/client.ts`: `ProviderError`, `listModels`, `testConnection`,
  `askProviderJson` (assinaturas exatas do PRD2 seção 4).
- `src/lib/ai/generate.ts`: `resolveGenerator()` conforme PRD2 seção 5.
- `src/test/ai-client.test.ts` e `src/test/generate.test.ts`: fetch mockado,
  zero chamadas reais.

## Fora do escopo
- Não edita `settings.tsx`, `ProviderSection.tsx` (pacote s2), `worker.ts`,
  `cards.functions.ts`, `gateway.server.ts`, `providers.ts`, `repo.ts`,
  `sync.ts`, `types.ts`. A fiação do worker é do agente principal (G3).
- Não instala dependências (PRD2 E9: fetch nativo).

## Por quê
- PRD2 E4: a chave nunca vai ao servidor, então a chamada sai do navegador;
  CORS pode falhar e o erro precisa ser distinto e honesto (P9).
- PRD2 E6: o caminho direto valida com o mesmo schema zod do caminho servidor;
  JSON parcial nunca chega à tela.
- PRD2 E8: erro de auth/credits do provedor próprio falha o item sem pausar a
  fila — a pausa global é só para o 402 do workspace.

## Fronteiras
- Consome: `src/lib/ai/providers.ts` (catálogo, `effectiveBaseUrl`,
  `isCustomProvider`), `src/lib/db/repo.ts` (`getProviderConfig`,
  `getProviderKey`), `src/lib/songs/cards.functions.ts` (`generateCard`,
  `GenerateCardResult`), `src/lib/queue/worker.ts` (`GenerateCardFn`,
  `QueuePausedError` — só importa o tipo), `src/lib/ai/schemas.ts`.
- Entrega: `client.ts` e `generate.ts` prontos para o agente principal ligar
  no worker e no modo card.

## Dono exclusivo de
- `src/lib/ai/client.ts`
- `src/lib/ai/generate.ts`
- `src/test/ai-client.test.ts`
- `src/test/generate.test.ts`

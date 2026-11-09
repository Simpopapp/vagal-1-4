# roadmap-proj2-s1 — fases do subagente s1 (cliente e roteador de IA)

## S1.1 — Prompt compartilhado
- [ ] extrair `SYSTEM` de `card.ts` para `src/lib/ai/prompts.ts` (browser-safe) e ajustar o import em `card.ts`
- Gates: `bunx vitest run` dos testes existentes verde · nenhum import server em `prompts.ts`

## S1.2 — Cliente HTTP
- [ ] `src/lib/ai/client.ts` com `ProviderError`, `listModels`, `testConnection`, `askProviderJson` conforme o PRD do pacote
- Gates: `ai-client.test.ts` verde (fetch mockado, 0 chamadas reais) · chave nunca em mensagem de erro

## S1.3 — Roteador
- [ ] `src/lib/ai/generate.ts` com `resolveGenerator()` (servidor para `lovable`, direto para os demais)
- Gates: `generate.test.ts` verde · `rg "gateway.server"` sem ocorrências nos arquivos do pacote

## S1.4 — Gates finais
- [ ] `bunx vitest run` completo verde · `bunx tsgo -b --noEmit` exit 0
- [ ] relatório final: feito · evidências dos gates · decisões · pendências · arquivos tocados

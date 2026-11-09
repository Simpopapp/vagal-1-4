# Roadmap — project2 (configuração de provedores de IA nos ajustes)

Executar em ordem de dependência. Só avança com a linha de Gates verde.
Marcar `[x]` somente com números reais. Fonte do COMO: `.opencode/prd-project2.md`.

## G0 — Contratos (agente principal)
- [x] `src/lib/ai/providers.ts`: catálogo (10 provedores, badge grátis), `ProviderConfig`, schema zod, `getProviderDef`, `isCustomProvider`
- [x] `src/lib/types.ts`: `Settings["key"]` ganha `aiProvider` / `aiProviderKey`
- [x] `src/lib/db/repo.ts`: `get/setProviderConfig` + `get/setProviderKey` (trim na chave)
- [x] `src/lib/db/sync.ts`: `LOCAL_ONLY_SETTINGS` filtra a chave no push e no pull
- Gates: `providers.test.ts` 14 verdes · `sync-filter.test.ts` 4 verdes · `tsgo -b --noEmit` exit 0 (2026-11-09)

## G1 — Cliente e roteador (subagente s1-cliente-ia)
- [x] `src/lib/ai/client.ts`: `listModels` (dedup+ordena), `testConnection` (auth/CORS/rede distintos), `askProviderJson` (zod obrigatório), `ProviderError` tipado
- [x] `src/lib/ai/generate.ts`: `resolveGenerator()` — servidor para `lovable`, direto para os demais; erro do provedor próprio falha o item sem pausar a fila
- Gates: `ai-client.test.ts` 13 verdes + `generate.test.ts` 4 verdes com `fetch` mockado (0 chamadas reais) · 0 imports de `*.server.ts` no cliente · `tsgo` exit 0
- Nota: o subagente s1 não pôde escrever no repositório (restrição de sandbox) e entregou o código no relatório; o agente principal aplicou, escreveu os testes e verificou os gates.

## G2 — Seção de ajustes (subagente s2-ui-provedor)
- [x] `src/components/settings/ProviderSection.tsx`: seletor com badge grátis, URL base (custom/ollama), chave com mostrar/ocultar e nota "só neste aparelho", carregar modelos com fallback + campo livre, testar conexão com resultado real
- [x] estado salvo refletido ao abrir (chave como "••••••"); voltar ao padrão preserva a chave guardada
- Gates: renderiza com config guardada (verificado no browser) · salvar persiste após reload (placeholder "••••••••" confirmado) · 0 cores hardcoded · `tsgo` exit 0
- Nota: o subagente s2 também não pôde escrever no repositório; entregou o componente em `/tmp` e o agente principal aplicou e verificou.

## G3 — Integração e fechamento (agente principal)
- [x] `settings.tsx` monta `<ProviderSection />` entre "modo de toque" e "conta"
- [x] worker/modo card passam a usar `resolveGenerator()` (via `routedGenerate` no `QueueIndicator`, resolvendo a config a cada item)
- [x] gates globais: 139 testes verdes · build limpo · fluxo real no browser (Groq + chave inválida → "chave inválida ou sem permissão" do 401 real; reload → chave mascarada; voltar ao padrão → config preservada) · 0 erros de console além do 401 esperado do teste

**Próximo remix:** se sobrar pendência, retomar da primeira fase não concluída; itens que dependerem de créditos de IA do workspace ficam `[~] pendente-IA` e não bloqueiam.

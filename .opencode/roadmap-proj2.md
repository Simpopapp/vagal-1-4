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
- [ ] `src/lib/ai/client.ts`: `listModels` (dedup+ordena), `testConnection` (auth/CORS/rede distintos), `askProviderJson` (zod obrigatório), `ProviderError` tipado
- [ ] `src/lib/ai/generate.ts`: `resolveGenerator()` — servidor para `lovable`, direto para os demais; erro do provedor próprio falha o item sem pausar a fila
- Gates: `ai-client.test.ts` + `generate.test.ts` verdes com `fetch` mockado (0 chamadas reais) · 0 imports de `*.server.ts` no cliente · `tsgo` exit 0

## G2 — Seção de ajustes (subagente s2-ui-provedor)
- [ ] `src/components/settings/ProviderSection.tsx`: seletor com badge grátis, URL base (custom/ollama), chave com mostrar/ocultar e nota "só neste aparelho", carregar modelos com fallback + campo livre, testar conexão com resultado real
- [ ] estado salvo refletido ao abrir (chave como "••••••"); voltar ao padrão preserva a chave guardada
- Gates: renderiza com config guardada · salvar persiste após reload · 0 cores hardcoded · `tsgo` exit 0

## G3 — Integração e fechamento (agente principal)
- [ ] `settings.tsx` monta `<ProviderSection />` entre "modo de toque" e "conta"
- [ ] worker/modo card passam a usar `resolveGenerator()`
- [ ] gates globais: `bunx vitest run` verde · build limpo · fluxo real no browser (provedor inválido → erro honesto; voltar ao padrão preserva config) · 0 erros de console

**Próximo remix:** se sobrar pendência, retomar da primeira fase não concluída; itens que dependerem de créditos de IA do workspace ficam `[~] pendente-IA` e não bloqueiam.

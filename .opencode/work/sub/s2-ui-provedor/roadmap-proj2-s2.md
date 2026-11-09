# roadmap-proj2-s2 — fases do subagente s2 (seção de provedor nos ajustes)

## S2.1 — Estrutura e estados
- [ ] `ProviderSection.tsx` com seletor (badge grátis), URL base validada, chave com mostrar/ocultar + nota local-only
- Gates: componente compila · `rg "bg-\[#" ` sem ocorrências

## S2.2 — Modelos e teste de conexão
- [ ] carregar modelos com spinner, fallback curado + campo livre; testar conexão com resultado real por `ProviderError.kind`
- Gates: estados de sucesso/erro/falta-de-chave renderizam conforme o PRD do pacote

## S2.3 — Persistência e estado salvo
- [ ] montar refletindo config guardada; chave como "••••••••" com remover; voltar ao padrão preserva a chave
- Gates: salvar persiste após reload (teste de componente ou verificação no browser)

## S2.4 — Gates finais
- [ ] `bunx tsgo -b --noEmit` exit 0 (após `client.ts` do s1 existir — regra de espera do PRD do pacote)
- [ ] relatório final: feito · evidências dos gates · decisões · pendências · arquivos tocados

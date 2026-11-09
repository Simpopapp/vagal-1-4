# project2-s2 — planejamento do subagente s2 (seção de provedor nos ajustes)

## Missão
Construir `ProviderSection.tsx`, a seção da aba de ajustes onde o usuário
escolhe o provedor de IA (padrão, principais provedores com alternativas
grátis, ou URL base própria), cola a chave, carrega a lista de modelos do
provedor e testa a conexão. É a cara visível do project2.

## Escopo
- `src/components/settings/ProviderSection.tsx`: todos os estados do PRD2
  seção 6 (seletor com badge grátis, URL base, chave com mostrar/ocultar,
  carregar modelos com fallback + campo livre, testar conexão, estado salvo).

## Fora do escopo
- Não edita `settings.tsx` (a montagem é do agente principal, G3), nem
  `client.ts`/`generate.ts` (pacote s1), nem `providers.ts`/`repo.ts`/
  `sync.ts`/`types.ts` (contratos já fixados).
- Não instala dependências: primitivos shadcn em `src/components/ui/` bastam.

## Por quê
- PRD2 E3: a nota "a chave fica só neste aparelho" é parte do recurso de
  segurança — o usuário precisa ver isso no lugar onde cola a chave.
- PRD2 E5: a listagem de modelos pode falhar; a UI nunca fica sem saída
  (fallback curado + campo livre).
- P7 do PRD2: o gateway padrão está sem créditos; esta seção é o caminho do
  usuário para voltar a gerar cards — precisa ser clara para quem não é
  técnico.

## Fronteiras
- Consome: `PROVIDERS`, `ProviderConfig`, `getProviderDef` de
  `@/lib/ai/providers`; `get/setProviderConfig`, `get/setProviderKey` de
  `@/lib/db/repo`; `listModels`, `testConnection`, `ProviderError` de
  `@/lib/ai/client` (assinaturas do PRD2 seção 4 — o arquivo é do pacote s1
  e pode estar sendo escrito em paralelo; ver regra de espera no PRD do pacote).
- Entrega: o componente pronto para o agente principal montar em
  `settings.tsx` entre "modo de toque" e "conta".

## Dono exclusivo de
- `src/components/settings/ProviderSection.tsx`
- `src/test/provider-section.test.tsx` (se optar por teste de componente)

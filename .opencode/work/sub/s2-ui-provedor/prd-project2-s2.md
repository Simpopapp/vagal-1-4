# prd-project2-s2 — o COMO do subagente s2 (seção de provedor nos ajustes)

Recorte do PRD central (`.opencode/prd-project2.md`). Onde houver conflito, o
central manda. Leia também `project2.md` e `roadmap-proj2.md` (centrais).

## Decisões centrais que este pacote segue

- **E1**: "Lovable Cloud (padrão)" vem primeiro no seletor; escolhê-la limpa
  URL/modelo customizados mas **preserva** a chave guardada.
- **E3**: a chave é local-only; a nota "a chave fica só neste aparelho" aparece
  junto do campo de chave.
- **E5**: falha na listagem → fallback curado do catálogo + campo livre para
  digitar o modelo. Nunca lista vazia sem saída.
- **Visual**: seguir o padrão das seções vizinhas de `src/routes/settings.tsx`
  (`Card` + `CardHeader` + `CardTitle` + `CardDescription` + `CardContent`),
  texto em pt-BR, tom das seções existentes. Sem cor hardcoded: só classes
  semânticas (`bg-card`, `text-muted-foreground`, `border-border`, etc.).

## Estrutura da seção (PRD2 seção 6)

1. **Seletor de provedor** — `Select` do shadcn com `PROVIDERS`; badge
   "grátis" (`Badge` variant secondary) quando `freeTier`; o padrão marcado
   como "padrão" no rótulo.
2. **URL base** — visível para `custom` (obrigatória) e `ollama`
   (pré-preenchida com a do catálogo, editável). Validar `^https?://` antes de
   salvar; mensagem de erro embaixo do campo quando inválida.
3. **Chave de API** — visível quando `def.needsKey` ou `custom`. `Input`
   `type="password"` com botão mostrar/ocultar (ícones `Eye`/`EyeOff` do
   `lucide-react`), `autoComplete="off"`. Link "onde conseguir a chave" →
   `def.keyUrl` (abre em nova aba) quando houver. Nota com ícone `ShieldCheck`:
   "a chave fica só neste aparelho".
4. **Modelo** — botão "Carregar modelos" chama `listModels(config, key)`;
   carregando mostra spinner (`Loader2` animate-spin); sucesso abre `Select`
   com a lista; falha mostra o motivo e oferece os `fallbackModels` do
   catálogo + opção "digitar manualmente" (Input livre).
5. **Testar conexão** — botão que chama `testConnection`; resultado real:
   sucesso "conectado · N modelos disponíveis" (ícone `CheckCircle2`,
   `text-primary` ou token de sucesso existente), erro mapeado por
   `ProviderError.kind`: `auth` → "chave inválida ou sem permissão",
   `credits` → "sem saldo nesse provedor", `cors` → "sem conexão, ou o
   provedor não aceita chamadas diretas do navegador", `network` → "não foi
   possível conectar", demais → a mensagem do erro.
6. **Estado salvo** — ao montar, ler `getProviderConfig()` e `getProviderKey()`
   em `useEffect` (padrão da página de ajustes); refletir provedor/URL/modelo;
   chave existente aparece como placeholder "••••••••" com botão "remover";
   digitar uma nova substitui.
7. **Persistência** — salvar é imediato (padrão da página: cada escolha grava
   e mostra `toast.success`, como `chooseLevel` faz). Trocar de provedor grava
   `{ provider, baseUrl?, model? }` via `setProviderConfig`; a chave grava via
   `setProviderKey` ao sair do campo (onBlur) ou num botão "salvar chave".

## Regra de espera (pacote paralelo)

`@/lib/ai/client` é do pacote s1 e pode não existir ainda. Se estiver ausente
ou incompleto quando você precisar dele para typecheck: escreva o componente
contra as assinaturas do PRD2 seção 4, e antes de rodar os gates finais
verifique a cada 30s (até 10 min) se `src/lib/ai/client.ts` já exporta
`listModels`, `testConnection` e `ProviderError`. Se ao fim da espera ainda
não existir, declare a pendência no relatório em vez de criar um stub próprio.

## Casos de borda obrigatórios (PRD2 seção 9)

- URL sem `http(s)://` → validação barra antes de salvar, com mensagem.
- Provedor sem `/models` → fallback curado + campo livre.
- Chave com espaços nas pontas → `repo.setProviderKey` já faz trim; a UI não
  precisa repetir, mas deve mostrar a chave salva como "••••••••".
- Config vinda do sync sem chave local → estado "falta a chave neste aparelho"
  (provedor/modelo preenchidos, campo de chave vazio com aviso discreto).

## Gates do pacote

- Componente renderiza todos os estados acima (verificação no browser via
  Playwright se quiser, ou teste de componente com Testing Library — o setup
  já existe em `src/test/setup.ts`; IndexedDB via `fake-indexeddb` como em
  `src/test/local-store.test.ts`).
- `bunx tsgo -b --noEmit` exit 0.
- `rg "bg-\[#|text-\[#" src/components/settings/ProviderSection.tsx` sem
  ocorrências.

## Registro de decisões do subagente

(preencher aqui, numerado, se algo divergir do plano — com justificativa)

## Proibições

- Não editar arquivos fora da lista de dono.
- Não instalar dependências.
- Não criar stub próprio de `client.ts` (regra de espera acima).
- Não perguntar nada ao usuário; decidir e registrar acima.

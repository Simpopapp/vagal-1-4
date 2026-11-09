# Roadmap — remix em andamento (project1)

Fonte de verdade de fases: `.opencode/roadmap-proj1.md`. Este arquivo rastreia o trabalho desta sessão.

## Bloqueio vigente
- AI gateway responde 402 `payment_required` (probe real em 2026-11-09). Bloqueia: F1 `interpret.ts`, geração real de cards, F5 dossiê, pré-marcação.

## Esta sessão — remix iniciado (2026-11-09)
- [x] Migrations do remix conferidas: `drizzle/migrations` só tem `_journal.json` com `entries: []`, sem `.sql` copiados, `schema.ts` no placeholder e 0 linhas no diário do banco → histórico coerente com o banco novo (as 7 tabelas do app já existem nele, com RLS + GRANT conferidos por query)
- [x] Fluxo real no browser verde: busca → "era essa?" → letra do Vagalume → toque na palavra → vocabulário, 0 erros de console
- [x] Corrigido o dobrador de palavras: `rolling` virava `rol` (e `called`→`cal`, `missed`→`mis`, `taller`→`tal`) porque a regra de consoante dobrada valia também para bases que já terminam dobradas. Agora só dobra o que o sufixo criou; `-e` mudo volta só para terminações seguras; comparativos incertos ficam inteiros
- Gates: 13 testes novos em `src/test/lemma.test.ts` · 102 verdes no total · `tsgo` exit 0 · build OK · `Rolling → roll` no vocabulário ao vivo

## Sessão anterior — tudo concluído
- [x] F1: limiares D4 na UI de busca (>=0.85 auto-aceita · 0.55–0.85 "era essa?" · <0.55 pede mais info) + fallbacks de prefixo no resolver
- [x] F1: 7 casos E14 ao vivo verdes (`RUN_LIVE=1`) + 8 testes de decisão
- [x] F3: painel deslizante (vaul) com esqueleto, 3 camadas com cor/ícone, falha com palavra preservada
- [x] F4: worker da fila (backoff 2^n, idempotente, sobrevive reload, pausa sem créditos) + indicador no shell
- [x] F5: listas por música/estágio/frequência + Favoritas/Difíceis/Recém-coletadas + busca
- [x] F6: sessão de prática completa (5 ângulos, veredito corrige synonym-fits, scheduler próprio)
- [x] F7: service worker offline; 7 tabelas `public` com GRANT+RLS (conferido por query); auth email+Google+Lovable; sync idempotente
- [x] Fechamento: 89 testes verdes · tsgo limpo · build OK · fluxo real no browser (busca→letra→5 palavras→vocabulário→prática, 0 erros de console)

## Aberto (bloqueado)
- Geração real de cards/dossiês/interpretação por IA — aguarda créditos de IA no workspace. Toda a máquina (fila, painel, schemas, prompts) já está pronta e testada.

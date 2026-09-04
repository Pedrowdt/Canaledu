# Prompt de implementação — Fase 3: Import estruturado (Cadastro)

> **Pré-requisito:** Fases 1 e 2 concluídas e em produção. Use este prompt
> só depois de aprovação. Cole inteiro numa conversa nova.

## Contexto que você precisa saber antes de tocar em qualquer arquivo

Repositório `Canaledu`. Leia `MVP-CADASTRO.md` (seção 2.5) e
`PROMPT-FASE-1-SCHEMA-FORMULARIO.md`/`PROMPT-FASE-2-MOTOR-DISTRIBUICAO.md`
primeiro — esta fase depende dos campos e da lógica que elas entregaram.
Rode `npm test` e `node db/testar-schema.mjs` antes de começar para
confirmar a base de partida (esperado: tudo verde).

**Releia o fluxo de mão única antes de escrever qualquer código aqui**
(`db/006_pecas_one_way.sql`): só a tela Peças e Programas pode gravar em
`public.pecas`/`public.programas`, e só através de `fn_salvar_pecas`/
`fn_salvar_programas` (não INSERT/UPDATE direto). O import diário roda a
partir da tela do **Roteiro** (`pecas_dia.js`) — qualquer gravação que ele
fizer no cadastro tem que passar pelo mesmo caminho que
`pecas-programas.js` usa (`PecasRepo.saveDelta`), não um atalho.

## O problema atual, exatamente como está hoje

`pecas_dia.js#parsePecasDiaRows()` faz regex numa coluna de observação
livre da planilha diária para descobrir:
- `"PROGRAMAR 3X"` → `qtd` (quantas vezes hoje)
- `"ENTRE 8H E 12H"` (ou similar) → `restricao` (texto livre, não
  estruturado)

Esses dois valores **morrem no fim do dia** — nunca voltam para o
cadastro. Amanhã, se a mesma peça aparecer nas planilhas de novo, o
mesmo parsing roda de novo do zero. O cadastro tem `freq`/`dias`/`hIni`/
`hFim` (Fase 1 já expôs isso na tela de Peças e Programas), mas o import
diário não os usa nem os alimenta.

Separadamente, `mergeBancoFromRoteiro(items)` (em `app.js`, chamada por
`importPecasDiaExcel()`) já adiciona peças NOVAS ao `state.pecas` local —
mas só em memória/`localStorage`, nunca envia ao banco (confirme isso
lendo a função antes de assumir qualquer coisa; se este prompt estiver
desatualizado nesse ponto, corrija a suposição e prossiga com o que o
código realmente faz).

## O que implementar

1. **Ao importar a planilha diária, se a peça já existir no cadastro**
   (código bate com algo em `state.pecas`) **e** o import detectar
   `qtd`/`restricao` estruturáveis (ex.: `"ENTRE 8H E 12H"` vira
   `hIni='08:00'`/`hFim='12:00'`; `"PROGRAMAR 3X"` vira `freq='3'`):
   atualize os campos `freq`/`hIni`/`hFim` dessa peça e envie a
   atualização ao banco via `PecasRepo.saveDelta({ pecas: [...] })` —
   reaproveite a mesma função que `pecas-programas.js` já usa, não crie um
   caminho de escrita paralelo. Trate conflito de `row_version` do mesmo
   jeito que `pecas-programas.js` já trata (mostrar aviso, recarregar).
2. **Se a peça NÃO existir no cadastro**: mantenha o comportamento atual
   (fica só na sessão do dia) — criar peça nova automaticamente a partir
   da planilha **fica fora do escopo desta fase** (decisão explícita do
   MVP original, não expanda sem nova aprovação).
3. **Extraia o parsing de `"ENTRE 8H E 12H"`/`"PROGRAMAR Nx"` para
   `src/core/`** como função pura testável (ex.:
   `parseRestricaoObs(texto) -> {freq, hIni, hFim}`), reaproveitando
   helpers de horário de `src/core/time.js` se servirem. Réplica não-modular
   em `pecas_dia.js`, mesmo padrão do resto do projeto.
4. **Log**: `CanalLog.registrar('cadastro_atualizado_por_import_diario', {...})`
   quando uma atualização estrutural for enviada, para dar visibilidade
   (isso é uma gravação no cadastro compartilhado originada da tela
   errada em termos de UX — vale deixar rastreável).

## O que NÃO fazer

- Não criar peça nova no cadastro automaticamente a partir do import
  diário (só atualizar `freq`/`hIni`/`hFim` de peças que já existem).
- Não contornar `fn_salvar_pecas`/o fluxo de mão única.
- Não mudar o comportamento de `qtd`/`restricao` **dentro da sessão do
  dia** (a lógica de "já usei N vezes hoje" em `pecas_dia.js` continua
  igual — só a origem/persistência de `freq`/`hIni`/`hFim` muda).

## Testes obrigatórios

- `parseRestricaoObs()` pura, testada em `src/core/` com os formatos reais
  usados na planilha (confira exemplos reais em `pecas_dia.js` antes de
  inventar formatos — use os que o parser atual já reconhece como base).
- Teste de que uma peça existente no cadastro tem `freq`/`hIni`/`hFim`
  atualizados após import com dado estruturável, e que isso realmente
  chama `PecasRepo.saveDelta` (mock/spy) — não só muda `state.pecas` local.
- Teste de que peça inexistente no cadastro NÃO dispara nenhuma escrita
  (só fica na sessão do dia, como hoje).
- `npm test` inteiro + `node db/testar-schema.mjs` passando.

## Formato de entrega

Commits pequenos: (1) extrair `parseRestricaoObs` com testes, (2) ligar a
atualização de cadastro no import diário, cada um com `npm test` verde.
Atualize `CHANGELOG.md` e faça o bump de versão com
`node scripts/sync-version.js`.

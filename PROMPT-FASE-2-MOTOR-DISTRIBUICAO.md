# Prompt de implementação — Fase 2: Motor de distribuição (Cadastro)

> **Pré-requisito:** Fase 1 já concluída e em produção (ver
> `PROMPT-FASE-1-SCHEMA-FORMULARIO.md`) — `pecas.funcao`/
> `pecas.programa_relacionado`/`programas.programa_titulo` etc. já existem
> no banco e no formulário, mas **nada ainda os lê** para decidir qual VH
> inserir automaticamente. Use este prompt somente depois de aprovação —
> mexe em lógica que já foi corrigida 2x nesta base de código
> (`matchVhDaquiForNext`, ver `CHANGELOG.md [2.6.0]`), então qualquer
> regressão aqui é sensível. Cole este prompt inteiro numa conversa nova.

## Contexto que você precisa saber antes de tocar em qualquer arquivo

Repositório `Canaledu`. Scripts clássicos sem bundler — leia
`PROMPT-IMPLEMENTACAO-CADASTRO.md`/`MVP-CADASTRO.md` (contexto geral do
projeto) e `AUTENTICACAO.md`/`CONSISTENCIA.md` antes de começar. Rode
`npm test` (deve estar 100% verde, ~131 testes) e `node db/testar-schema.mjs`
antes de mudar qualquer coisa, para confirmar a base de partida.

**IMPORTANTE — leia isto com atenção:** um commit externo recente
(`027f405`, revertido em `2.8.1`) tentou "corrigir concorrência" mexendo em
`app.js#saveState()` sem entender o que essa função faz, e quebrou duas
coisas silenciosamente (undo parou de funcionar; uma função inexistente
passou a ser chamada). **Antes de mudar qualquer função aqui, rode os
testes relacionados a ela e confirme que eles cobrem o comportamento
atual — se não cobrirem, escreva o teste do comportamento ATUAL primeiro,
depois faça a mudança.** Isso vale em dobro para `findVhSeguir`/
`findVhAssistindo`/`matchVhDaquiForNext`/`getVhAssinaturaFor`, que hoje
não têm nenhum teste de integração (só as peças puramente extraídas para
`src/core/` têm).

## As 4 funções a alterar — estado atual exato (não desatualize isto sem checar o código de novo)

Todas em `app.js`, chamadas de dentro de `buildRoteiroFromPrograms()`
(geração automática do roteiro a partir da lista de programas):

1. **`findVhSeguir(desc)`** (linha ~1802) — percorre `VH_SEGUIR_MAP`
   (array hardcoded, ~15 entradas, cada uma com `keywords: [...]`),
   compara `_normalizeProgKey(keyword) === _normalizeProgKey(baseProgramTitle(desc))`
   (igualdade exata, não substring). Retorna `null` se
   `REGRAS.vhSeguirAtivo === false`.
2. **`findVhAssistindo(desc)`** (linha ~1815) — mesmíssima estrutura,
   usando `VH_ASSISTINDO_MAP` e `REGRAS.vhAssistindoAtivo`.
3. **`matchVhDaquiForNext(nextProgramTitle, vhCandidates, minCoverage)`**
   em `pecas_dia.js` (réplica não-modular de
   `src/core/pecasCatalog.js#matchVhDaquiForNext`) — já busca candidatas
   em `state.pecasDia` (que desde a Fase UX anterior já vem do cadastro
   quando nada foi importado manualmente), mas o CASAMENTO em si ainda é
   por cobertura de palavras-chave do título, não por `programa_relacionado`.
4. **`getVhAssinaturaFor`/`pickAssinatura`** (linha ~1827 em diante) — já
   consulta primeiro a tag `assinatura` do cadastro do PROGRAMA (isso já é
   estruturado, não mexer nessa parte), e só cai em keyword-matching
   (`infKw`/`adKw`) para achar a VH da faixa quando não há match direto.

## O que implementar

Para cada uma das 4 funções acima, **antes** do mecanismo atual (que vira
fallback, não é removido), adicionar um passo 0: procurar em `state.pecas`
uma peça com `type === 'EVNH'`, a `funcao` correspondente, e
`programa_relacionado` cujo `_normalizeProgKey()` bata com
`_normalizeProgKey(baseProgramTitle(desc))` do programa atual/próximo.

Tabela de correspondência `funcao` ↔ função atual:

| Função em `app.js` | `funcao` correspondente no cadastro |
|---|---|
| `findVhSeguir` | `vh_a_seguir` |
| `findVhAssistindo` | `vh_voce_esta_assistindo` |
| `matchVhDaquiForNext` (via `pecas_dia.js`) | `vh_daqui_a_pouco` |
| `getVhAssinaturaFor` (parte de keyword, não a parte de tag) | `assinatura_infantil`/`_jovem`/`_adulto`/`_padrao` conforme a faixa já decidida |

Pseudocódigo do novo `findVhSeguir` (mesma ideia para `findVhAssistindo`):

```js
function findVhSeguir(desc) {
  if (REGRAS.vhSeguirAtivo === false) return null;
  const baseTitle = _normalizeProgKey(baseProgramTitle(desc));
  if (!baseTitle) return null;

  // Passo 0 (Fase 2, novo): cadastro estruturado primeiro.
  const doCadastro = (state.pecas || []).find(p =>
    p.type === 'EVNH' && p.funcao === 'vh_a_seguir' &&
    p.programaRelacionado && _normalizeProgKey(p.programaRelacionado) === baseTitle
  );
  if (doCadastro) {
    if (window.CanalLog) CanalLog.registrar('vh_resolvida_por_cadastro', { funcao: 'vh_a_seguir', programa: baseTitle });
    return { code: doCadastro.code, descricao: doCadastro.descricao, tempo: doCadastro.tempo, midia: doCadastro.midia, type: 'EVNH' };
  }

  // Passo 1 (existente, inalterado): VH_SEGUIR_MAP hardcoded.
  for (const vh of VH_SEGUIR_MAP) {
    if (vh.keywords.some(k => _normalizeProgKey(k) === baseTitle)) return {...vh};
  }
  return null;
}
```

Para `matchVhDaquiForNext` (em `src/core/pecasCatalog.js`, com réplica em
`pecas_dia.js`): adicionar um parâmetro/passo equivalente ANTES do
casamento por cobertura de palavras — se alguma candidata tiver
`funcao === 'vh_daqui_a_pouco'` e `programaRelacionado` batendo
exatamente com o título normalizado do próximo programa, retorná-la direto
(sem rodar o algoritmo de cobertura). Preserve a assinatura da função
(não quebre `tests/unit/pecasDia.test.mjs`/`pecasCatalog.test.js`
existentes — são o contrato do fallback).

## O que NÃO fazer

- Não apagar `VH_SEGUIR_MAP`/`VH_ASSISTINDO_MAP` (Fase 4).
- Não mudar a ordem "tag do programa decide a faixa de assinatura" em
  `getVhAssinaturaFor` — isso já é estruturado e correto, só o
  keyword-matching residual (achar a VH daquela faixa) ganha o passo novo.
- Não tocar em `app.js#saveState()` — não tem relação com esta fase (ver
  aviso no topo deste arquivo sobre o `027f405`).
- Não mudar o formato de retorno das 4 funções (código a jusante espera
  `{code, descricao, tempo, midia, type}`).

## Testes obrigatórios

- Para cada uma das 4 funções: um caso onde `funcao`/`programa_relacionado`
  resolve direto pelo cadastro (e idealmente confirmar, via um contador ou
  mock de `CanalLog`, que o caminho novo foi de fato usado); um caso sem
  os campos novos preenchidos que cai no fallback e continua batendo com
  o comportamento pré-Fase-2 (rode os testes já existentes de
  `matchVhDaquiForNext`/`pecasDia.test.mjs` sem alterar as expectativas —
  eles são a prova de que o fallback não regrediu).
- Um teste de "duas peças no cadastro com a mesma `funcao` + mesmo
  `programa_relacionado`" — defina e documente o desempate (ex.: a
  primeira por `ordem`, ou erro/log de aviso; não deixe indefinido).
- `npm test` inteiro (131 testes hoje) + `node db/testar-schema.mjs`
  passando antes de considerar concluído.

## Formato de entrega

Um commit por função alterada (`findVhSeguir`, `findVhAssistindo`,
`matchVhDaquiForNext`, `getVhAssinaturaFor`), cada um com teste e
`npm test` verde antes do próximo. Atualize `CHANGELOG.md` (nova entrada,
formato das anteriores) e faça o bump de versão com
`node scripts/sync-version.js` depois de editar `package.json` — não edite
`version.js`/`version.txt` à mão.

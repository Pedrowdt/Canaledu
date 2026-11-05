# Prompt de implementação — Fase 4: Limpeza (Cadastro)

> **Pré-requisito, sem exceção:** Fases 1, 2 e 3 concluídas e **rodando em
> produção por um tempo razoável** (o MVP-CADASTRO.md sugere isso
> explicitamente — não é uma etapa técnica, é uma janela de confiança nos
> dados). Antes de abrir este prompt, confirme com quem cadastra que as
> peças ativas do tipo `EVNH` já têm `funcao` preenchida — se não tiverem,
> pare e volte para a Fase 2/3, esta fase vai apagar o fallback que ainda
> está em uso. Cole inteiro numa conversa nova só depois dessa confirmação.

## Contexto que você precisa saber antes de tocar em qualquer arquivo

Repositório `Canaledu`. Leia `MVP-CADASTRO.md` e os três prompts
anteriores (`PROMPT-FASE-1`, `PROMPT-FASE-2`, `PROMPT-FASE-3`) — esta fase
só remove o que elas tornaram redundante, não adiciona nada novo.

## Antes de remover qualquer coisa: meça

1. Rode uma consulta (via `pecas-programas.js` ou diretamente no
   Supabase) contando quantas peças `type='EVNH' AND ativo` têm
   `funcao IS NULL` — essas são as que ainda dependeriam do fallback de
   texto se ele for removido. Se esse número não for zero (ou muito
   próximo de zero, com justificativa), **não prossiga** — volte e
   cadastre/corrija essas peças primeiro, ou adicione um aviso na UI
   listando quais peças precisam de atenção antes de continuar.
2. Se `CanalLog` já tiver registrado eventos `vh_resolvida_por_cadastro`
   (adicionados na Fase 2) vs. o caminho de fallback nunca logado — use
   isso como evidência adicional de quanto do catálogo real já migrou.

## O que remover, só depois da medição acima confirmar que é seguro

1. **`VH_SEGUIR_MAP`/`VH_ASSISTINDO_MAP`** (arrays hardcoded em `app.js`,
   ~30 entradas somadas) — remover completamente, junto com o código de
   fallback em `findVhSeguir`/`findVhAssistindo` que os consultava (o
   passo 0 da Fase 2, que consulta `state.pecas`, vira o único caminho).
2. **A parte de `data.js` (`INITIAL_PECAS`/`INITIAL_PROGRAMAS`) que usa a
   taxonomia de categoria antiga** (`"MANUTS FAIXAS"`,
   `"FAIXA INFANTIL - \"DAQUI A POUCO\""`, etc., ~16 valores distintos,
   ver `ANALISE.md` seção 1.4) — migre para a lista de `categoria` unificada
   que ficou definida (fora do escopo deste prompt decidir qual é essa
   lista final; se `MVP-CADASTRO.md` seção 2.4 ainda não tiver sido
   fechada com a equipe, pare e resolva isso antes, não invente a lista
   aqui).
3. Qualquer `keywords: [...]`/matching residual por texto que sobrar nas
   4 funções da Fase 2, se a Fase 2 tiver deixado algo como fallback
   condicional em vez de já ter removido.

## O que NÃO remover

- `matchVhDaquiForNext`'s cobertura por palavra-chave (Fase 2 manteve como
  fallback) — só remova se a mesma medição do passo 1 acima mostrar que
  todas as peças ativas relevantes já têm `funcao='vh_daqui_a_pouco'` +
  `programa_relacionado` preenchidos.
- `data.js` inteiro — ele continua servindo como seed/fallback offline
  quando não há sessão/banco disponível; só a taxonomia de categoria
  precisa ser corrigida, não a existência do arquivo.
- Nenhuma tabela/coluna do banco — esta fase é limpeza de código
  JavaScript, não uma migração de schema (as colunas antigas continuam
  existindo; só o código que as ignorava em favor do hardcode é que sai).

## Testes obrigatórios

- Remova/atualize os testes que hoje cobrem o comportamento de fallback
  de `VH_SEGUIR_MAP`/`VH_ASSISTINDO_MAP` (se algum teste depender
  especificamente do array hardcoded, ele precisa mudar para depender só
  do cadastro).
- Adicione um teste que falhe se `VH_SEGUIR_MAP`/`VH_ASSISTINDO_MAP`
  reaparecerem no arquivo (grep simples num teste, tipo o que já existe
  para outras verificações de higiene neste projeto) — trava a decisão
  desta fase contra reintrodução acidental.
- `npm test` inteiro + `node db/testar-schema.mjs` passando.

## Formato de entrega

Um commit por remoção (VH maps, depois taxonomia de `data.js`), cada um
antecedido pela medição do passo "Antes de remover qualquer coisa"
documentada na mensagem do commit (quantas peças estavam sem `funcao` no
momento da remoção — para auditoria futura). Atualize `CHANGELOG.md` e
faça o bump de versão com `node scripts/sync-version.js`.

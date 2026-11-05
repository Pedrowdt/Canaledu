# Prompt — Fase 1: Schema + Formulário (Cadastro)

> ✅ **CONCLUÍDA** — implementada e commitada (`0f2ccd4`/aplicada como
> `a50c3d2` no histórico real do repositório, versão `2.8.0`). Este arquivo
> fica como registro do que foi pedido e do que foi de fato entregue —
> não precisa ser reaplicado. Mantido separado dos prompts das fases 2-4
> (que ainda não foram implementadas) a pedido explícito de manter um
> arquivo por fase.

## O que foi pedido

Ver `MVP-CADASTRO.md`, seção 4, linha "Fase 1": migração aditiva
(`funcao`, `programa_relacionado`, `programa_titulo`/`temporada`/
`episodio`/`bloco`) + campos novos no formulário só quando
`type=EVNH`/`RPRO`, com fallback total para peças sem os campos novos.

## O que foi entregue

- **`db/007_funcao_peca.sql`**: enum `peca_funcao` (12 valores);
  `pecas.funcao`/`pecas.programa_relacionado`; `programas.programa_titulo`/
  `temporada`/`episodio`/`bloco`; `fn_funcao_safe()` (mesmo padrão de
  `fn_categoria_safe`); `fn_salvar_pecas`/`fn_salvar_programas`/
  `v_pecas_roteiro`/`v_programas_roteiro` redefinidas para reconhecer os
  campos novos. Validado 2x seguidas contra Postgres real (PGlite) via
  `db/testar-schema.mjs`, que passou a aplicar `004`-`007` (antes só
  testava `001`-`003`).
- **`pecas-programas.html`/`.js`**: campo "Função da vinheta" (visível só
  quando `type=EVNH`) e "Programa relacionado" (visível só para funções que
  referenciam um programa), com sugestão automática via `<datalist>` dos
  programas já cadastrados. `programa_titulo`/`temporada`/`episodio`/
  `bloco` calculados automaticamente da descrição ao salvar um programa.
  Selo discreto ("📋 função · programa") na tabela para peças classificadas.
- **`src/core/pecasCatalog.js`**: `baseProgramTitle`/`getEpisodeId`/
  `parseEpisodioInfo` extraídas de `app.js` (onde já existiam sem teste),
  agora testadas (`src/core/pecasCatalog.test.js`) e replicadas de forma
  não-modular em `pecas-programas.js`.
- **`pecas-repo.js`**: `pecaFromRow`/`pecaToRow`/`programaFromRow`/
  `programaToRow` mapeando os campos novos entre JS (camelCase) e banco
  (snake_case) — sem isso as colunas existiriam mas nunca seriam lidas/
  gravadas pela Data API.

## O que NÃO foi feito (por escopo — fica para as próximas fases)

- `app.js#VH_SEGUIR_MAP`/`VH_ASSISTINDO_MAP` continuam exatamente como
  estavam — nenhuma automação do Roteiro consulta os campos novos ainda.
  Isso é a **Fase 2** (`PROMPT-FASE-2-MOTOR-DISTRIBUICAO.md`).
- O import diário de planilha (`pecas_dia.js`) continua sem gravar
  `freq`/`dias`/`hIni`/`hFim` de volta no cadastro. Isso é a **Fase 3**
  (`PROMPT-FASE-3-IMPORT-ESTRUTURADO.md`).
- Nada foi removido do código antigo. Isso é a **Fase 4**
  (`PROMPT-FASE-4-LIMPEZA.md`).

## Testes que comprovam a entrega

`src/core/pecasCatalog.test.js` (8 casos: `baseProgramTitle`/
`getEpisodeId`/`parseEpisodioInfo`) e
`tests/unit/pecasProgramasFuncao.test.mjs` (8 casos: gravação condicional
por `type`/`funcao`, cálculo automático dos campos de episódio,
visibilidade dos campos no formulário, restauração ao editar). Suíte
completa: 127 testes passando no momento da entrega desta fase (crescido
para 131 depois, com a correção de `saveState()` — ver
`CHANGELOG.md [2.8.1]`, sem relação com esta fase).

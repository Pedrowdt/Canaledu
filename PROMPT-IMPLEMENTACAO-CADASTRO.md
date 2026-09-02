# Prompt de implementação — MVP Cadastro (Canaledu)

> **Use este prompt somente depois que `MVP-CADASTRO.md` (na raiz do
> repositório) tiver sido aprovado — inclusive a lista final de categorias
> unificadas da seção 2.4, que este documento propositalmente deixa em
> aberto para validação com quem cadastra hoje.** Cole este prompt inteiro
> numa conversa nova com a LLM/agente que for implementar.

## Contexto que você precisa saber antes de tocar em qualquer arquivo

Este é o repositório `Canaledu` (Roteiro Canal Educação): duas telas HTML
sem bundler — `index.html`/`app.js` (Roteiro) e `pecas-programas.html`/
`pecas-programas.js` (Cadastro) — mais scripts clássicos carregados
dinamicamente (`cloud-sync.js` injeta `data.js`, `pecas_dia.js`, `app.js`,
etc. via `<script>`). Supabase/Postgres no backend, migrações versionadas em
`db/001_pecas_programas.sql` até `db/006_pecas_one_way.sql`. Lógica de
negócio pura e testada mora em `src/core/*.js` (Vitest); os scripts
clássicos (`app.js`, `pecas_dia.js`) mantêm **réplicas não-modulares** das
mesmas funções porque não podem usar `import`/`export` — é um padrão
deliberado do projeto, siga-o (não introduza um bundler nesta tarefa).

Leia antes de começar: `MVP-CADASTRO.md`, `db/README.md`, `AUTENTICACAO.md`,
`CONSISTENCIA.md`, e o arquivo `006_pecas_one_way.sql` (entenda o guard de
escopo — só a tela Peças e Programas pode escrever no cadastro; qualquer
mudança de schema/gravação precisa respeitar isso).

## O que implementar (Fase 1 + Fase 2 do MVP — não faça a 3 e 4 sem novo aval)

### 1. Migração de banco: `db/007_funcao_peca.sql`
Aditiva, reversível, sem quebrar nada existente:
- `alter table public.pecas add column if not exists funcao text;`
  (nullable — sem valor, comportamento idêntico ao atual)
  - `check (funcao is null or funcao in ('assinatura_infantil','assinatura_jovem','assinatura_adulto','assinatura_padrao','vh_a_seguir','vh_daqui_a_pouco','vh_voce_esta_assistindo','classificacao_indicativa','cartela_oficial','vinheta_id','transicao','outro'))`
- `alter table public.pecas add column if not exists programa_relacionado text;`
  (guarda o `code` de um `programas` — sem FK rígida, porque `code` de
  programa muda por episódio; ver seção 3 sobre como resolver isso)
- `alter table public.programas add column if not exists programa_titulo text, add column if not exists temporada int, add column if not exists episodio int, add column if not exists bloco int;`
- Atualize `db/testar-schema.mjs` para aplicar esta migração também (hoje só
  aplica 001-003 — gap já documentado em `ANALISE.md`, seção "Achado novo
  #1"; corrija isso *nesta* tarefa, já que você vai mexer em `pecas`/
  `programas` mesmo).
- Teste de schema: inserir uma peça com `funcao` inválido deve falhar
  (constraint), com `funcao=null` deve funcionar exatamente como hoje.

### 2. Formulário de cadastro (`pecas-programas.html` + `.js`)
- Quando `f-type === 'EVNH'`: mostrar um novo campo `f-funcao` (select com
  o enum acima, rotulado em português, default vazio = "outro/não
  classificado" = comportamento atual).
- Quando `f-funcao` for um dos valores que referenciam programa
  (`vh_a_seguir`, `vh_daqui_a_pouco`, `vh_voce_esta_assistindo`,
  `assinatura_*`): mostrar `f-programa-relacionado`, um campo de busca
  (`<input list="...">` ou autocomplete simples) que sugere entre os
  `programas` já cadastrados, casando pelo `programa_titulo` normalizado
  (reaproveite `baseProgramTitle()`/`_normalizeProgKey()` já existentes em
  `app.js` — replique-as no `pecas-programas.js` seguindo o padrão de
  réplica não-modular já visto em `pecas_dia.js`/`roteiro-pecas-bridge.js`).
  Grave o `programa_titulo` normalizado, não o `code` do episódio (o code
  muda a cada episódio importado; o título normalizado é estável).
- No import de programas (CSV/planilha), extraia `programa_titulo`/
  `temporada`/`episodio`/`bloco` usando a MESMA lógica de
  `baseProgramTitle()`/`getEpisodeId()` já existente em `app.js` — não
  reescreva o parsing, extraia-o para `src/core/` como função pura testável
  e replique nos dois lugares (app.js e pecas-programas.js), do jeito que
  já foi feito para `parseValidade`/`matchVhDaquiForNext` nesta sessão.
- Escape de XSS: qualquer novo campo de texto exibido em tabela precisa
  passar por `escapeHtml()` (já existe no arquivo — regressão corrigida
  recentemente, não reintroduza o problema nos campos novos).

### 3. Motor de distribuição (`app.js`, `pecas_dia.js`)
Ordem de resolução em `findVhSeguir`/`findVhAssistindo`/
`matchVhDaquiForNext`/`findVhAssinaturaFor` (não remova o fallback):
1. **Primeiro**, procurar no cadastro (`state.pecas`) uma peça com
   `type='EVNH'`, `funcao` correspondente, e `programa_relacionado` batendo
   com `baseProgramTitle()` normalizado do programa atual/próximo.
2. **Se não achar nada assim**, cair no mecanismo atual (`VH_SEGUIR_MAP`/
   `VH_ASSISTINDO_MAP`/keywords/`matchVhDaquiForNext` como já implementado).
3. Log opcional (`CanalLog.registrar`) quando o caminho 1 resolve, para dar
   visibilidade de quanto do catálogo já migrou para o campo estruturado.

Não apague `VH_SEGUIR_MAP`/`VH_ASSISTINDO_MAP` nesta tarefa — isso é Fase 4,
só depois que o cadastro real tiver dados suficientes em `funcao`.

### 4. Import diário grava de volta no cadastro (`pecas_dia.js`)
Hoje `parsePecasDiaRows()` faz regex na coluna de observação para achar
"PROGRAMAR Nx" (→ `qtd`) e janelas tipo "ENTRE 8H E 12H" (→ `restricao`
livre). Extraia isso para `freq`/`hIni`/`hFim`/`dias` estruturados
(reaproveite os helpers de horário já existentes em `src/core/time.js` se
servirem) e, ao importar, se a peça já existir no cadastro (`code` bate),
atualize esses campos lá — respeitando o fluxo de mão única: isso é uma
gravação em `pecas`, então tem que passar pelo caminho que
`006_pecas_one_way.sql` já exige (função `fn_salvar_pecas`, não update
direto). Se a peça ainda não existir no cadastro, mantenha o comportamento
atual (fica só na sessão do dia, como hoje) — criar peça nova automaticamente
fica fora do escopo desta tarefa.

## Testes obrigatórios (não terminar sem isso)

- `src/core/` ganha `baseProgramTitle`/`getEpisodeId` extraídas como funções
  puras com testes (hoje só existem dentro de `app.js`, sem cobertura).
- Teste de schema (`db/testar-schema.mjs` estendido): constraint de `funcao`
  válida, `funcao=null` não quebra nada, `programa_relacionado` sem FK
  rígida mas documentado o porquê.
- Testes de regressão para os 3 pontos do motor de distribuição (seção 3):
  caso com `funcao`/`programa_relacionado` preenchidos (resolve pelo campo
  novo), caso sem eles preenchidos (cai no fallback, comportamento
  idêntico ao pré-mudança — rode os testes já existentes de
  `matchVhDaquiForNext`/`pecasDia.test.mjs` sem alteração, eles têm que
  continuar passando exatamente como estão).
- `npm test` inteiro passando (hoje: 112 testes) antes de considerar
  concluído.

## O que NÃO fazer nesta tarefa

- Não mexer na lista de `categoria` (seção 2.4 do MVP) — está
  propositalmente fora de escopo até validação com quem cadastra hoje.
- Não apagar `VH_SEGUIR_MAP`/`VH_ASSISTINDO_MAP`/dados de `data.js` (Fase 4).
- Não introduzir bundler/ES modules nos scripts clássicos.
- Não mudar `type` (`ECHE/ECHM/RCOM/RPOL/EINT/EVNH/RPRO`) — é metadado do
  sistema de automação externo, fora do controle deste projeto.
- Não fazer `git push` sem antes rodar `npm test` e confirmar 100% verde.

## Formato de entrega esperado

Commits pequenos e reversíveis, um por item da lista acima (schema, depois
formulário, depois motor de distribuição, depois import), cada um com
`npm test` passando antes do próximo. Atualize `CHANGELOG.md` com uma nova
entrada (siga o formato das entradas anteriores) e bump de versão em
`package.json`/`version.js`/`version.txt` juntos (use
`node scripts/sync-version.js` depois do bump em `package.json` — não edite
`version.js`/`version.txt` à mão).

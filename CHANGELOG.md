# Changelog

## [2.6.1] — Peças e Programas não perde mais alterações (inclusive exclusões) ao recarregar a página

### Corrigido
- **Exclusões e edições revertidas quando a página recarrega antes do envio.**
  Em `pecas-programas.js`, tudo que ainda não tinha sido gravado no banco
  (`pecas`, `programas`, `deletedPecas`, `deletedProgramas`) só existia em
  memória, e `scheduleSync()` só envia 700ms depois da última mudança. Se a
  página recarregasse nesse meio-tempo — o caso relatado foi **outra pessoa
  fazendo login no mesmo navegador**, o que troca a sessão do Supabase Auth
  e dispara `SIGNED_OUT`, que já tinha um `location.reload()` automático e
  incondicional — tudo que ainda não tinha sido confirmado no banco era
  descartado em silêncio. Como o `DELETE` nunca chegava a sair, a peça
  excluída simplesmente "voltava" depois do reload.
  - `scheduleSync()` agora grava um rascunho (`persistirRascunho()`) em
    `localStorage` de forma **síncrona**, antes do debounce — sobrevive a
    um reload porque não depende de nada em memória.
  - `startApp()` verifica essa marca ao carregar
    (`restaurarRascunhoPendenteSeExistir()`): se houver um rascunho não
    confirmado, ele **prevalece** sobre o que acabou de vir da nuvem, e o
    reenvio é agendado na hora — em vez de a peça excluída reaparecer, a
    exclusão pendente é recuperada e reenviada. Qualquer edição concorrente
    de outra pessoa nesse meio-tempo continua protegida pelo controle de
    conflito por `row_version` que `pushToCloud()` já tinha.
  - O handler de `SIGNED_OUT` agora tenta `flushPendingSync()` (cancela o
    debounce e envia na hora) antes do `location.reload()` — melhor esforço,
    já que a sessão pode não ser mais válida nesse ponto; a proteção real é
    o rascunho em `localStorage`, não essa tentativa. Um listener de
    `pagehide` cobre fechar a aba/navegar para fora com algo ainda agendado.
  - `limparRascunho()` some assim que `pushToCloud()` confirma a gravação.
  - Testado em `tests/unit/pecasProgramasRascunho.test.mjs`, incluindo o
    cenário exato do bug (exclusão pendente recuperada em vez de "voltar").

## [2.6.0] — Validade em ISO ponta a ponta, VH "Daqui a Pouco" correta, Roteiro não perde mais trabalho ao trocar de tela, e log/desfazer/ordenação no Roteiro

> **Nota de versionamento:** `package.json`, `version.js` e `version.txt` estavam
> presos em `2.2.0` desde o commit `2b2c848` (autenticação peças), mesmo com este
> `CHANGELOG.md` já documentando as releases `2.4.1` e `2.5.0` nos commits
> seguintes — o bump de versão (`npm run release`) não tinha sido rodado. Esta
> release corrige esse descompasso, junto com o trabalho novo abaixo.

### Corrigido
- **Data de validade (kill date) — formato único ISO.** O cadastro (Peças e
  Programas) sempre gravou `validade` em `AAAA-MM-DD` (nativo de
  `input[type=date]`), mas o Roteiro só reconhecia `dd/mm/aa(aa)` — uma peça
  vencida (`validade: "2026-08-04"`) nunca era marcada como VENCIDA, e o card
  mostrava a data em formato ISO cru. Novo helper único em
  `src/core/normalize.js` (`parseValidade`/`validadeToISO`/`formatValidade`/
  `isValidadeExpired`, cobertos por `src/core/normalize.test.js`), replicado
  de forma não-modular em `app.js` (`isExpired()`), `roteiro-pecas-bridge.js`
  (`combinar()` normaliza para ISO tanto o cadastro remoto quanto o snapshot
  local e a fila de pendências) e `pecas_dia.js` (o import de Excel agora
  grava `validade` sempre em ISO, e a heurística de "restrição" usa o parser
  em vez de uma regex de `DD/MM/AA`). Nenhuma migração de banco necessária —
  a coluna já era `date`, a divergência era só de formatação em JS.
- **VH "Daqui a Pouco" inserindo o programa errado.** O casamento com o
  próximo programa aceitava "1 palavra qualquer bate" e escolhia a primeira
  VH da lista, ignorava pontuação (`PORTUGUÊS DAQUI, PORTUGUÊS DE LÁ` nunca
  casava por causa da vírgula) e tinha uma stop list curta e com duplicata.
  Nova função pura e testável `matchVhDaquiForNext()` em
  `src/core/pecasCatalog.js` — normaliza pontuação, remove o prefixo `VH
  DAQUI A POUCO` com regex ancorada (não `replace` de substring), exige
  cobertura mínima (≥70%) das palavras significativas do título e escolhe a
  **melhor** candidata, não a primeira; empate ou cobertura insuficiente ⇒
  não insere nada. `pecas_dia.js#findVhDaquiForNext()` delega para uma
  réplica não-modular da mesma função.
- **Roteiro "some" ao trocar para Peças e Programas e voltar.** Condição de
  corrida: cada edição só sobe à nuvem depois de um debounce de 900ms
  (`cloud-sync.js`), e trocar de tela é navegação de página cheia
  (`location.href`), que mata esse timer sem aviso. Se o clique acontecesse
  antes dos 900ms — o caso mais comum — o envio nunca ocorria, e ao voltar
  `fetchAndMergeCloudData()` confiava cegamente em `userRow.roteiros` (nuvem)
  mesmo estando desatualizado, apagando a edição que não teve tempo de subir.
  Corrigido em duas partes: (1) toda edição grava uma marca síncrona de
  "sincronização pendente" no `localStorage` **antes** do debounce — nova
  `flushPendingSync()`, aguardada por `cloudSyncOpenPecasProgramas()` antes
  de trocar de página, com um listener de `pagehide` como rede de segurança;
  (2) se essa marca ainda existir ao recarregar a página,
  `fetchAndMergeCloudData()` inverte a precedência (local vence a nuvem para
  `roteiros`/`pecas_dia`) e reenvia automaticamente. Testado em
  `tests/unit/cloudSyncRoteiro.test.mjs`.

### Adicionado
- **Log de atividades no Roteiro.** Botão 🕘 no topbar abre o mesmo painel de
  log já existente em Peças e Programas (filtros por tela/nível, atualização
  em tempo real via `window.CanalLog`), estilizado no tema escuro do
  Roteiro. `CanalLog.registrar(...)` passou a ser chamado em
  `addToRoteiro`, `removeItem`, `clearRoteiro` e `undoLastAction` para o log
  do Roteiro não ficar vazio.
- **Desfazer última ação.** Botão "↺ Refazer última ação" na barra de
  ferramentas do Roteiro. `saveState()` (ponto único de toda gravação real)
  empilha, por dia, o estado imediatamente anterior sempre que o conteúdo
  muda de fato (`registrarUndoSeMudou`), num histórico em memória (até 50
  níveis, escopo de sessão). `undoLastAction()`/`popUndoEntry()` restauram a
  versão anterior gravando direto no `localStorage`, sem passar de novo por
  `saveState()` — cliques repetidos andam de verdade para trás no histórico.
- **Ordenação da sidebar por tempo.** Botões ⏱ Menor ↑ / ⏱ Maior ↓ na sidebar
  do Roteiro (`sortPecasByTempo()`); clicar no botão já ativo desliga a
  ordenação. Testado, junto com o item acima, em
  `tests/unit/appRoteiroFeatures.test.mjs`.

## [2.5.0] — Assinatura decidida pelo cadastro do programa (tag Infantil/Jovem/Adulto)

A VH de assinatura inserida ao fim de cada programa (`ASSINATURA_INFANTIL`,
`ASSINATURA_JOVEM`, `ASSINATURA_ADULTO`) passa a obedecer à **tag marcada no
cadastro do programa**, na instância **Peças e Programas** (campo `Assinatura`,
coluna `public.programas.assinatura`, enum `faixa_assinatura`).

As regras do painel Admin do Roteiro (mapa "Classificação por Programa" e as
listas de palavras-chave) continuam existindo, mas viraram **fallback**.

### Nova ordem de decisão
| # | Origem | Papel |
|---|---|---|
| 0 | Tag `assinatura` do programa cadastrado | **Decisória** |
| 1 | `classificacaoPrograma` (modal do Admin) | Fallback |
| 2 | `vhAssinatura*Keywords` (Admin) | Fallback |
| 3 | Padrão `jovem` | Fallback |

O cadastro decide **qual** faixa; as REGRAS do Admin seguem decidindo **como** a
vinheta entra (code, descrição, tempo e liga/desliga por faixa).

### Adicionado
- `assinatura-programa.js` — módulo UMD puro (navegador + Node) com o casamento
  programa↔cadastro (por `code` e por título base normalizado), a cadeia de
  prioridade e a montagem da VH. Devolve também a origem da decisão
  (`cadastro` | `admin` | `keywords` | `padrao`) em `_assinaturaOrigem`.
- `tests/unit/assinaturaPrograma.test.mjs` — 10 casos cobrindo tag vence Admin,
  match por título sem code, programa inativo, os três fallbacks e `ativo:false`.

### Alterado
- `app.js` — `getAssinatura()/pickAssinatura()` consultam primeiro o cadastro
  (`state.programas`); o caminho antigo permanece como rota de segurança caso o
  novo script não esteja carregado. `pickAssinatura` passa a receber o bloco
  inteiro, o que permite casar por `code`.
- `src/core/roteiroBuilder.js` — `pickAssinatura(bloco, regras, programasCadastro)`
  e novo parâmetro `programasCadastro` em `buildRoteiroFromPrograms(...)`
  (7º argumento, opcional — chamadas existentes seguem válidas). Exporta
  `faixaDoCadastro`.
- `index.html` — carrega `assinatura-programa.js` e o modal do Admin agora se
  identifica explicitamente como fallback.
- `pecas-programas.html` — o campo Assinatura informa que rege a VH no Roteiro.

### Compatibilidade
Programa sem tag, inativo ou ausente do cadastro → comportamento idêntico ao
anterior. Nenhuma migração de banco é necessária: a coluna `assinatura` já
existia em `db/001_pecas_programas.sql` e já era lida por `pecas-repo.js`.

## [2.4.1] — Reconciliação: corrida de tempo real na tela de Cadastro/grade + consolidação do log

O commit anterior (`patch resolução de bug`) já havia corrigido uma causa raiz das
"peças sumindo" (o editor de peças embutido no Roteiro nunca sincronizava — ver
`CadastroSync`/`canal-log.js`/`roteiro-pecas-bridge.js`). Esta versão corrige uma
**segunda causa raiz, diferente e complementar**, e consolida o sistema de log que
tinha sido desenvolvido em paralelo por duas frentes de trabalho. Detalhes completos em
`DOCUMENTACAO.md` §6.

### Corrigido
- **Tela de Cadastro (`pecas-programas.js`):** ao salvar uma peça, o envio à nuvem é
  adiado (~700ms de debounce). Se, nesse intervalo, chegasse uma atualização de tempo
  real de outro usuário, a tela recarregava o cadastro inteiro e sobrescrevia
  `pecas`/`programas` — apagando a edição que ainda não tinha sido enviada. Agora o
  listener de tempo real verifica se há uma gravação local pendente
  (`temAlteracoesPendentes()`) antes de recarregar.
- **Grade do Roteiro (`cloud-sync.js`):** mesmo padrão de corrida, mas para
  `app.grade`/`gradeByDay`/`gradeOrder`/`gradeOrderByDay` — o patch anterior já protegia
  `pecas`/`programas` (via `RoteiroPecasBridge.combinar`), mas não a grade. Mesma
  correção aplicada.
- `src/core/roteiroBuilder.js` estava **vazio** (só existia o teste) — implementado
  como função pura, com a mesma lógica de negócio de `app.js#buildRoteiroFromPrograms`.
- `src/core/validator.test.js` tinha uma asserção que comparava um array com
  `.toContain(string)` (checa item exato, não substring) — corrigida.
- `tests/unit/multiusuario.test.mjs` tinha sido commitado na raiz do repositório em vez
  de `tests/unit/` — o padrão de include do `vitest.config.js` não o coletava, então
  esses 4 testes nunca rodavam. Movido para o lugar certo.

### Adicionado
- `db/004_activity_log.sql` — a migração da tabela `public.activity_log`, referenciada
  em `canal-log.js` desde que o módulo foi criado, mas nunca commitada.
- `canal-log.js`: captura automática de erros não tratados (`window.onerror`,
  `unhandledrejection`) e `CanalLog.onNovaEntrada()` (assinatura de tempo real).
- **Modal "Log de atividades"** em `pecas-programas.html` (botão 🕘 Log): lista as
  últimas entradas de `CanalLog`, com filtro por tela/nível e atualização ao vivo.
- `.gitignore` (faltava — `node_modules/` não era ignorado).

### Removido
- `bun.lock` — lockfile de uma ferramenta não usada pelo projeto (que usa `npm`);
  tê-lo junto com `package-lock.json` arriscava os dois divergirem.

> Este changelog documenta uma reconciliação: as mudanças de "Corrigido"/"Adicionado"
> desta versão foram desenvolvidas sem visibilidade do patch anterior (que chegou ao
> `main` enquanto este trabalho estava em andamento). Nenhuma sobrescreve a outra — são
> complementares, ver `DOCUMENTACAO.md` §6 para a explicação completa.

## [2.2.0] — Autenticação única e persistência garantida no roteiro

### Adicionado
- `auth.js` — módulo único de autenticação (`window.CanalAuth`): cliente
  Supabase singleton, restauração de sessão com retentativas, login/logout,
  tradução de erros, `returnTo` protegido contra open redirect.
- `roteiro-pecas-bridge.js` — ponte que faz o cadastro de Peças e Programas
  ser a fonte da verdade do banco de peças usado na confecção do roteiro.
- `db/004_autenticacao.sql` — revoga acesso do papel anônimo ao cadastro e
  registra `created_by` / `updated_by` por linha.
- Testes: `tests/unit/auth.test.mjs` (16) e
  `tests/unit/roteiroPersistencia.test.mjs` (7).
- `AUTENTICACAO.md` — documentação do fluxo de acesso e de persistência.

### Alterado
- `cloud-sync.js` e `pecas-programas.js` passam a usar `CanalAuth` (fim dos
  dois clientes Supabase concorrentes) e o cadastro relacional como fonte.
- Tempo real também escuta as tabelas `pecas`/`programas`.

## [1.2.0] — Consistência multiusuário

- `db/003_consistencia.sql`: `row_version` (optimistic locking), RPCs
  `fn_salvar_pecas`/`fn_salvar_programas` com gravação por delta e detecção de
  conflito, guarda em `shared_data` contra snapshots antigos.
- `pecas-repo.js`: gravação incremental por baseline; fim do `delete not in`.
- `pecas-programas.js`: exclusões explícitas + aviso de conflito.
- `cloud-sync.js`: a tela de roteiro não sobrescreve mais o cadastro.
- +7 testes unitários e novos cenários em `npm run test:db`.
- Detalhes: CONSISTENCIA.md

# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/).

Este arquivo é atualizado automaticamente por `npm run release` — não edite à mão
(exceto para corrigir algo pontual).

## [2.1.0] - 2026-07-09

### Adicionado
- Suporte a janelas horárias que cruzam a meia-noite em `regrasTipos`. Se `fim < inicio`, a janela é interpretada como wraparound (ex.: `06:00`–`05:59` cobre o ciclo completo do roteiro, incluindo madrugada).

### Alterado
- Padrões de `regrasTipos` de ECHM, ECHE, EINT, RCOM e EVNH agora terminam em `05:59` (madrugada). ECHE/RCOM/ECHM/EINT deixam de ser marcados como "fora da janela" quando inseridos entre 00:00 e 05:59.

### Notas de migração
- Usuários com regras customizadas mantêm suas configurações. Para cobrir madrugada, ajuste manualmente `fim` para `05:59` no painel Admin.


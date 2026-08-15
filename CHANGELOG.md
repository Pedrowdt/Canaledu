# Changelog

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


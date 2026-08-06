# Changelog

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


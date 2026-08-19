# Roteiro Canal Educação — Documentação Técnica

> Sistema web para cadastro de peças/programas e montagem, validação e exportação do
> **roteiro diário** do Canal Educação (MEC), usado por uma equipe pequena (1-5 pessoas)
> que trabalha **simultaneamente**, em navegadores diferentes.
>
> Duas telas HTML + JavaScript vanilla (sem bundler, sem framework), persistência em
> `localStorage` por usuário e um backend **Supabase** (Postgres + Auth + Realtime)
> compartilhado por toda a equipe.
>
> Licença: **GNU GPL v3** — Canal Educação / MEC · 2026

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Arquitetura de arquivos](#2-arquitetura-de-arquivos)
3. [Autenticação (`auth.js`)](#3-autenticação-authjs)
4. [Banco de dados (Supabase)](#4-banco-de-dados-supabase)
5. [Cadastro de Peças e Programas](#5-cadastro-de-peças-e-programas)
6. [O problema "peças somem" e como as duas frentes de correção se encaixam](#6-o-problema-peças-somem)
7. [`CadastroSync` — fila de pendências do editor de peças do Roteiro](#7-cadastrosync)
8. [Ponte Cadastro → Roteiro (`roteiro-pecas-bridge.js`)](#8-ponte-cadastro--roteiro)
9. [Log de atividades (`canal-log.js`)](#9-log-de-atividades-canal-logjs)
10. [Confecção do Roteiro (`app.js` e módulos auxiliares)](#10-confecção-do-roteiro)
11. [Estado global e regras de negócio](#11-estado-global-e-regras-de-negócio)
12. [Módulos utilitários (`src/core`)](#12-módulos-utilitários-srccore)
13. [Fluxos principais](#13-fluxos-principais)
14. [Persistência — mapa completo](#14-persistência--mapa-completo)
15. [Testes](#15-testes)
16. [Deploy](#16-deploy)
17. [Guia de manutenção](#17-guia-de-manutenção)
18. [Riscos conhecidos / lacunas encontradas](#18-riscos-conhecidos--lacunas-encontradas)
19. [Histórico de versões](#19-histórico-de-versões)

---

## 1. Visão geral

O sistema tem duas responsabilidades separadas, em duas páginas HTML:

| Tela | Arquivo | Para que serve |
|---|---|---|
| **Cadastro de Peças e Programas** | `pecas-programas.html` | Manter o banco compartilhado de peças de inserção e programas. É a **fonte da verdade** do sistema. |
| **Confecção do Roteiro** | `index.html` | Montar o roteiro de exibição de um dia, a partir da grade fixa + peças elegíveis do cadastro + peças importadas de planilha, com validação de regras e exportação (XLSX/PDF/JSON). A própria tela também tem um editor de peças/programas embutido (o "banco" — ver §7). |

As duas telas compartilham a **mesma sessão de login** (`auth.js`), leem/gravam no
**mesmo banco Postgres** (Supabase), com Realtime para refletir o que outro usuário
fez sem precisar recarregar a página, e usam o **mesmo módulo de log** (`canal-log.js`).

### Stack

| Camada | Tecnologia |
|---|---|
| UI | HTML5 + CSS custom properties (5 temas no Roteiro) |
| Lógica | JavaScript ES2020 vanilla, sem bundler, `<script>` clássico |
| Backend | [Supabase](https://supabase.com) — Postgres + Auth (GoTrue) + Realtime + RLS |
| Planilhas | [`xlsx-js-style`](https://www.npmjs.com/package/xlsx-js-style) |
| PDF | `jspdf` + `jspdf-autotable` |
| Persistência local | `localStorage` (por navegador/usuário) |
| Testes | `vitest` (unitários) + `@electric-sql/pglite` (Postgres real em memória, para as migrações SQL) |

---

## 2. Arquitetura de arquivos

```text
index.html                 ← shell da tela de Roteiro
pecas-programas.html       ← shell da tela de Cadastro

supabase-config.js         ← SUPABASE_URL / SUPABASE_ANON_KEY (único lugar a preencher)
auth.js                    ← CanalAuth: cliente Supabase único, login/logout, guard de página
canal-log.js               ← CanalLog: log de atividades (console + localStorage + tabela + captura de erros)
pecas-repo.js               ← PecasRepo: CRUD de peças/programas (delta + optimistic locking)
cadastro-sync.js            ← CadastroSync: fila de pendências do editor de peças embutido no Roteiro (§7)
roteiro-pecas-bridge.js     ← RoteiroPecasBridge: cadastro → localStorage do Roteiro, fundindo com pendências
cloud-sync.js               ← sincroniza grade/regras/roteiro do usuário com a nuvem (tela Roteiro)
pecas-programas.js          ← lógica da tela de Cadastro (CRUD, import/export, log, tempo real, modal de log)

data.js                     ← seeds iniciais (INITIAL_PECAS / INITIAL_PROGRAMAS)
grade_base.js                ← GRADE_BASE por dia da semana (grade fixa de referência)
parts-store.js               ← PartsStore: API CRUD + subscribe sobre state (Roteiro)
api-sync.js                  ← stub de API REST opcional (não usado pelo fluxo Supabase atual)
banco-manager.js             ← import/export XLSX/JSON de peças e programas (Roteiro) + fila via CadastroSync
pecas_dia.js                  ← importPecasDiaExcel + inserção inteligente (Roteiro)
app.js                        ← núcleo da tela de Roteiro (state, render, regras, exportações, editor de peças embutido)

src/core/                   ← módulos ES puros, testáveis em Node (sem DOM)
  normalize.js                ← normalização de texto/tempo
  time.js                     ← timeToSec e afins
  pecasCatalog.js              ← ponte cadastro → peças elegíveis/vinhetas
  validator.js                  ← validateRoteiroRegras
  roteiroBuilder.js              ← buildRoteiroFromPrograms

db/                          ← migrações SQL (Supabase → SQL Editor), ver §4 e db/README.md
tests/unit/                  ← testes de integração (consistência, pecas-repo, multiusuário)
```

**Ordem de carga em `pecas-programas.html`:** `supabase-config.js` → `version.js` →
`auth.js` → `canal-log.js` → `pecas-repo.js` → `pecas-programas.js`.

**Ordem de carga em `index.html`:** libs CDN → `supabase-config.js` → `auth.js` →
`canal-log.js` → `pecas-repo.js` → `cadastro-sync.js` → `roteiro-pecas-bridge.js` →
`cloud-sync.js` → (após autenticar) `data.js` → `grade_base.js` → `parts-store.js` →
`api-sync.js` → `banco-manager.js` → `pecas_dia.js` → `app.js`.

Todos os módulos compartilham **globais no `window`** (não há módulos ES no HTML,
exceto dentro de `src/core`, que roda isolado nos testes e não é importado pelo app
real — ver §18).

---

## 3. Autenticação (`auth.js`)

Publicado como `window.CanalAuth`. Único ponto de verdade usado pelas duas telas —
evita duas instâncias de `GoTrueClient` no mesmo navegador.

| Função | Para que serve |
|---|---|
| `CanalAuth.getClient()` | cliente Supabase **singleton** |
| `CanalAuth.resolveSession()` | restaura a sessão persistida, com retentativas |
| `CanalAuth.requireUser()` | devolve o usuário logado ou `null` — guard de página |
| `CanalAuth.signIn(email, senha)` | login, com erro traduzido para PT-BR |
| `CanalAuth.signOut(destino)` | encerra a sessão nas duas telas |
| `CanalAuth.onAuthChange(cb)` | reage a logout/expiração, inclusive em outra aba |

Sem sessão válida, a página não abre — mostra login inline. Sem autocadastro — os
logins são criados manualmente em **Authentication → Users** no Supabase.

> ⚠️ Ver §18 — a revogação formal do acesso anônimo às tabelas de cadastro
> (`db/004_autenticacao.sql`, mencionada em `AUTENTICACAO.md`) **não existe neste
> repositório**.

---

## 4. Banco de dados (Supabase)

### 4.1 Tabelas

| Tabela | Escopo | Conteúdo |
|---|---|---|
| `public.pecas` | compartilhado | cadastro de peças de inserção — fonte da verdade |
| `public.programas` | compartilhado | cadastro de programas — fonte da verdade |
| `public.shared_data` | compartilhado (linha única) | `grade`, `regras`, e um **espelho JSONB** de `pecas`/`programas` (legado, mantido por trigger) |
| `public.user_data` | por usuário | `roteiros` e `pecas_dia` — nunca compartilhado |
| `public.activity_log` | compartilhado | histórico de ações da equipe, usado por `canal-log.js` (ver §9) |

### 4.2 Migrações (`db/`)

Aplicar **em ordem**, no SQL Editor do Supabase:

| Arquivo | O que faz |
|---|---|
| `001_pecas_programas.sql` | cria `pecas`/`programas`, tipos, RLS, `fn_pecas_elegiveis`, triggers de espelho. |
| `002_migrar_shared_data.sql` | importa o que já existia em `shared_data` para as tabelas relacionais. |
| `003_consistencia.sql` | `row_version` (optimistic locking) + RPCs de gravação por delta com detecção de conflito. |
| `004_activity_log.sql` | cria `public.activity_log`, usada por `canal-log.js`. Opcional — sem ela o log funciona só em console + `localStorage`. |

`shared_data` nunca é apagada: continua existindo como espelho de leitura para código legado.

> ⚠️ Existe um **segundo gap de numeração "004"**, sem relação com este: `AUTENTICACAO.md`
> referencia um `db/004_autenticacao.sql` (revogação de acesso anônimo) que também nunca
> foi commitado. Como esse arquivo nunca existiu no repositório, não houve colisão real
> de número — mas os dois "004" mencionados em documentações diferentes **não são a
> mesma coisa**. Ver §18.

### 4.3 Regras de elegibilidade

`fn_pecas_elegiveis(dow, hora, data_ref)` — mesma regra implementada em
`src/core/pecasCatalog.js`: validade não expirada, dia da semana permitido, janela
horária (inclusive cruzando a meia-noite).

---

## 5. Cadastro de Peças e Programas

### `pecas-repo.js` — `window.PecasRepo`

- **`init(client, workspaceId)`** — detecta se as tabelas relacionais existem;
  `mode = 'relational'` ou `'legacy'` (usa `shared_data`).
- **`loadAll()`** — lê `pecas`/`programas`, grava um **baseline** local (fingerprint +
  `row_version` por `code`).
- **`saveDelta({ pecas, programas, deletedPecas, deletedProgramas, userId })`** — envia
  **só o que mudou** desde o baseline. Se o `row_version` não bater (outra pessoa editou
  no meio do caminho), a RPC devolve um **conflito** em vez de sobrescrever.
- **`onRemoteChange(handler)`** — assina `postgres_changes` nas tabelas relevantes.

### `pecas-programas.js`

Abas Peças/Programas, busca, filtros, modal de criar/editar, exclusão individual/geral,
import XLSX/CSV, export JSON, e o **modal de log** (§9).

Cada ação (`saveItem`, `confirmDel`, `importFile`) mexe nos arrays locais
`pecas`/`programas` e chama `scheduleSync()` — que agenda `pushToCloud()` depois de
~700ms (debounce). `pushToCloud()` chama `PecasRepo.saveDelta` e, ao terminar, recarrega
o cadastro para trazer o que outros usuários gravaram nesse meio-tempo.

---

## 6. O problema "peças somem"

O sistema teve **duas causas raiz diferentes** para o mesmo sintoma relatado —
*"quando o sistema é atualizado em um usuário, o outro perde suas peças"* — corrigidas
em momentos diferentes por frentes diferentes de trabalho. Vale entender as duas para
não reintroduzir nenhuma ao mexer no código de sincronização.

### Causa 1 — o editor de peças embutido no Roteiro nunca sincronizava (corrigida por `CadastroSync`)

A tela de Roteiro (`app.js`) tem seu próprio modal de banco de peças/programas
(`banco-manager.js`). Criar/editar/excluir ali só mexia no `localStorage`
(`roteiroApp`) — nunca era enviado para `public.pecas`/`public.programas`. Quando
chegava uma atualização de tempo real do cadastro (outro usuário editando pela tela
`pecas-programas.html`), o código antigo substituía `state.pecas`/`state.programas`
inteiro pelo que vinha da nuvem — **apagando** qualquer peça criada só localmente no
Roteiro, que nunca tinha ido para o banco.

**Correção:** `cadastro-sync.js` (`CadastroSync`) mantém uma **fila de pendências**
(`pecas`/`programas`/`excluidos`, indexados por `code`, persistida em `localStorage`)
de tudo que foi criado/editado/excluído no editor embutido do Roteiro mas ainda não
confirmado no banco. `roteiro-pecas-bridge.js` (`mergeCadastro`/`combinar`) funde essa
fila com o que vem da nuvem em vez de sobrescrever — um item pendente sempre "ganha" da
versão remota até ser confirmado. `CadastroSync.flush()` tenta gravar a fila via
`PecasRepo.saveDelta` sempre que a sincronização de grade roda (`cloud-sync.js`).

### Causa 2 — debounce da tela de Cadastro perdendo a corrida com o tempo real (corrigida à parte)

Um problema diferente, na própria tela `pecas-programas.html`: ao salvar uma peça, a
gravação na nuvem é **adiada** (`scheduleSync`, debounce de ~700ms). Se, antes desse
atraso terminar, chegasse uma notificação de tempo real de **outro** usuário, o
`setupRealtime` da tela de Cadastro recarregava o cadastro inteiro e substituía
`pecas`/`programas` na tela — sem saber que havia uma edição deste usuário esperando
para ser enviada. Quando o envio pendente finalmente disparava, usava a lista **já
sobrescrita**, sem a peça recém-criada.

O mesmo padrão existia em `cloud-sync.js` para a **grade do roteiro**: editar a grade
também é debounced (~900ms), e uma atualização remota de `shared_data` conseguia
substituir `app.grade` inteira antes do envio pendente completar.

**Correção:** as duas telas agora rastreiam se há uma gravação local **agendada**
(`pushTimer`/`_pushTimer` ainda não disparou) ou **em andamento**
(`pushInFlight`/`_pushInFlight`, `true` durante o `await` da gravação), via
`temAlteracoesPendentes()`. O listener de tempo real consulta essa função antes de
recarregar: sem alterações pendentes, recarrega normalmente; com alterações pendentes,
não sobrescreve — só avisa no status e deixa o próprio envio pendente subir o delta em
cima do que está no banco agora (a RPC já trata conflito por `row_version`).

> As duas correções são **complementares, não redundantes**: a Causa 1 é sobre um
> caminho de edição (o banco embutido do Roteiro) que nunca chegava a tentar
> sincronizar; a Causa 2 é sobre uma sincronização que já ia acontecer, mas perdia a
> corrida contra uma atualização remota simultânea. `tests/unit/multiusuario.test.mjs`
> testa a Causa 1 (a ponte `roteiro-pecas-bridge.js`); os testes manuais descritos nesta
> seção validam a Causa 2 (debounce vs. tempo real).

---

## 7. `CadastroSync`

`window.CadastroSync` (`cadastro-sync.js`) — fila de pendências para o editor de
peças/programas embutido na tela de Roteiro (§6, Causa 1).

| Função | Uso |
|---|---|
| `CadastroSync.init({ client, userId })` | liga o cliente Supabase e o usuário |
| `CadastroSync.upsertPeca(peca)` / `upsertPrograma(p)` | marca um item como pendente de envio |
| `CadastroSync.excluir(code, tipo)` | marca uma exclusão pendente |
| `CadastroSync.pendentes()` | `{ pecas, programas, excluidos }` — usado por `roteiro-pecas-bridge.js` para fundir com a nuvem |
| `CadastroSync.flush()` | tenta gravar tudo que está pendente via `PecasRepo.saveDelta`; limpa da fila só o que foi confirmado |

Chamado a partir de `banco-manager.js` (editor embutido) e disparado periodicamente
por `cloud-sync.js`'s `pushToCloud()`.

---

## 8. Ponte Cadastro → Roteiro

`roteiro-pecas-bridge.js` (`window.RoteiroPecasBridge`):

- `carregarCadastro()` — lê as tabelas relacionais via `PecasRepo`; cai para o espelho
  `shared_data` se elas não existirem.
- `mergeCadastro(app, cadastro, pendentes)` — funde o cadastro remoto com o que veio de
  `CadastroSync.pendentes()`: um item pendente sempre prevalece sobre a versão remota,
  até ser confirmado. Nunca toca em `roteiros`, `pecasDia` ou `grade`. Só peças
  **ativas** entram. Se a leitura remota vier vazia (falha de rede), o banco local é
  preservado.
- `combinar(...)` — a função de merge propriamente dita, usada tanto por
  `mergeCadastro` quanto pelo handler de tempo real em `cloud-sync.js`.
- `aplicarNoEstado(state, cadastro)` — aplica o cadastro atualizado no `state` já em
  memória, sem re-render desnecessário se nada mudou.

---

## 9. Log de atividades (`canal-log.js`)

`window.CanalLog` — usado pelas **duas telas**, um único sistema (não há dois logs
paralelos). Registra em três lugares:

1. **Console**, sempre, prefixo `[log]`.
2. **`localStorage`** (anel de até 300 entradas por navegador), disponível offline via
   `CanalLog.recentes()` e exportável em JSON (`CanalLog.exportar()`).
3. **`public.activity_log`**, quando há sessão Supabase — best-effort, uma falha de
   rede nunca interrompe a ação do usuário.

### API

| Função | Uso |
|---|---|
| `CanalLog.init({ client, user, tela, workspaceId })` | inicializa e ativa a captura de erros globais |
| `CanalLog.registrar(evento, detalhe, { codes, nivel })` | registra um evento (`nivel`: `info`\|`warn`\|`error`) |
| `CanalLog.recentes(n)` | últimas N entradas locais deste navegador |
| `CanalLog.equipe(n)` | últimas N entradas da equipe toda, direto da nuvem |
| `CanalLog.onNovaEntrada(handler)` | assina novas entradas em tempo real |
| `CanalLog.exportar()` | baixa o log local em JSON |

Eventos já emitidos pelo código: `cadastro_aberto`, `cadastro_exclusao_marcada`,
`cadastro_salvo`, `cadastro_salvo_falhou`, `cadastro_sync_adiado` (§6, Causa 2),
`roteiro_sincronizado`, `roteiro_sync_falhou`, `roteiro_atualizado_por_outro_usuario`,
`roteiro_sync_adiado` (§6, Causa 2), e `erro_nao_tratado` (captura automática de
`window.onerror`/`unhandledrejection`, ativada assim que `canal-log.js` carrega — não
depende de login).

### Onde ver

- **Modal "Log de atividades"** em `pecas-programas.html` (botão **🕘 Log**): tabela
  com as últimas entradas, filtro por tela e nível, atualização ao vivo enquanto aberta.
- Console do navegador (filtrar por `[log]`).
- SQL direto: `select * from activity_log order by criado_em desc limit 50;`

---

## 10. Confecção do Roteiro

Núcleo em `app.js` (~4000 linhas). Combina grade fixa (`grade_base.js`), peças do dia
importadas de planilha (`pecas_dia.js`), banco de peças/programas (agora sincronizado
via `CadastroSync` + `roteiro-pecas-bridge.js`, §6-8) e regras de negócio configuráveis.

### Saídas

Roteiro na tela com validação em tempo real; exportações XLSX (`xlsx-js-style`), PDF
(`jspdf`+`autotable`), JSON; backup automático em `localStorage` e, opcionalmente,
pasta local (File System Access API, só Chromium).

### Mapa por área (`app.js`)

| Área | Funções chave |
|---|---|
| Estado + regras | `state`, `REGRAS_DEFAULT`, `loadRegras`, `saveRegras`, `saveState` |
| Render principal | `renderAll`, `renderRoteiro`, `renderPecasSidebar`, `renderPecasPanel`, `renderProgramas` |
| Edição de itens | `editItemModal`, `saveEditItem`, `addItemModal`, `removeItem` |
| Geração do roteiro | `buildRoteiroFromPrograms` (a versão real, em `app.js`; ver §12 sobre a versão paralela em `src/core`) |
| Validação | `validateRoteiroRegras` |
| Exportações | `exportXLSX`, `exportExcel`, `exportPDF`, `exportJSON` |
| Banco embutido | modal de peças/programas, chama `CadastroSync.upsertPeca`/`excluir` a cada edição |
| Backup | `setupAutoBackup`, `runAutoBackup` |

---

## 11. Estado global e regras de negócio

### `state`

| Campo | Descrição |
|---|---|
| `roteiro` | Itens do roteiro do dia selecionado |
| `pecas` / `programas` | Banco (fundido via `CadastroSync`+bridge) |
| `currentDate` / `weekOffset` | Navegação de datas |
| `pecasDia` | Peças importadas da planilha do dia |
| `pecasFixas` | Peças fixas injetadas em todo roteiro |
| `gradeAcked` | Avisos de divergência de grade já assumidos |

### `REGRAS_DEFAULT` (principais chaves)

`inicioRoteiro`, `rpolInicio`/`rpolFim`, `gradeTolerancia`, `breakSlotsPorBloco`,
`tiposChamada`, `backupIntervaloMin`, `regrasTipos.<TIPO>` (janela/intervalo/adjacência
por tipo), `vh*` (config. de vinhetas). Editáveis pelo painel **Admin**, salvas em
`localStorage['roteiroRegras']` e sincronizadas via `shared_data.regras`.

---

## 12. Módulos utilitários (`src/core`)

Camada de funções **puras** (sem DOM, sem rede), testável em Node:

| Arquivo | Conteúdo |
|---|---|
| `normalize.js` | `normalizeKey`, `baseProgramTitle`, `getEpisodeId` |
| `time.js` | `timeToSec`, `secToTime` |
| `pecasCatalog.js` | vigência/janela de peças, `catalogFromCadastro` |
| `validator.js` | `validateRoteiroRegras` |
| `roteiroBuilder.js` | `buildRoteiroFromPrograms` — versão pura, com mesma lógica de negócio de `app.js`, mas VH "a seguir"/"assistindo" dirigidas por um `catalogo` opcional (derivado do cadastro) em vez das listas hardcoded do `app.js` |

> ⚠️ **`src/core/*` não está conectado ao app real.** É testado por `npm test`, mas
> `index.html`/`app.js` não importam esses módulos — a tela de Roteiro roda sua própria
> implementação (script clássico, sem bundler). As duas podem divergir com o tempo se só
> uma for atualizada. Unificar exigiria migrar para módulos ES ou um bundler — não feito
> aqui. Ver §18.

---

## 13. Fluxos principais

### 13.1 Login
`CanalAuth.requireUser()` → sem sessão, formulário inline → `signIn` →
`CanalLog.init(...)` → carrega dados da tela.

### 13.2 Editar uma peça no Cadastro
`saveItem` → altera array local → `CanalLog.registrar('cadastro_...')` → `render()` →
`scheduleSync()` (debounce 700ms) → `pushToCloud()` → `PecasRepo.saveDelta` → conflito?
loga e avisa → `loadFromCloud()`. Se, nesse meio-tempo, chegar uma notificação de outro
usuário: `temAlteracoesPendentes()` evita a sobrescrita (§6, Causa 2).

### 13.3 Editar uma peça no editor embutido do Roteiro
`banco-manager.js` → `CadastroSync.upsertPeca(...)` (fila local) → próxima
`pushToCloud()` da tela de Roteiro chama `CadastroSync.flush()` → grava via
`PecasRepo.saveDelta`. Até lá, `roteiro-pecas-bridge.js` garante que o item pendente
não desaparece se uma atualização remota chegar (§6, Causa 1).

### 13.4 Abrir o Roteiro
`onAuthenticated` → busca cadastro + funde com `CadastroSync.pendentes()` → busca
`shared_data`/`user_data` → injeta scripts → `patchLocalStorage()` (intercepta writes
para agendar sync) → `setupRealtime()`.

### 13.5 Gerar roteiro
`buildRoteiroFromPrograms(programs)` → insere VH de classificação, blocos, breaks,
VHs "a seguir"/"assistindo", peças fixas → `recalcTimes()` → `renderRoteiro()` →
`validateRoteiroRegras()`.

---

## 14. Persistência — mapa completo

```
NAVEGADOR (por usuário)
  localStorage['roteiroApp']          ← pecas, programas, roteiros, pecasDia, grade
  localStorage['roteiroRegras']       ← REGRAS
  localStorage['cadastroSyncPendentes'] ← fila do CadastroSync (peças/programas ainda não confirmados)
  localStorage['canalLog']             ← anel de até 300 entradas de log

SUPABASE (compartilhado / por usuário)
  public.pecas / public.programas      ← cadastro (fonte da verdade), compartilhado
  public.shared_data (linha única)     ← grade, regras + espelho JSONB de pecas/programas
  public.user_data (por user_id)       ← roteiros, pecas_dia — isolado por usuário
  public.activity_log                  ← log de atividades, compartilhado
  auth.users                            ← contas da equipe (GoTrue)
```

---

## 15. Testes

```bash
npm test          # vitest — testes unitários (src/core + tests/unit)
npm run test:watch
npm run test:db    # aplica as migrações 001–003 num Postgres real (PGlite)
```

Cobertura atual: `src/core/*.test.js` (timeToSec, validação, geração de roteiro,
catálogo), `tests/unit/pecasRepo.test.mjs` (PecasRepo), `tests/unit/consistencia.test.mjs`
(cenários de conflito), `tests/unit/multiusuario.test.mjs` (a ponte
`roteiro-pecas-bridge.js` preserva peças pendentes — trava o comportamento da Causa 1
do §6).

---

## 16. Deploy

Guia completo em `DEPLOY.md`. Resumo: criar projeto Supabase → rodar
`supabase-schema.sql` e as migrações de `db/` em ordem (001→002→003→004) → preencher
`supabase-config.js` → criar logins da equipe manualmente → publicar os arquivos
estáticos (sem build step).

---

## 17. Guia de manutenção

| Tarefa | Onde mexer |
|---|---|
| Mudar janela RPOL / tolerância de grade / breaks | Admin (regras) |
| Adicionar novo tipo de peça | `TIPOS_CONFIGURAVEIS` em `app.js` + `regrasTipos` |
| Adicionar coluna na exportação | `exportXLSX`/`exportPDF` |
| Mudar debounce de sincronização | `scheduleSync()` (`pecas-programas.js`) / `patchLocalStorage()` (`cloud-sync.js`) |
| Adicionar novo evento ao log | `CanalLog.registrar(evento, detalhe, { nivel })` no ponto do código |
| Aplicar a migração do log | `db/004_activity_log.sql` no SQL Editor do Supabase |
| Mexer na fila de pendências do banco embutido | `cadastro-sync.js` |

---

## 18. Riscos conhecidos / lacunas encontradas

- **`db/004_autenticacao.sql` ausente.** `AUTENTICACAO.md` descreve uma migração que
  revogaria o acesso do papel anônimo às tabelas de cadastro. As colunas de auditoria já
  existem, mas a revogação de acesso anônimo em si não está em nenhum script versionado.
  Confirme manualmente no painel do Supabase.
- **`src/core/*` não conectado ao app real** — ver §12. Risco de divergência entre a
  lógica de `app.js` e a versão "espelho" testável.
- **`api-sync.js` é um stub não utilizado** pelo fluxo atual (Supabase) — mantido só
  como caminho de migração futura para um servidor próprio.
- **Acoplamento por globais** (`state`, `REGRAS`, `PartsStore` em `window`).
- **Log sem retenção/paginação** — `activity_log` cresce indefinidamente sem expurgo.
- **`CadastroSync` e a correção de debounce (§6) foram feitas em momentos/frentes
  diferentes** e nunca testadas juntas em produção multiusuário real antes desta
  reconciliação — recomenda-se um teste manual com 2 navegadores antes de confiar
  cegamente (ver roteiro de teste manual em `CONSISTENCIA.md`).

---

## 19. Histórico de versões

Ver `CHANGELOG.md` para o histórico completo. Marcos relevantes:

- **v1.2.0** — consistência multiusuário: `row_version`, RPCs de delta.
- **v2.2.0** — autenticação única (`auth.js`) e ponte cadastro→roteiro.
- **v2.4.0** (patch em paralelo, já no `main`) — `CadastroSync` + `canal-log.js`:
  corrige peças criadas no editor embutido do Roteiro nunca sincronizando (§6, Causa 1).
- **v2.4.1** — corrige a corrida entre sincronização pendente e tempo real na tela de
  Cadastro e na grade do Roteiro (§6, Causa 2); consolida o log em `canal-log.js` (sem
  sistema paralelo); adiciona `db/004_activity_log.sql` (referenciado mas ausente);
  move `multiusuario.test.mjs` para `tests/unit/` (não era coletado pelo `vitest`);
  corrige `buildRoteiroFromPrograms` vazio e uma asserção quebrada em `validator.test.js`.

---

_Documento gerado a partir da inspeção estática de todo o repositório (HTML, JS e SQL),
reconciliando duas frentes de correção que convergiram no mesmo problema. Sempre que um
módulo mudar de forma relevante, atualize a seção correspondente aqui._


---

## 20. Assinatura do programa: cadastro como fonte da verdade

### Regra de negócio
A vinheta de assinatura inserida automaticamente depois do **último bloco** de
cada programa é escolhida pela **tag marcada no cadastro do programa**, na
instância *Peças e Programas* (campo **Assinatura** → coluna
`public.programas.assinatura`, enum `faixa_assinatura`:
`infantil | jovem | adulto`).

Ordem de decisão (`assinatura-programa.js#resolverFaixa`):

```
0) tag do cadastro do programa        -> DECISÓRIA
1) REGRAS.classificacaoPrograma       -> fallback (modal do painel Admin)
2) REGRAS.vhAssinatura*Keywords       -> fallback
3) 'jovem'                            -> fallback final
```

O cadastro define **qual** faixa. O painel Admin continua definindo **como** a
vinheta entra: `code`, `descricao`, `tempo` e o `ativo` de cada faixa
(`REGRAS.vhAssinaturaInfantil/Jovem/Adulto`). Faixa desativada ⇒ nenhuma VH é
inserida, mesmo com tag no cadastro.

### Como o bloco do roteiro é casado com o cadastro
1. **Por `code`** — match exato e preferencial.
2. **Por título base normalizado** — `PGM PALALOOS - T01 EP05 - BL 02` vira
   `PALALOOS` (sem prefixo `PGM`, temporada/episódio, bloco, parênteses,
   minutagem, acentos; tudo em maiúsculas).

Programas **inativos** (`ativo === false`) ou **sem tag** não decidem nada — a
consulta devolve `null` e a cadeia cai no fallback.

### Onde isso vive
| Arquivo | Papel |
|---|---|
| `assinatura-programa.js` | Módulo UMD usado pela tela real (`index.html`/`app.js`) e pelos testes. Publica `window.AssinaturaPrograma`. |
| `app.js#getAssinatura` | Chama `AssinaturaPrograma.montarVhAssinatura(bloco, REGRAS, state.programas)`. Mantém o algoritmo antigo como rota de segurança se o script não carregar. |
| `src/core/roteiroBuilder.js` | Versão pura equivalente: `faixaDoCadastro()` + `pickAssinatura(bloco, regras, programasCadastro)`; `buildRoteiroFromPrograms` ganhou o 7º parâmetro opcional `programasCadastro`. |
| `pecas-repo.js` / `roteiro-pecas-bridge.js` | Já traziam `assinatura` do banco para `state.programas` — nenhuma mudança foi necessária no transporte. |
| `tests/unit/assinaturaPrograma.test.mjs` | Cobertura da regra e dos fallbacks. |

### Diagnóstico
A VH gerada carrega `_assinaturaFaixa` e `_assinaturaOrigem`
(`cadastro | admin | keywords | padrao`). Campos internos, ignorados na
exportação, úteis para responder "por que este programa saiu como JOVEM?".

### Operação
- Para mudar a faixa de um programa: edite o programa em **Peças e Programas**
  e marque a tag. O Roteiro reflete na próxima geração automática.
- O modal *Classificação por Programa* no Admin permanece útil para programas
  ainda não cadastrados ou sem tag.

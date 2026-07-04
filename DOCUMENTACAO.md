# Roteiro Canal Educação — Documentação Técnica

> Sistema web para montagem, validação e exportação do **roteiro diário** do Canal Educação (MEC).
> Aplicação **client-side pura** (HTML + JavaScript vanilla), roda em `file://` ou servida por HTTP, com persistência em `localStorage` e sincronização opcional com API REST.
>
> Licença: **GNU GPL v3** — Canal Educação / MEC · 2026

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Arquitetura de arquivos](#2-arquitetura-de-arquivos)
3. [Estado global (`state`)](#3-estado-global-state)
4. [Regras de negócio (`REGRAS_DEFAULT`)](#4-regras-de-negócio-regras_default)
5. [Módulos](#5-módulos)
   - [5.1 `index.html`](#51-indexhtml)
   - [5.2 `app.js`](#52-appjs)
   - [5.3 `banco-manager.js`](#53-banco-managerjs)
   - [5.4 `pecas_dia.js`](#54-pecas_diajs)
   - [5.5 `grade_base.js`](#55-grade_basejs)
   - [5.6 `parts-store.js`](#56-parts-storejs)
   - [5.7 `api-sync.js`](#57-api-syncjs)
   - [5.8 `data.js`](#58-datajs)
6. [Fluxos principais](#6-fluxos-principais)
7. [Persistência e sincronização](#7-persistência-e-sincronização)
8. [Convenções de código](#8-convenções-de-código)
9. [Guia de manutenção](#9-guia-de-manutenção)
10. [Riscos conhecidos / TODO](#10-riscos-conhecidos--todo)

---

## 1. Visão geral

O sistema auxilia a equipe de programação do **Canal Educação** a montar o roteiro de exibição de um dia específico, combinando:

- **Grade fixa** de programas por dia da semana (arquivo `grade_base.js`).
- **Peças de inserção do dia** (chamadas, RCOM, RPOL, interprogramas, VH etc.) importadas de planilhas XLSX.
- **Banco permanente** de peças e programas (persistido em `localStorage`).
- **Regras de negócio configuráveis** (janela RPOL, tolerância de grade, breaks por bloco, adjacência de chamadas, VH de assinatura, etc.).

Saídas principais:

- **Roteiro na tela** com validação em tempo real (aderência à grade, avisos BL01, alertas de bloco).
- **Exportações**: XLSX estilizado (via `xlsx-js-style`), PDF (via `jspdf` + `jspdf-autotable`), JSON e CSV.
- **Backup automático** no `localStorage` e opcionalmente em pasta local (File System Access API).

### Stack

| Camada | Tecnologia |
|---|---|
| UI | HTML5 + CSS custom properties (5 temas) |
| Lógica | JavaScript ES2020 vanilla, sem bundler |
| Planilhas | [`xlsx-js-style`](https://www.npmjs.com/package/xlsx-js-style) 1.2.0 |
| PDF | `jspdf` 2.5.1 + `jspdf-autotable` 3.8.2 |
| Persistência | `localStorage` (chave `roteiroApp`) + File System Access API |
| Sync (opcional) | Fetch → API REST via `api-sync.js` |

---

## 2. Arquitetura de arquivos

```text
index.html               ← shell da UI, CDNs, temas, includes dos .js
│
├─ data.js               ← seeds iniciais (INITIAL_PECAS, INITIAL_PROGRAMAS)
├─ grade_base.js         ← GRADE_BASE por dia da semana
├─ parts-store.js        ← PartsStore: API CRUD + subscribe sobre o state
├─ api-sync.js           ← API: stub local / cliente REST (servidor)
├─ banco-manager.js      ← import/export XLSX/JSON de peças e programas
├─ pecas_dia.js          ← importPecasDiaExcel + inserção inteligente
└─ app.js                ← núcleo: state, render, roteiro, regras, exportações
```

**Ordem de carga (em `index.html`):** libs CDN → `data.js` → `grade_base.js` → `parts-store.js` → `api-sync.js` → `banco-manager.js` → `pecas_dia.js` → `app.js`.

Todos os módulos compartilham **globais no `window`** (não há módulos ES). O `app.js` orquestra e expõe funções chamadas via `onclick=` nos handlers do HTML.

---

## 3. Estado global (`state`)

Definido em `app.js:4`. Serializado em `localStorage['roteiroApp']` por `saveState()`.

| Campo | Tipo | Descrição |
|---|---|---|
| `roteiro` | `Item[]` | Itens do roteiro do dia selecionado, na ordem de exibição |
| `pecas` | `Peca[]` | Banco permanente de peças |
| `programas` | `Programa[]` | Banco permanente de programas |
| `currentDate` | `Date` | Dia atualmente selecionado |
| `weekOffset` | `number` | 0 = semana atual, ±N = semanas relativas |
| `pecasDia` | `Peca[]` | Peças importadas da planilha do dia |
| `selectedRow` | `number \| null` | Índice da linha focada no roteiro |
| `sidebarFilters` | `Set<string>` | Filtros ativos na sidebar (por tipo) |
| `panelFilters` | `Set<string>` | Filtros ativos no painel de peças do dia |
| `pecasFixas` | `PecaFixa[]` | Peças fixas injetadas em todo roteiro (`code`, `posicao`, `ativo`) |
| `gradeAcked` | `Set<string>` | Avisos de divergência BL01 já assumidos pelo usuário |

`saveState()` grava o objeto inteiro; `PartsStore` também escuta mudanças e notifica assinantes.

---

## 4. Regras de negócio (`REGRAS_DEFAULT`)

Definidas em `app.js:40`. Carregadas por `loadRegras()` com merge sobre customizações em `localStorage['roteiroRegras']`. Editáveis pelo painel **Admin** (`openAdminModal`).

| Chave | Padrão | Significado / uso |
|---|---|---|
| `inicioRoteiro` | `06:00:00` (21600s) | Segundo inicial do roteiro |
| `rpolInicio` / `rpolFim` | `19:30` – `22:30` | Janela para inserção de peças RPOL |
| `gradeTolerancia` | `10` s | ± tolerância para marcar aderência à grade como ✓ verde |
| `breakSlotsPorBloco` | `2` | Slots de break gerados por bloco de programa |
| `tiposChamada` | `['ECHM','ECHE']` | Tipos que **não podem** ficar adjacentes entre si |
| `sidebarMaxItens` | `120` | Limite antes de pedir refinamento na busca |
| `backupIntervaloMin` | `2` | Intervalo do auto-backup (min) |
| `mostrarGrade` | `true` | Exibe indicadores de aderência à grade |
| `autoBanco` | `true` | Mescla itens importados no banco permanente |
| `injetarFixas` | `true` | Injeta `pecasFixas` ao gerar roteiro |
| `regrasTipos.<TIPO>` | ver abaixo | Regras por tipo de peça |

### `regrasTipos` — por tipo

Cada entrada tem: `ativo`, `inicio` (`HH:MM`), `fim`, `intervaloMinMin` (min), `naoAdjacenteA` (lista de tipos).

| Tipo | Janela | Intervalo mín. | Não adjacente a |
|---|---|---|---|
| `ECHM` | 06:00–23:59 | 0 | `ECHM`, `ECHE` |
| `ECHE` | 06:00–23:59 | 0 | `ECHM`, `ECHE` |
| `EINT` | 06:00–23:59 | 0 | — |
| `RCOM` | 06:00–23:00 | 30 | — |
| `RPOL` | 19:30–22:30 | 0 | — |
| `EVNH` | 06:00–23:59 | 0 | — |

### VH (vinhetas)

| Chave | Padrão | Uso |
|---|---|---|
| `vhClassificacao` | code 85283 | Inserida antes do 1º bloco |
| `vhAssinaturaInfantil` | code 85331 | Após último bloco de programas infantis |
| `vhAssinaturaJovem` | code 85330 | Após último bloco de programas juvenis |
| `vhAssinaturaAdulto` | code 85332 | Após último bloco de programas adultos |
| `vhAssinaturaInfantilKeywords` | lista CSV | Palavras que classificam o programa como infantil |
| `vhAssinaturaAdultoKeywords` | lista CSV | Palavras que classificam como adulto |
| `vhSeguirAtivo` | `true` | Habilita inserção de "VH A SEGUIR" |
| `vhAssistindoAtivo` | `true` | Habilita "VH VC ESTA ASSISTINDO" |
| `vhDaquiAPouco` | `true` | Habilita "VH DAQUI A POUCO" como separador |

---

## 5. Módulos

### 5.1 `index.html`

Shell da aplicação. Responsabilidades:

- Carrega CDNs: `xlsx-js-style`, `jspdf`, `jspdf-autotable`, fontes IBM Plex (Sans + Mono).
- Define **5 temas** via CSS custom properties no `body`:
  - `theme-day` (claro — padrão)
  - `theme-night` (escuro)
  - `theme-sunset` (pôr-do-sol)
  - `theme-cozy` (bege)
  - `theme-hicontrast` (alto contraste)
- Estrutura de layout: **sidebar de peças** (esquerda), **painel do roteiro** (centro), **painel de peças do dia** (direita).
- Modais: editar item, adicionar peça, adicionar programa, peças fixas, admin (regras), grade, importação, backup, atalhos.
- Referências aos scripts na ordem indicada em §2.

### 5.2 `app.js`

Núcleo. Aproximadamente **3.720 linhas**. Áreas principais (ver o mapa completo abaixo):

| Área | Funções chave | Linhas |
|---|---|---|
| Estado + regras | `state`, `REGRAS_DEFAULT`, `loadRegras`, `saveRegras`, `saveState` | 4–246 |
| Utilitários de tempo | `timeToSec`, `secToTime`, `secToTimeRaw`, `recalcTimes`, `totalDuration` | 248–296 |
| Navegação de datas | `renderWeekSelector`, `changeWeek`, `selectDate`, `updateDateDisplay` | 309–394 |
| Render principal | `renderAll`, `renderRoteiro`, `renderStats`, `renderPecasSidebar`, `renderPecasPanel`, `renderProgramas` | 396–781 |
| Drag & drop | `dragStart`, `dragOver`, `dragDrop`, `dragFromSidebar`, `addToRoteiro` | 783–860 |
| Edição de itens | `editItemModal`, `saveEditItem`, `addItemModal`, `removeItem`, `injectBreakSummaries` | 862–950 |
| Banco (peças/programas) | `addPecaModal`, `saveNewPeca`, `editPecaModal`, `deletePeca`, `importBanco`, `exportBancoXLSX/JSON`, `addProgModal` | 1058–1318 |
| Import geral | `importData`, `handleImport`, `handlePecasDiaImport`, `importJSON`, `mergeBancoFromRoteiro` | 1320–1466 |
| Classificação VH | `getVhClassificacao`, `getAssinatura`, `VH_SEGUIR_MAP`, `VH_ASSISTINDO_MAP`, `findVhSeguir`, `findVhAssistindo`, `pickAssinatura`, `baseProgramTitle` | 1468–1580 |
| Geração de roteiro | `buildRoteiroFromPrograms` | 1581–1663 |
| Import Notion / CSV | `importNotionCSV`, `parseCSVLine` | 1665–1775 |
| Exportações | `exportExcel`, `exportXLSX`, `exportPDF`, `exportJSON` | 1777–2163 |
| Peças fixas | `openPecasFixasModal`, `addPecaFixa`, `togglePecaFixa`, `movePecaFixa`, `deletePecaFixa` | 2165–2289 |
| Admin | `openAdminModal`, `saveAdminRegras`, `resetAdminRegras`, `renderRegrasTiposUI`, `readRegrasTiposFromUI` | 2291–3208 |
| Backup | `setupAutoBackup`, `runAutoBackup` | 2432–2488 |
| Tema | `setTheme`, `loadTheme`, `loadProgramColors`, `setProgramColor` | 2496–2552 |
| Alertas de bloco | `scheduleBlockAlerts`, `fireBlockAlert`, `clearBlockAlerts` | 2585–2704 |
| Grade | `loadGrade`, `saveGrade`, `loadGradeOrder`, `saveGradeOrder`, `openGradeModal`, `renderGrade`, `assumeGradeTime`, `fixGradeFromRoteiro`, `_gradeExpandMerges`, `_gradePreviewSelectedSheet`, `applyGradeSemanalImport` | 2759–3728 |
| Validação de regras | `validateRoteiroRegras`, `applyRegraWarningsToDom` | 3238–3327 |
| Buscar/substituir | `findInRoteiro`, `findStepRoteiro`, `replaceCurrentInRoteiro`, `replaceAllInRoteiro` | 3330–3487 |
| Import grade semanal | `handleGradeSemanalImport`, `_gradeCellToTime`, `_gradeDowFromHeader`, `_gradeProgTitle`, `_gradeEpisodeId` | 3488–3728 |

**Ponto de entrada:** `init()` em `app.js:196` — chamado no `DOMContentLoaded`.

### 5.3 `banco-manager.js`

Gerenciador de importação/exportação do banco permanente. **590 linhas**.

- `_bmTodayStr()` — data no formato `YYYY-MM-DD` para nomes de arquivo.
- `_bmExcelTimeToHMS(v)` — converte fração decimal Excel → `HH:MM:SS`.
- `_bmDetectCols(headers)` — detecta índices de colunas por palavra-chave (case-insensitive).
- Funções públicas invocadas pelo HTML: importar/exportar **peças** e **programas** em JSON e XLSX, exclusão individual e em massa, com confirmação antes de operações destrutivas.

### 5.4 `pecas_dia.js`

Motor de importação das planilhas de peças do dia. **648 linhas**.

- `importPecasDiaExcel(file)` — abre XLSX, localiza a aba do dia:
  1. Match exato do nome (`22 MAR 26`).
  2. Fuzzy por `DD` + abreviação do mês.
  3. Fallback: dia-da-semana na célula `A3`.
- Parseia seções, extrai `code`, `descricao`, `tempo`, `qtd` e alimenta `state.pecasDia`.
- Contém a **lógica de inserção inteligente** que popula o roteiro com peças respeitando as regras de tipo/adjacência/janela.

### 5.5 `grade_base.js`

Base de dados **estática** com a grade de referência: `GRADE_BASE = { gradeByDay, gradeOrderByDay }`.

- Chaves numéricas em string: `"0"` Dom … `"6"` Sáb.
- Programas com múltiplas exibições recebem sufixos: `[2ª]`, `[3ª]`, etc.
- Base para validação de aderência à grade e para geração do roteiro.

### 5.6 `parts-store.js`

Camada `PartsStore` (IIFE em `window.PartsStore`). Fornece:

- **API estável** de CRUD (`list`, `get`, `add`, `update`, `remove`) sobre `state.pecas`, `state.programas` e peças do dia.
- **Persistência consistente** via `saveState()` (com fallback direto para `localStorage`).
- **Pub/Sub** (`subscribe`) — pronto para futuras telas reativas.
- **Ponto único de migração** para nuvem: basta trocar a implementação interna mantendo a assinatura.

### 5.7 `api-sync.js`

Camada opcional `API` (IIFE em `window.API`).

- **Modo local** (`file://`): todas as operações são **no-op** — o app roda 100% no cliente.
- **Modo servidor** (`http://` / `https://`): cliente REST simples com header `X-Usuario`, endpoints:
  - `GET /api/roteiro/:k`, `PUT /api/roteiro/:k`
  - `GET /api/roteiros`
  - `GET/PUT /api/pecas-dia/:k`
  - `GET/PUT /api/grade/:dow`
  - `GET/PUT /api/banco/pecas`
  - `GET/PUT /api/banco/programas`

Este arquivo é um **stub** — a implementação completa vive no pacote SERVIDOR.

### 5.8 `data.js`

Seed inicial. Exporta `INITIAL_PECAS` (e provavelmente `INITIAL_PROGRAMAS`) — array grande em uma única linha com objetos `{code, descricao, tempo, midia, type, validade, obs, categoria}`. Usado quando `localStorage` está vazio.

---

## 6. Fluxos principais

### 6.1 Importar peças do dia (XLSX)

```text
usuário seleciona .xlsx
  → handlePecasDiaImport (app.js)
  → importPecasDiaExcel (pecas_dia.js)
      → localiza aba do dia
      → parseia seções
      → state.pecasDia = [...]
  → renderPecasPanel()
  → (opcional) mergeBancoFromRoteiro se autoBanco
```

### 6.2 Gerar roteiro

```text
loadGrade(dow) + loadGradeOrder(dow) (grade do dia)
  → buildRoteiroFromPrograms(programs)
       - insere VH classificação (se ativo)
       - para cada programa: blocos + break slots + VH a seguir/assistindo/daqui a pouco
       - injeta pecasFixas nas posições configuradas
  → recalcTimes()
  → renderRoteiro()
  → validateRoteiroRegras() → applyRegraWarningsToDom()
```

### 6.3 Validação de grade (BL01)

- Para cada bloco `BL01` de programa, compara horário calculado com `GRADE_BASE`.
- Diferença ≤ `gradeTolerancia` → ✓ verde.
- Diferença > tolerância → aviso; usuário pode `ackGradeAviso(key)` para ocultar até a chave mudar (`state.gradeAcked`).
- `fixGradeFromRoteiro()` sobrescreve a grade do dia com os horários atuais.

### 6.4 Exportações

| Formato | Função | Biblioteca |
|---|---|---|
| XLSX estilizado | `exportXLSX()` | `xlsx-js-style` (cores, bordas, fontes) |
| XLSX simples | `exportExcel()` | idem, sem estilos |
| PDF | `exportPDF()` | `jspdf` + `autotable` |
| JSON | `exportJSON()` | nativo |

### 6.5 Banco permanente (peças/programas)

- Modal com listas filtráveis (`filterModalList`).
- Import via `importBanco` (JSON/XLSX) ou `banco-manager.js`.
- Export via `exportBancoXLSX` / `exportBancoJSON`.
- Exclusão com confirmação.

### 6.6 Backup automático

- `setupAutoBackup()` pede pasta via **File System Access API**.
- `runAutoBackup()` a cada `REGRAS.backupIntervaloMin` minutos grava um JSON com timestamp.

---

## 7. Persistência e sincronização

Camadas, do mais baixo ao mais alto:

```text
localStorage[roteiroApp]     ← saveState()
localStorage[roteiroRegras]  ← saveRegras()
localStorage[roteiroTheme]   ← setTheme()
localStorage[roteiroProgramColors]
localStorage[roteiroUsuario] ← identificação p/ API
File System Access API        ← auto-backup (opcional, escrita)
PartsStore                    ← wrapper CRUD + subscribe sobre state
API (api-sync.js)             ← REST opcional (servidor de intranet)
```

**Migração local → servidor:** substituir `api-sync.js` pela versão do pacote SERVIDOR. Todos os pontos que hoje chamam `API.saveXxx/loadXxx` continuarão funcionando sem alterações no `app.js`.

---

## 8. Convenções de código

### Tipos de peça

| Tipo | Significado |
|---|---|
| `ECHM` | Chamada de manutenção |
| `ECHE` | Chamada especial |
| `EINT` | Interprograma governamental |
| `RCOM` | Rede — comunicação (MEC) |
| `RPOL` | Rede — política (janela 19:30–22:30) |
| `EVNH` | Vinheta especial |
| VH `*` | Vinhetas de identificação / classificação / assinatura |

### Sufixos de grade

Programas com múltiplas exibições no mesmo dia recebem sufixo `[2ª]`, `[3ª]`… nas chaves de `GRADE_BASE`.

### Tempo

- Formato canônico: string `HH:MM:SS`.
- Excel: fração decimal do dia (`0.5 = 12:00:00`), convertida por `_bmExcelTimeToHMS`.
- Internamente sempre em **segundos** (`timeToSec` / `secToTime`).

### Datas

- `dateKey(d)` → string `YYYY-MM-DD` (chave em `localStorage` e API).
- `_currentDow()` → 0 (Dom) … 6 (Sáb), usado para indexar `GRADE_BASE`.

---

## 9. Guia de manutenção

| Tarefa | Onde mexer |
|---|---|
| Mudar janela RPOL | Painel Admin → `regrasTipos.RPOL.inicio/fim` (ou `REGRAS_DEFAULT.rpolInicio/rpolFim`) |
| Alterar tolerância da grade | Admin → `gradeTolerancia` |
| Mudar nº de breaks por bloco | Admin → `breakSlotsPorBloco` |
| Adicionar novo tipo de peça | (1) Incluir em `TIPOS_CONFIGURAVEIS` (`app.js:3152`) · (2) adicionar entrada em `regrasTipos` do `REGRAS_DEFAULT` · (3) tratar cor/ícone em `renderRoteiro`/`renderPecasSidebar` |
| Adicionar coluna na exportação | Ajustar `exportXLSX` / `exportPDF` (colunas + headers + cellStyles) |
| Trocar tema padrão | `loadTheme()` (`app.js:2512`) — default `theme-day` |
| Adicionar tema | `index.html` (novo bloco `body.theme-<nome>`) + opção no seletor da UI |
| Adicionar VH nova | Novo campo em `REGRAS_DEFAULT.vh...` + tratamento em `buildRoteiroFromPrograms` |
| Modificar grade base | Editar `grade_base.js` OU usar modal de grade (`openGradeModal`) OU importar via `applyGradeSemanalImport` |
| Migrar para servidor | Substituir `api-sync.js` pela versão SERVIDOR do pacote |
| Ajustar intervalo de backup | Admin → `backupIntervaloMin` (reload após alterar) |

---

## 10. Riscos conhecidos / TODO

- **Acoplamento por globais**: `state`, `REGRAS`, `API`, `PartsStore` moram em `window`. Refatorar para módulos ES exigiria reescrever handlers `onclick=` do HTML.
- **Sem testes automatizados** — validações são visuais. Considerar suíte de testes para `timeToSec`, `buildRoteiroFromPrograms`, `validateRoteiroRegras`.
- **Render "big-bang"** (`renderAll` reconstrói DOM): mitigado por `debounce(220ms)` nas versões `*Debounced`, mas ainda custoso em roteiros longos.
- **`data.js` em uma linha só** dificulta diff/merge — considerar formatar como JSON separado.
- **File System Access API** só funciona em Chromium; em Firefox o auto-backup em pasta é ignorado silenciosamente.
- **Import XLSX** depende do nome/estrutura da aba; se a planilha mudar de layout, os fallbacks em `pecas_dia.js` podem falhar — verificar `A3` e nomes de aba.
- **Sincronização servidor**: sem resolução de conflito — última escrita vence. Se dois usuários editarem o mesmo dia, o mais recente sobrescreve.
- **Peças fixas** têm 4 posições (`inicio`, `fim`, `antes_programa`, `apos_assinatura`) — expandir exigirá ajustes em `buildRoteiroFromPrograms`.

---

_Documento gerado a partir da inspeção estática de `index.html`, `app.js`, `banco-manager.js`, `pecas_dia.js`, `grade_base.js`, `parts-store.js`, `api-sync.js` e `data.js` — versão do projeto anexada em 2026._

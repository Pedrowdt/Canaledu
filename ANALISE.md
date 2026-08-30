# Canaledu — Análise do projeto e propostas de melhoria

Revisão de ponta a ponta do repositório (código, banco, documentação e processo de release), feita em 29/08/2026, com o projeto na versão `2.6.1`. Organizada por área, da mais crítica para a mais cosmética, com uma tabela de priorização ao final.

---

## 1. Segurança

### 1.1 XSS armazenado em Peças e Programas (crítico, correção rápida)

A tabela principal do cadastro (`pecas-programas.js`, função `render()`) monta as linhas com `innerHTML` inserindo `code`, `descricao`, `obs`, `tempo`, `type` e `midia` **sem escapar**:

```js
document.getElementById('tbody').innerHTML = filtered.map(p => isPecas ? `
  <tr>
    <td class="code-cell">${p.code}</td>
    <td><div class="desc-main">${p.descricao}</div>
        ${p.obs?`<div class="desc-obs">${p.obs}</div>`:''}</td>
    ...
```

O arquivo já tem uma função `escapeHtml()` (usada no painel de log), só não é aplicada aqui. Como `descricao`/`obs` são campos de texto livre editáveis por qualquer conta autenticada, isso é um XSS armazenado real: uma conta comprometida/phishada consegue gravar um payload (ex. um `<img onerror=...>` lendo `localStorage` e exfiltrando o token de sessão do Supabase) que executa no navegador de **todo o resto da equipe** assim que a tela de Cadastro é aberta. Não é internet-facing (exige login), mas dentro de uma equipe pequena isso é exatamente o vetor de movimento lateral mais perigoso — uma conta cai, todas caem.

O caminho equivalente no Roteiro (`app.js`) já usa `escHtml()` corretamente. **Proposta:** aplicar `escapeHtml()` nos mesmos campos em `pecas-programas.js`, e adicionar um teste de regressão (renderizar um item com `descricao: '<img src=x onerror=alert(1)>'` e afirmar que o HTML final não contém uma tag executável).

### 1.2 Revogação de acesso anônimo nunca foi commitada

`db/README.md` já sinaliza isso, mas vale destacar: `AUTENTICACAO.md` referencia `db/004_autenticacao.sql` como o script que revoga qualquer `GRANT` residual do papel `anon` em `pecas`/`programas` — **esse arquivo nunca existiu no repositório**. As migrações que existem (`001`, `006`) só concedem a `authenticated`/`service_role`, o que é o comportamento padrão correto do Supabase, mas ninguém confirmou por escrito, num script versionado e reexecutável, que o papel `anon` não tem nenhum `GRANT` herdado de antes (ex. de quando o projeto ainda usava só `shared_data`). **Proposta:** escrever e commitar o `004_autenticacao.sql` que falta (um `REVOKE ALL ... FROM anon` idempotente nas tabelas relevantes), rodá-lo, e então apagar o aviso do `db/README.md`.

### 1.3 `fluxo de mão única` é bem desenhado — vale só reforçar o teste

Ao contrário do que a separação de telas sugere à primeira vista, a restrição "só Peças e Programas grava no cadastro" **é** aplicada no banco (não só por convenção no cliente): `006_pecas_one_way.sql` revoga `INSERT/UPDATE/DELETE` de `authenticated` e usa um trigger de guarda de escopo (`app.cadastro_scope`) que só as funções `fn_salvar_pecas`/`fn_salvar_programas` (SECURITY DEFINER) podem abrir. Isso é defesa em profundidade de verdade, não teatro de segurança client-side. Vale só garantir que `db/testar-schema.mjs` cubra explicitamente "uma sessão tenta fazer UPDATE direto na tabela e recebe 42501" para não regredir silenciosamente numa migração futura.

---

## 2. Confiabilidade de sincronização (o padrão por trás dos últimos 3 bugs corrigidos)

Nas últimas rodadas corrigimos, em sequência: (a) validade em formato inconsistente entre telas, (b) o Roteiro perdendo trabalho ao trocar de tela, (c) Peças e Programas perdendo edições/exclusões ao recarregar. As três vêm da mesma causa estrutural: **cada tela reinventa, de forma um pouco diferente, o mesmo problema de "debounce + localStorage + reload"** — `cloud-sync.js` (Roteiro) e `pecas-programas.js` (Cadastro) têm cada um seu próprio `pushTimer`, sua própria marca de pendência (`roteiroSyncPending` vs. `cadastroSyncPendente`), sua própria função de flush. Funciona, mas é código duplicado que vai precisar da mesma correção de novo na próxima tela nova que a equipe criar.

**Proposta:** extrair um módulo único (`sync-outbox.js`, carregado como os demais scripts não-modulares) com uma API pequena e reaproveitável:

```js
SyncOutbox.create({ key, debounceMs, push: async (payload) => {...} })
  .schedule(payload)   // grava local + agenda push, marca pendente
  .flush()             // cancela debounce, envia agora
  .isPending()
  .recoverOnBoot(loadFromCloud)  // decide local vs. nuvem e reenvia se preciso
```

Isso elimina a duplicação, e a próxima tela (ex. se um dia existir um painel de Admin separado) ganha a proteção de graça em vez de precisar "lembrar" de reimplementá-la.

**Proposta complementar — testar o cenário fim-a-fim:** os testes atuais (`cloudSyncRoteiro.test.mjs`, `pecasProgramasRascunho.test.mjs`) cobrem bem a lógica de merge/pendência isoladamente, mas nenhum teste real de navegador (Playwright, por exemplo) simula "editar → fechar aba no meio do debounce → reabrir → conferir que nada sumiu". Dado que os três bugs recentes só apareceram em uso real, um smoke test E2E desse fluxo específico teria pego pelo menos dois deles antes de chegar em produção.

---

## 3. Arquitetura e organização do código

### 3.1 `app.js` é um monólito de 4.3k linhas

Um único arquivo mistura: renderização do roteiro, drag-and-drop, geração automática de roteiro, painel Admin (regras/grade), exportação XLSX/PDF, alertas de bloco, undo, log, sidebar de peças. Isso já dificultou a implementação das últimas features (era preciso ler centenas de linhas de contexto para achar o ponto certo de gancho) e vai piorar conforme o arquivo cresce. Boa parte da lógica de negócio "pura" (cálculo de horários, geração de roteiro, casamento de VH) já foi corretamente extraída para `src/core/*` nas últimas correções — vale continuar esse movimento e migrar também as partes de `app.js` que não dependem de DOM (ex. a lógica de `buildSmartRoteiro`, `recalcTimes`, undo).

**Proposta, incremental e de baixo risco** (não requer reescrever tudo de uma vez):
1. Continuar extraindo funções puras para `src/core/` sempre que mexer em algo por outro motivo (já é o padrão adotado nas últimas correções — só formalizar como convenção do time).
2. Separar por responsabilidade os arquivos que já são só "visual" (ex. `renderRoteiro`, `renderPecasSidebar`, os modais) dos que são "regra de negócio", mesmo mantendo tudo como scripts clássicos por enquanto.
3. Avaliar, a médio prazo, adotar um bundler leve (esbuild/Vite) só para poder usar `import`/`export` de verdade em `app.js`/`pecas-programas.js`/`cloud-sync.js` — isso eliminaria a necessidade das "réplicas não-modulares" que hoje existem em 3-4 lugares (ex. `parseValidade`/`matchVhDaquiForNext` estão duplicados entre `src/core/*.js` e `app.js`/`pecas_dia.js` porque esses scripts não podem dar `import`). Não é urgente, mas é a raiz de várias duplicações que exigem lembrar de "corrigir nos dois lugares".

### 3.2 Carregamento dinâmico de scripts via `cloud-sync.js`

`SCRIPTS_TO_LOAD` (`api-sync.js`, `grade_base.js`, `data.js`, `parts-store.js`, `pecas_dia.js`, `app.js`, `banco-manager.js`) é injetado via `<script>` dinâmico em vez de tags estáticas no `index.html`. Funciona, mas esconde a ordem de dependência real do HTML (quem olha o `index.html` não vê que `app.js` é carregado) e dificulta debug (o navegador mostra os scripts como injetados, não como parte do documento original). **Proposta:** documentar explicitamente essa lista no topo do `index.html` (um comentário listando a ordem) e, se/quando entrar um bundler, isso desaparece naturalmente.

---

## 4. Higiene do repositório (dead code e arquivos de trabalho commitados)

Achados concretos, todos de baixo risco para remover:

- **`activity-log.js` (159 linhas) está órfão** — não é referenciado em nenhum HTML nem em `SCRIPTS_TO_LOAD`. Foi superado por `canal-log.js` (mencionado no próprio CHANGELOG, entrada 2.4.1: "consolidação do log"). Remover.
- **`multiusuario.test.mjs` na raiz é uma cópia idêntica** de `tests/unit/multiusuario.test.mjs` — `diff` não mostra nenhuma diferença. Como o `vitest.config.js` só inclui `src/**` e `tests/**`, a cópia da raiz nunca roda; é só ruído. Remover.
- **`patch-mao-unica.diff` e `ALTERACOES.diffstat.txt`** parecem ser artefatos de uma sessão de trabalho anterior (um patch já aplicado e um dump de `git diff --stat`), não documentação. Remover — se o histórico do patch importa, ele já está no `git log`.
- **`supabase-schema.sql` (raiz) está desatualizado em relação a `db/00*.sql`** — ver próxima seção, é mais um problema de documentação do que de dead code, mas o arquivo em si compete com a fonte de verdade atual.

**Proposta geral:** depois de remover esses arquivos, adicionar um `.gitignore` (o projeto não tem nenhum!) cobrindo pelo menos `node_modules/` — hoje ele só não está versionado por sorte/disciplina manual, não por configuração.

---

## 5. Documentação e processo de deploy

### 5.1 `DEPLOY.md` manda rodar o schema errado

O guia de deploy, passo a passo 1.4, instrui a colar `supabase-schema.sql` (raiz) no SQL Editor — esse arquivo só cria a tabela legada `shared_data`. A arquitetura atual (tabelas relacionais `pecas`/`programas`, RLS, fluxo de mão única, `activity_log`) vive em `db/001_pecas_programas.sql` até `db/006_pecas_one_way.sql`, que o `DEPLOY.md` não menciona. **Alguém seguindo o guia hoje, do zero, monta um Supabase incompleto** — o sistema ainda funciona (há fallback documentado em `db/README.md` para o formato legado), mas sem o cadastro relacional, sem RLS granular, sem log de atividades e sem o fluxo de mão única reforçado no banco. **Proposta (prioridade alta, é rápido de corrigir):** atualizar o passo 1.4 do `DEPLOY.md` para apontar para a sequência `db/001` → `006`, com uma frase de cada um, e sinalizar `supabase-schema.sql` como legado/obsoleto (ou apagá-lo, se `002_migrar_shared_data.sql` cobre a migração de quem já estava nesse formato).

### 5.2 Automação de versão referenciada mas nunca conectada

Isso explica por que a versão ficou presa em `2.2.0` por 4 releases seguidas, corrigido manualmente duas vezes nesta própria sessão: `scripts/sync-version.js` tem o comentário *"Roda automaticamente depois de cada bump de versão (via `.versionrc.json` → `postbump`)"* — mas **não existe nenhum `.versionrc.json` no repositório**. `npm run release` (que chama `standard-version`) nunca de fato invoca esse script, então toda vez que alguém rodou (ou devia ter rodado) o release, `version.js`/`version.txt` ficaram para trás manualmente. **Proposta:**

```json
// .versionrc.json
{
  "scripts": {
    "postbump": "node scripts/sync-version.js && node -e \"require('fs').writeFileSync('version.txt', require('./package.json').version)\""
  }
}
```

Isso resolve a causa raiz de um problema que já tivemos que corrigir manualmente duas vezes. Complementar: um teste simples (`tests/unit/versaoConsistente.test.mjs`) que falha se `package.json.version`, `version.js` e `version.txt` não baterem — pega o problema no CI antes de virar mais um "a versão está errada de novo".

### 5.3 Muitos `.md` na raiz, sem um índice

`README.md`, `AUTENTICACAO.md`, `CONSISTENCIA.md`, `DEPLOY.md`, `DOCUMENTACAO.md`, `COMMITS.md`, `CHANGELOG.md`, `db/README.md` — todos com conteúdo válido e não-redundante entre si (bom sinal), mas sem nenhum apontando para os outros. Quem chega no projeto não sabe por onde começar. **Proposta:** um índice curto no topo do `README.md` linkando cada um pelo que ele resolve ("quer publicar? DEPLOY.md" / "quer entender por que uma escrita pode falhar? CONSISTENCIA.md" / etc.).

---

## 6. Testes

O projeto foi de ~30 para 94 testes ao longo desta sessão, cobrindo bem a lógica pura (`src/core/*`) e, cada vez mais, os scripts clássicos via extração com `new Function` (padrão que se consolidou e vale documentar em `COMMITS.md` ou num `CONTRIBUTING.md` para quem for escrever o próximo teste seguir o mesmo molde). Lacunas que ficaram:

- **Nada de `app.js` além do que foi extraído nas últimas correções** (`registrarUndoSeMudou`, `popUndoEntry`, `sortPecasByTempo`) tem cobertura — `buildSmartRoteiro`, `recalcTimes`, a geração de roteiro a partir da Grade Semanal e o parsing de importação CSV/XLSX continuam sem teste automatizado, apesar de serem o núcleo do produto.
- **Nenhum teste de RLS/trigger "negativo"** (confirmar que uma escrita indevida é *rejeitada* pelo banco) — só o caminho feliz é validado hoje em `db/testar-schema.mjs`.
- **Nenhum E2E** (já mencionado na seção 2).

**Proposta de ordem de prioridade:** (1) teste negativo de RLS/one-way-guard, é barato e protege a garantia de segurança mais importante do sistema; (2) extrair e testar `buildSmartRoteiro`/`recalcTimes` como funções puras (mesmo padrão já usado); (3) E2E como investimento maior, só quando o time achar que vale a manutenção de um Playwright.

---

## 7. Performance e UX (achados menores)

- `renderPecasSidebar()` e `renderRoteiro()` recriam o `innerHTML` inteiro da lista a cada chamada — plenamente aceitável no volume de dados atual (dezenas/poucas centenas de itens), mas se o banco de peças crescer para milhares de itens, vale considerar paginação ou virtualização na sidebar.
- O painel de log (`openLog`) busca até 200 entradas da nuvem toda vez que é aberto, sem paginação nem filtro de data — hoje é rápido, mas cresce sem limite com o tempo de uso da equipe; um filtro de período (últimas 24h/7 dias) evitaria a consulta ficar pesada daqui a alguns meses.
- Não há indicação visual de "salvando..." além do rodapé de status (`setSyncStatus`) — em conexões lentas, um usuário pode não perceber que uma exclusão ainda está em trânsito e fechar a aba achando que já foi salva. Como a rede de segurança de rascunho pendente (seção 2) já cobre a perda de dados, isso é mais uma melhoria de clareza do que de correção.

---

## 8. Priorização sugerida

| # | Item | Impacto | Esforço | Categoria |
|---|------|---------|---------|-----------|
| 1 | Escapar `descricao`/`obs`/etc. no render de Peças e Programas (XSS) | Alto | Baixo | Segurança |
| 2 | Corrigir `DEPLOY.md` para apontar `db/001`–`006` em vez de `supabase-schema.sql` | Alto | Baixo | Documentação |
| 3 | Criar `.versionrc.json` conectando `postbump` a `sync-version.js` + `version.txt` | Médio | Baixo | Processo |
| 4 | Escrever o `db/004_autenticacao.sql` que falta (revogação de `anon`) | Alto | Baixo/Médio | Segurança |
| 5 | Remover dead code (`activity-log.js`, duplicata de teste, `.diff`/`.diffstat` soltos) + `.gitignore` | Baixo | Baixo | Higiene |
| 6 | Teste negativo de RLS/one-way-guard | Médio | Baixo | Testes |
| 7 | Extrair `sync-outbox.js` reaproveitável (Roteiro + Cadastro) | Médio | Médio | Arquitetura |
| 8 | Extrair/testar `buildSmartRoteiro`/`recalcTimes` como funções puras | Médio | Médio | Testes |
| 9 | Índice cruzado nos `.md` da raiz | Baixo | Baixo | Documentação |
| 10 | Smoke test E2E do fluxo "editar → reload → nada some" | Alto (previne regressão) | Alto | Testes |
| 11 | Modularizar `app.js` com bundler (Vite/esbuild) | Alto (a longo prazo) | Alto | Arquitetura |

Os itens 1–5 são todos de baixo esforço e alto valor imediato — dá para fazer numa única sessão de trabalho. Os itens 7, 8, 10 e 11 são investimentos estruturais que valem a pena, mas fazem mais sentido conforme o time/o produto cresce, não como urgência.

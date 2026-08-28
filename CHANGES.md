# Correções aplicadas

Este pacote contém o projeto `Canaledu` com as duas correções descritas no
relatório aplicadas diretamente no código, mais os testes correspondentes.
Rode `npm install && npm test` para conferir (71 testes, todos passando).

## 1. Data de validade (kill date) — formato único ISO

- **`src/core/normalize.js`**: novo helper único —
  `parseValidade(v)` (aceita `AAAA-MM-DD`, `DD/MM/AAAA`, `DD/MM/AA` e serial
  de Excel), `validadeToISO(v)` (forma canônica para armazenamento/
  comparação) e `formatValidade(v)` (`DD/MM/AAAA` só para exibição), além de
  `isValidadeExpired(v, ref)`. Cobertos por `src/core/normalize.test.js`.
- **`app.js`**: `isExpired()` reescrita para usar a mesma lógica de parsing
  (réplica não-modular, já que `app.js` é `<script>` clássico injetado pelo
  `cloud-sync.js` e não pode usar `import`). Agora uma peça com
  `validade: "2026-08-04"` é corretamente detectada como vencida. O card do
  Banco de Peças e a exportação XLSX passam a exibir `DD/MM/AAAA` via
  `formatValidade()`.
- **`roteiro-pecas-bridge.js`**: a ponte cadastro→roteiro agora normaliza
  `validade` para ISO em `combinar()` — tanto o cadastro remoto quanto o
  snapshot local e a fila de pendências passam pelo mesmo
  `validadeToISO()`. Testado em `tests/unit/roteiroPecasBridge.test.mjs`.
- **`pecas_dia.js`**: o import de Excel de peças do dia agora grava
  `validade` sempre em ISO (antes gravava `DD/MM/YY` cru). A heurística de
  "restrição" (quando a célula de validade é texto livre, não uma data)
  passa a usar o parser em vez de uma regex de `DD/MM/AA`. Testado em
  `tests/unit/pecasDia.test.mjs`.
- **`pecas-programas.js`**: sem mudança de comportamento — já grava/lê ISO
  corretamente (`kStatus`); só um comentário apontando o mesmo contrato.

Nenhuma migração de banco foi necessária — a coluna já é `date`; a
divergência era só de formatação na camada JS.

## 2. VH "Daqui a Pouco" inserindo o programa errado

- **`src/core/pecasCatalog.js`**: nova função pura e testável
  `matchVhDaquiForNext(nextProgramTitle, vhCandidates, minCoverage=0.7)`:
  - normaliza removendo acentos **e** pontuação (a vírgula que antes
    quebrava o match, ex. `PORTUGUÊS DAQUI, PORTUGUÊS DE LÁ`, agora vira
    espaço);
  - remove o prefixo `VH DAQUI A POUCO` com regex ancorada no início (não
    `replace` de substring), então `DAQUI`/`POUCO` do próprio rótulo não
    voltam a participar do match;
  - troca "1 palavra qualquer casa" por cobertura mínima das palavras
    significativas do título (≥70% por padrão) e escolhe a **melhor**
    candidata, não a primeira — empate ou cobertura insuficiente ⇒ não
    insere nada (mesmo comportamento conservador de antes);
  - stop list ampliada e sem duplicata (`DAQUI`, `POUCO`, `PGM`, `SEGUIR`,
    `COM`, `DOS`, `DAS`, `NOS`, `NAS`, etc).
  - Testado em `src/core/pecasCatalog.test.js`.
- **`pecas_dia.js`**: `findVhDaquiForNext()` agora delega para uma réplica
  não-modular da mesma função (`matchVhDaquiForNext`), removendo a lógica
  frouxa antiga. Testado em `tests/unit/pecasDia.test.mjs` com os casos do
  relatório (título com vírgula, dois programas com palavra em comum,
  ausência de VH adequada).

## O que não foi alterado

- Nenhuma migração de banco (`db/*.sql`) foi necessária.
- O formato canônico interno permanece ISO (`AAAA-MM-DD`); `DD/MM/AAAA`
  existe apenas na apresentação/exportação.

## 3. Roteiro "some" ao trocar para Peças e Programas e voltar

**Sintoma relatado:** editar o Roteiro do dia, ir para a tela de Cadastro
(Peças e Programas) e, ao voltar, o trabalho que tinha sido feito havia
desaparecido.

**Causa raiz — condição de corrida entre o debounce de sincronização e a
navegação de página inteira:**

- Cada edição no Roteiro só é enviada à nuvem depois de um **debounce de
  900ms** (`cloud-sync.js`, `patchLocalStorage()`). Toda nova edição
  reinicia esse temporizador.
- Trocar de tela (`cloudSyncOpenPecasProgramas()` → `location.href = ...`,
  e a volta é um `<a href="index.html">` comum em `pecas-programas.html`)
  é uma **navegação de página cheia**, não uma troca de aba dentro do
  mesmo app. Isso mata o `setTimeout` pendente sem aviso.
- Se o clique para trocar de tela acontecer antes dos 900ms passarem —
  o caso mais comum, já que normalmente a pessoa edita e já sai — o envio
  **nunca acontece**.
- Ao voltar para `index.html`, `fetchAndMergeCloudData()` recarrega tudo do
  zero e fazia `merged.roteiros = userRow?.roteiros || localRaw.roteiros || {}`:
  como `userRow.roteiros` (nuvem) quase sempre existe (só está
  desatualizado, não vazio), ele **sempre vencia**, mesmo sendo mais velho
  que o `localStorage` — apagando silenciosamente a edição que não teve
  tempo de subir. A sobrescrita ainda usava o `setItem` original (sem o
  patch), então nem disparava um novo envio.

**Correção, em duas partes (uma sem a outra ainda deixa brecha):**

1. **Nunca perder uma escrita local por causa da navegação**
   (`cloud-sync.js`):
   - Toda edição agora grava uma marca síncrona de "sincronização
     pendente" (`roteiroSyncPending` no `localStorage`) **antes** de
     agendar o debounce — essa marca sobrevive a um recarregamento de
     página, ao contrário de uma flag em memória.
   - Nova função `flushPendingSync()`: cancela o debounce e envia
     imediatamente. `cloudSyncOpenPecasProgramas()` agora é `async` e
     **aguarda** esse envio antes de trocar de página.
   - Um listener de `pagehide` chama o mesmo `flushPendingSync()` como
     rede de segurança para navegação fora do controle do app (botão
     voltar do navegador, fechar a aba).
   - A marca só é limpa depois que o `pushToCloud()` correspondente
     termina com sucesso — e usa um contador de sequência (`_editSeq`)
     para não confirmar por engano um envio que ficou desatualizado
     porque chegou uma edição nova enquanto ele estava em andamento.
2. **Nunca sobrescrever o roteiro local só porque a nuvem respondeu**
   (`fetchAndMergeCloudData()`): se a marca de pendência ainda estiver
   presente ao carregar a página (sinal de que o envio anterior não foi
   confirmado), a precedência é invertida — o `localStorage` vence tanto
   para `roteiros` quanto para `pecas_dia` — e o envio é refeito
   automaticamente em seguida, em vez de esperar a próxima edição do
   usuário.

Testado em `tests/unit/cloudSyncRoteiro.test.mjs`: marca pendente indo e
voltando, `patchLocalStorage` marcando antes do debounce, o cenário exato
do bug (nuvem desatualizada não pode sobrescrever o local pendente, e a
pendência é reenviada), e `flushPendingSync` enviando na hora.

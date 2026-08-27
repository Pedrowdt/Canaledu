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

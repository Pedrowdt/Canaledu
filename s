[1mdiff --git a/app.js b/app.js[m
[1mindex 1d2b604..5f6f159 100644[m
[1m--- a/app.js[m
[1m+++ b/app.js[m
[36m@@ -1891,8 +1891,7 @@[m [mfunction baseProgramTitle(desc) {[m
     .replace(/\s*T\d+\s*EP\s*\d+.*$/i, '')        // variante sem hífen antes de "T01 EP16"[m
     .replace(/\s*-\s*EP\s*\d+.*$/i, '')           // remove " - EP 01" sem indicação de temporada[m
     .replace(/\s+EP\s*\d+.*$/i, '')               // remove " EP01" sem indicação de temporada[m
[31m-    .replace(/\s*-\s*BL\s*\d+\s*$/i, '')   // remove " - BL 01"[m
[31m-    .replace(/\s*BL\s*\d+\s*$/i, '')          // remove " BL01" ou " BL 01"[m
[32m+[m[32m    .replace(/\s*-?\s*\bBL\s*\d+.*$/i, '')  // remove " - BL 01", " BL01" e o que vier depois (ex: "BL 01 (REPRISE)")[m
     .replace(/\s*\(.*?\)\s*$/, '')            // NOVO: remove parênteses no final (ex: "(reprise quarta 22h)")[m
     .replace(/\s*\d+'\s*$/, '')                // remove sufixo de minutagem da grade, ex: " 10'"[m
     .trim();[m
[36m@@ -1908,6 +1907,28 @@[m [mfunction getEpisodeId(desc) {[m
   return m ? m[0].replace(/\s+/g, '') : '';[m
 }[m
 [m
[32m+[m[32m/** Número do bloco na descrição ("BL 01", "BL1", "BL 02 (REPRISE)" -> 1, 1, 2); sem indicação assume 1. Réplica não-modular de src/core/normalize.js#getBlockNumber. */[m
[32m+[m[32mfunction getBlockNumber(desc) {[m
[32m+[m[32m  const match = String(desc || '').match(/BL\s*0*(\d+)/i);[m
[32m+[m[32m  return match ? parseInt(match[1], 10) : 1;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/** Ordena (sem mutar) os blocos de um programa: episódios na ordem da 1ª aparição e, dentro de cada um, por número de bloco. Estável. Réplica não-modular de src/core/normalize.js#sortBlocks. */[m
[32m+[m[32mfunction sortBlocks(blocks) {[m
[32m+[m[32m  const epOrder = new Map();[m
[32m+[m[32m  (blocks || []).forEach(b => {[m
[32m+[m[32m    const ep = getEpisodeId(b && b.descricao);[m
[32m+[m[32m    if (!epOrder.has(ep)) epOrder.set(ep, epOrder.size);[m
[32m+[m[32m  });[m
[32m+[m[32m  return (blocks || [])[m
[32m+[m[32m    .map((b, idx) => ({ b, idx }))[m
[32m+[m[32m    .sort((x, y) =>[m
[32m+[m[32m      epOrder.get(getEpisodeId(x.b.descricao)) - epOrder.get(getEpisodeId(y.b.descricao)) ||[m
[32m+[m[32m      getBlockNumber(x.b.descricao) - getBlockNumber(y.b.descricao) ||[m
[32m+[m[32m      x.idx - y.idx)[m
[32m+[m[32m    .map(o => o.b);[m
[32m+[m[32m}[m
[32m+[m
 /** Função central de geração automática. Recebe o array de programas do Notion e constrói o roteiro completo com VHs A SEGUIR, CLASSIFICAÇÃO INDICATIVA, breaks com __SLOT__, VH VC ESTA ASSISTINDO e ASSINATURAS. */[m
 function buildRoteiroFromPrograms(programs) {[m
   // A Grade Semanal (importada do XLSX) é a régua mestre: cada início de programa[m
[36m@@ -1954,22 +1975,27 @@[m [mfunction buildRoteiroFromPrograms(programs) {[m
     }[m
 [m
     // Coleta todos os blocos deste programa[m
[31m-    const blocks = [prog];[m
[32m+[m[32m    let blocks = [prog];[m
     let j = i + 1;[m
     while (j < programs.length && baseProgramTitle(programs[j].descricao) === baseTitle) {[m
       blocks.push(programs[j]);[m
       j++;[m
     }[m
 [m
[32m+[m[32m    // Blocos podem chegar fora de ordem física (BL 02 antes de BL 01): ordena[m
[32m+[m[32m    // por episódio (1ª aparição) e depois por número do bloco.[m
[32m+[m[32m    blocks = sortBlocks(blocks);[m
[32m+[m
     // ---- ANTES do 1º bloco: VH A SEGUIR ----[m
[31m-    const vhSeguir = findVhSeguir(prog.descricao);[m
[32m+[m[32m    const vhSeguir = findVhSeguir(blocks[0].descricao);[m
     if (vhSeguir) { roteiro.push({...vhSeguir}); cumSec += timeToSec(vhSeguir.tempo); }[m
 [m
     // ---- Blocos + BREAKS ----[m
     blocks.forEach((block, bIdx) => {[m
       // VH CLASSIFICAÇÃO (85283) antes de TODO bloco RPRO,[m
[31m-      // exceto quando a descrição contém BL02/BL03/BL04/BL05.[m
[31m-      if (!/BL\s*0[2-5]/i.test(block.descricao || '')) {[m
[32m+[m[32m      // exceto nos blocos 2 a 5 (BL02, BL 2, BL03...), via getBlockNumber().[m
[32m+[m[32m      const blN = getBlockNumber(block.descricao);[m
[32m+[m[32m      if (!(blN >= 2 && blN <= 5)) {[m
         const vhClassif = getVhClassificacao();[m
         if (vhClassif) { roteiro.push({...vhClassif}); cumSec += timeToSec(vhClassif.tempo); }[m
       }[m
[1mdiff --git a/src/core/normalize.js b/src/core/normalize.js[m
[1mindex eeec03c..10010c1 100644[m
[1m--- a/src/core/normalize.js[m
[1m+++ b/src/core/normalize.js[m
[36m@@ -20,8 +20,7 @@[m [mexport function baseProgramTitle(desc) {[m
     .replace(/\s*T\d+\s*EP\s*\d+.*$/i, '')[m
     .replace(/\s*-\s*EP\s*\d+.*$/i, '')[m
     .replace(/\s+EP\s*\d+.*$/i, '')[m
[31m-    .replace(/\s*-\s*BL\s*\d+\s*$/i, '')[m
[31m-    .replace(/\s*BL\s*\d+\s*$/i, '')[m
[32m+[m[32m    .replace(/\s*-?\s*\bBL\s*\d+.*$/i, '') // bloco e qualquer observação após ele (ex.: "BL 01 (REPRISE)")[m
     .replace(/\s*\(.*?\)\s*$/, '')[m
     .replace(/\s*\d+'\s*$/, '')[m
     .trim();[m
[36m@@ -34,6 +33,37 @@[m [mexport function getEpisodeId(desc) {[m
   return m ? m[0].replace(/\s+/g, '') : '';[m
 }[m
 [m
[32m+[m[32m/**[m
[32m+[m[32m * Número do bloco na descrição ("BL 01", "BL1", "BL 02 (REPRISE)" -> 1, 1, 2).[m
[32m+[m[32m * Sem indicação de bloco, assume 1 (programa de bloco único).[m
[32m+[m[32m */[m
[32m+[m[32mexport function getBlockNumber(desc) {[m
[32m+[m[32m  const match = String(desc || '').match(/BL\s*0*(\d+)/i);[m
[32m+[m[32m  return match ? parseInt(match[1], 10) : 1;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/**[m
[32m+[m[32m * Ordena (sem mutar a entrada) os blocos de um programa: episódios na ordem[m
[32m+[m[32m * em que aparecem pela 1ª vez e, dentro de cada episódio, por número de bloco.[m
[32m+[m[32m * Blocos de um mesmo episódio que chegaram intercalados com outro episódio[m
[32m+[m[32m * (EP01 BL01, EP02 BL01, EP01 BL02) voltam a ficar juntos. Ordenação estável:[m
[32m+[m[32m * empates preservam a ordem original.[m
[32m+[m[32m */[m
[32m+[m[32mexport function sortBlocks(blocks) {[m
[32m+[m[32m  const epOrder = new Map();[m
[32m+[m[32m  (blocks || []).forEach((b) => {[m
[32m+[m[32m    const ep = getEpisodeId(b && b.descricao);[m
[32m+[m[32m    if (!epOrder.has(ep)) epOrder.set(ep, epOrder.size);[m
[32m+[m[32m  });[m
[32m+[m[32m  return (blocks || [])[m
[32m+[m[32m    .map((b, idx) => ({ b, idx }))[m
[32m+[m[32m    .sort((x, y) =>[m
[32m+[m[32m      epOrder.get(getEpisodeId(x.b.descricao)) - epOrder.get(getEpisodeId(y.b.descricao)) ||[m
[32m+[m[32m      getBlockNumber(x.b.descricao) - getBlockNumber(y.b.descricao) ||[m
[32m+[m[32m      x.idx - y.idx)[m
[32m+[m[32m    .map((o) => o.b);[m
[32m+[m[32m}[m
[32m+[m
 /** "HH:MM:SS" | "MM:SS" -> segundos. */[m
 export function timeToSec(t) {[m
   if (!t) return 0;[m
[1mdiff --git a/src/core/pecasCatalog.js b/src/core/pecasCatalog.js[m
[1mindex 42ea879..af9fd76 100644[m
[1m--- a/src/core/pecasCatalog.js[m
[1m+++ b/src/core/pecasCatalog.js[m
[36m@@ -241,8 +241,7 @@[m [mexport function baseProgramTitle(desc) {[m
     .replace(/\s*T\d+\s*EP\s*\d+.*$/i, '')          // variante sem hífen antes de "T01 EP16"[m
     .replace(/\s*-\s*EP\s*\d+.*$/i, '')             // remove " - EP 01" sem temporada[m
     .replace(/\s+EP\s*\d+.*$/i, '')                 // remove " EP01" sem temporada[m
[31m-    .replace(/\s*-\s*BL\s*\d+\s*$/i, '')            // remove " - BL 01"[m
[31m-    .replace(/\s*BL\s*\d+\s*$/i, '')                // remove " BL01" ou " BL 01"[m
[32m+[m[32m    .replace(/\s*-?\s*\bBL\s*\d+.*$/i, '')           // remove " - BL 01", " BL01" e o que vier depois (ex: "BL 01 (REPRISE)")[m
     .replace(/\s*\(.*?\)\s*$/, '')                  // remove parênteses no final (ex: "(reprise quarta 22h)")[m
     .replace(/\s*\d+'\s*$/, '')                     // remove sufixo de minutagem da grade, ex: " 10'"[m
     .trim();[m
[1mdiff --git a/src/core/roteiroBuilder.js b/src/core/roteiroBuilder.js[m
[1mindex d4c381d..fbe4e15 100644[m
[1m--- a/src/core/roteiroBuilder.js[m
[1m+++ b/src/core/roteiroBuilder.js[m
[36m@@ -15,7 +15,7 @@[m
 // por outro lado, são só configuração (`regras.vh*`), sem depender de[m
 // catálogo.[m
 [m
[31m-import { baseProgramTitle, getEpisodeId, timeToSec, secToTime, normalizeKey } from './normalize.js';[m
[32m+[m[32mimport { baseProgramTitle, getEpisodeId, getBlockNumber, sortBlocks, timeToSec, secToTime, normalizeKey } from './normalize.js';[m
 [m
 const START_SECONDS_DEFAULT = 6 * 3600; // 06:00:00 — início padrão do roteiro[m
 [m
[36m@@ -249,20 +249,25 @@[m [mexport function buildRoteiroFromPrograms(programs, regras, grade, pecasFixas, ca[m
     }[m
 [m
     // Coleta todos os blocos consecutivos deste programa[m
[31m-    const blocks = [prog];[m
[32m+[m[32m    let blocks = [prog];[m
     let j = i + 1;[m
     while (j < list.length && baseProgramTitle(list[j].descricao) === baseTitle) {[m
       blocks.push(list[j]);[m
       j++;[m
     }[m
 [m
[32m+[m[32m    // Blocos podem chegar fora de ordem física (BL 02 antes de BL 01): ordena[m
[32m+[m[32m    // por episódio (1ª aparição) e depois por número do bloco.[m
[32m+[m[32m    blocks = sortBlocks(blocks);[m
[32m+[m
     // ── Antes do 1º bloco: VH A SEGUIR ──[m
[31m-    const vhSeguir = findVhSeguir(prog.descricao, r, catalogo);[m
[32m+[m[32m    const vhSeguir = findVhSeguir(blocks[0].descricao, r, catalogo);[m
     if (vhSeguir) { roteiro.push({ ...vhSeguir }); cumSec += timeToSec(vhSeguir.tempo); }[m
 [m
     // ── Blocos + breaks ──[m
     blocks.forEach((block, bIdx) => {[m
[31m-      if (!/BL\s*0[2-5]/i.test(block.descricao || '')) {[m
[32m+[m[32m      const blN = getBlockNumber(block.descricao);[m
[32m+[m[32m      if (!(blN >= 2 && blN <= 5)) {[m
         const vhClassif = getVhClassificacao(r);[m
         if (vhClassif) { roteiro.push({ ...vhClassif }); cumSec += timeToSec(vhClassif.tempo); }[m
       }[m

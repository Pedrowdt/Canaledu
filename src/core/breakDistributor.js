// =====================================================
// DISTRIBUIÇÃO INTELIGENTE DE BREAKS, CHAMADAS E INTERPROGRAMAS
// GNU GPL v3 · Canal Educação / MEC · 2026
// =====================================================
(function (global) {
  'use strict';

  function timeToSec(t) {
    if (!t) return 0;
    const parts = String(t).trim().split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  function secToTime(s) {
    if (s == null || isNaN(s) || s < 0) return '00:00:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
  }

  function normalizeKey(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function extractTheme(p) {
    if (!p) return '';
    if (p.programaRelacionado) return normalizeKey(p.programaRelacionado);
    if (p.programa_relacionado) return normalizeKey(p.programa_relacionado);
    const desc = normalizeKey(p.descricao || '');
    return desc
      .replace(/^(PGM|VH\s+A\s+SEGUIR|VH\s+VC\s+ESTA\s+ASSISTINDO|CHAMADA|INTERPROGRAMA|VT)\s*/i, '')
      .replace(/\s*-\s*(T\s*\d+|EP\s*\d+|BL\s*\d+).*$/i, '')
      .trim();
  }

  function isValidadeExpired(val) {
    if (!val) return false;
    const match = String(val).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return false;
    const [, d, m, y] = match;
    const exp = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59);
    return exp.getTime() < Date.now();
  }

  function findCombinationForDuration(pecas, targetSec, maxItems = 4) {
    const valid = pecas.filter(p => {
      const s = timeToSec(p.tempo);
      return s > 0 && s <= targetSec;
    });

    let bestCombination = null;
    let minDiff = targetSec + 1;

    function backtrack(startIndex, currentCombo, currentSum) {
      const diff = Math.abs(targetSec - currentSum);
      if (diff < minDiff) {
        minDiff = diff;
        bestCombination = [...currentCombo];
      }
      if (diff === 0 || currentCombo.length >= maxItems) return;

      for (let i = startIndex; i < valid.length; i++) {
        const pSec = timeToSec(valid[i].tempo);
        if (currentSum + pSec <= targetSec) {
          currentCombo.push(valid[i]);
          backtrack(i + 1, currentCombo, currentSum + pSec);
          currentCombo.pop();
          if (minDiff === 0) return;
        }
      }
    }

    backtrack(0, [], 0);
    return minDiff === 0 ? bestCombination : null;
  }

  function distribuirPecasNosBreaks(roteiro, pecas, options = {}) {
    const startSec = Number(options.startSec) || 21600;
    const regras = options.regras || {};

    const intervaloChamada = Number(regras.breakIntervaloMinChamada ?? 90) * 60;
    const intervaloInterprograma = Number(regras.breakIntervaloMinInterprograma ?? 120) * 60;
    const intervaloComercial = Number(regras.breakIntervaloMinComercial ?? 60) * 60;
    const antiAdjacenciaTema = regras.breakAntiAdjacenciaTema !== false;
    const preencherGaps = regras.breakPreencherGaps !== false;

    const pecasAtivas = (pecas || []).filter(p => {
      if (p.ativo === false || p.ativo === 'false') return false;
      if (isValidadeExpired(p.validade)) return false;
      return true;
    });

    const exibições = {};
    const lastSeenSec = {};
    const outRoteiro = [];
    let cumSec = startSec;

    let chamadasPreenchidas = 0;
    let interprogramasPreenchidos = 0;
    let gapsResolvidos = 0;
    let slotsVaziosRestantes = 0;

    let prevAllocatedTheme = null;
    let prevAllocatedType = null;

    function findSurroundingProgramTheme(idx) {
      for (let i = idx - 1; i >= 0; i--) {
        const item = roteiro[i];
        if (item.type === 'PGM' || (!item.type?.startsWith('__') && !item.type?.startsWith('E'))) {
          return extractTheme(item);
        }
      }
      for (let i = idx + 1; i < roteiro.length; i++) {
        const item = roteiro[i];
        if (item.type === 'PGM' || (!item.type?.startsWith('__') && !item.type?.startsWith('E'))) {
          return extractTheme(item);
        }
      }
      return null;
    }

    function isEligible(p, currentSec, neighborProgTheme) {
      const pTheme = extractTheme(p);

      if (antiAdjacenciaTema) {
        if (prevAllocatedTheme && pTheme && prevAllocatedTheme === pTheme) {
          return false;
        }
        if (neighborProgTheme && pTheme && neighborProgTheme === pTheme) {
          return false;
        }
      }

      if (p.type === 'ECOM' && prevAllocatedType === 'ECOM') {
        return false;
      }

      let minIntervalo = 0;
      if (p.type === 'ECHM' || p.type === 'ECHE') minIntervalo = intervaloChamada;
      else if (p.type === 'EINT' || p.type === 'EINS') minIntervalo = intervaloInterprograma;
      else if (p.type === 'ECOM') minIntervalo = intervaloComercial;

      const last = lastSeenSec[p.code];
      if (last != null && (currentSec - last) < minIntervalo) {
        return false;
      }

      return true;
    }

    function pickBestPeca(candidates, currentSec, neighborProgTheme) {
      const eligible = candidates.filter(p => isEligible(p, currentSec, neighborProgTheme));
      if (eligible.length === 0) return null;

      eligible.sort((a, b) => {
        const countA = exibições[a.code] || 0;
        const countB = exibições[b.code] || 0;
        if (countA !== countB) return countA - countB;

        const durA = timeToSec(a.tempo);
        const durB = timeToSec(b.tempo);
        return durB - durA;
      });

      return eligible[0];
    }

    for (let i = 0; i < roteiro.length; i++) {
      const it = { ...roteiro[i] };
      const isGap = it.code === '__GAP__' || it.type === '__GAP__';
      const isSlot = it.type === '__SLOT__';

      if (isGap) {
        if (!preencherGaps) {
          outRoteiro.push(it);
          cumSec += timeToSec(it.tempo);
          continue;
        }

        const gapSec = timeToSec(it.tempo);
        if (gapSec <= 0) {
          outRoteiro.push(it);
          continue;
        }

        const neighborTheme = findSurroundingProgramTheme(i);
        const comboCandidates = pecasAtivas.filter(p => isEligible(p, cumSec, neighborTheme));
        const combo = findCombinationForDuration(comboCandidates, gapSec);

        if (combo && combo.length > 0) {
          combo.forEach(peca => {
            const pSec = timeToSec(peca.tempo);
            const pTheme = extractTheme(peca);
            outRoteiro.push({
              ...peca,
              horario: secToTime(cumSec)
            });
            exibições[peca.code] = (exibições[peca.code] || 0) + 1;
            lastSeenSec[peca.code] = cumSec;
            prevAllocatedTheme = pTheme;
            prevAllocatedType = peca.type;
            cumSec += pSec;
          });
          gapsResolvidos++;
        } else {
          outRoteiro.push(it);
          cumSec += gapSec;
        }
      } else if (isSlot) {
        const descUpper = String(it.descricao || '').toUpperCase();
        let targetType = 'ECHM';
        if (descUpper.includes('INTERPROGRAMA')) targetType = 'EINT';

        const candidates = pecasAtivas.filter(p => {
          if (targetType === 'ECHM') return p.type === 'ECHM' || p.type === 'ECHE';
          if (targetType === 'EINT') return p.type === 'EINT' || p.type === 'EINS';
          return p.type === targetType;
        });

        const neighborTheme = findSurroundingProgramTheme(i);
        const alocada = pickBestPeca(candidates, cumSec, neighborTheme);

        if (alocada) {
          const durSec = timeToSec(alocada.tempo);
          const pTheme = extractTheme(alocada);
          outRoteiro.push({
            ...alocada,
            horario: secToTime(cumSec)
          });
          exibições[alocada.code] = (exibições[alocada.code] || 0) + 1;
          lastSeenSec[alocada.code] = cumSec;
          prevAllocatedTheme = pTheme;
          prevAllocatedType = alocada.type;

          if (targetType === 'ECHM') chamadasPreenchidas++;
          else interprogramasPreenchidos++;

          cumSec += durSec;
        } else {
          slotsVaziosRestantes++;
          outRoteiro.push(it);
          cumSec += timeToSec(it.tempo);
        }
      } else {
        outRoteiro.push(it);
        cumSec += timeToSec(it.tempo);
        if (it.type === 'PGM' || !it.type?.startsWith('__')) {
          const progTheme = extractTheme(it);
          if (progTheme) prevAllocatedTheme = progTheme;
          prevAllocatedType = it.type;
        }
      }
    }

    return {
      roteiro: outRoteiro,
      resultado: {
        chamadasPreenchidas,
        interprogramasPreenchidos,
        gapsResolvidos,
        slotsVaziosRestantes,
        totalAlocado: chamadasPreenchidas + interprogramasPreenchidos + gapsResolvidos
      }
    };
  }

  const api = {
    distribuirPecasNosBreaks,
    findCombinationForDuration,
    isValidadeExpired,
    extractTheme
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.BreakDistributor = api;
  }
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));

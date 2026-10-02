// src/core/breakDistributor.js
// Distribuição Inteligente de Chamadas, Comerciais e Interprogramas
// GNU GPL v3 · Canal Educação / MEC · 2026

import { timeToSec, secToTime } from './normalize.js';

export function isValidadeExpired(val) {
  if (!val) return false;
  const match = String(val).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const [, d, m, y] = match;
  const exp = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59);
  return exp.getTime() < Date.now();
}

/**
 * Encontra a melhor combinação de peças que soma o tempo do GAP (ou chega mais perto).
 */
export function findCombinationForDuration(candidates, targetSec, maxPieces = 3) {
  if (targetSec <= 0 || !candidates || !candidates.length) return [];

  let bestCombo = [];
  let bestDiff = targetSec;

  function search(startIndex, currentCombo, currentSum) {
    const diff = targetSec - currentSum;
    if (diff === 0) {
      bestCombo = [...currentCombo];
      bestDiff = 0;
      return true;
    }
    if (diff < bestDiff && diff >= 0) {
      bestDiff = diff;
      bestCombo = [...currentCombo];
    }
    if (currentCombo.length >= maxPieces || currentSum >= targetSec) return false;

    for (let i = startIndex; i < candidates.length; i++) {
      const p = candidates[i];
      const pSec = timeToSec(p.tempo);
      if (pSec <= 0 || currentSum + pSec > targetSec) continue;

      currentCombo.push(p);
      const foundExact = search(i + 1, currentCombo, currentSum + pSec);
      currentCombo.pop();
      if (foundExact) return true;
    }
    return false;
  }

  search(0, [], 0);
  return bestCombo;
}

/**
 * Distribui peças ativas nos slots vazios (__BREAK__ e __GAP__) do roteiro.
 */
export function distribuirPecasNosBreaks(roteiro, pecas, options = {}) {
  const startSec = Number(options.startSec) || 21600; // 06:00:00
  const regrasTipo = options.regrasTipo || {
    ECHM: { intervaloMinMin: 90, ativo: true },
    EINT: { intervaloMinMin: 120, ativo: true },
    ECOM: { intervaloMinMin: 60, ativo: true },
    EINS: { intervaloMinMin: 90, ativo: true }
  };

  const usageCounts = {};
  const lastSecByCode = {};

  let initialSec = startSec;
  (roteiro || []).forEach(it => {
    const dur = timeToSec(it.tempo);
    if (it.code && it.type !== '__SLOT__' && it.type !== '__GAP__') {
      usageCounts[it.code] = (usageCounts[it.code] || 0) + 1;
      lastSecByCode[it.code] = initialSec;
    }
    initialSec += dur;
  });

  const pecasAtivas = (pecas || []).filter(p => {
    if (!p || !p.code || p.ativo === false) return false;
    if (isValidadeExpired(p.validade)) return false;
    return true;
  });

  function isEligible(p, currentSec, prevType) {
    const cfg = regrasTipo[p.type] || {};
    if (cfg.ativo === false) return false;

    if (p.type === 'ECOM' && prevType === 'ECOM') return false;

    const minMin = Number(cfg.intervaloMinMin) || 0;
    if (minMin > 0 && lastSecByCode[p.code] != null) {
      const diffMin = (currentSec - lastSecByCode[p.code]) / 60;
      if (diffMin < minMin) return false;
    }

    return true;
  }

  function pickPiece(targetTypes, currentSec, prevType) {
    const candidatas = pecasAtivas.filter(p => targetTypes.includes(p.type) && isEligible(p, currentSec, prevType));
    if (!candidatas.length) return null;

    candidatas.sort((a, b) => {
      const uA = usageCounts[a.code] || 0;
      const uB = usageCounts[b.code] || 0;
      if (uA !== uB) return uA - uB;
      return (Number(a.ordem) || 0) - (Number(b.ordem) || 0);
    });

    const escolhida = candidatas[0];
    usageCounts[escolhida.code] = (usageCounts[escolhida.code] || 0) + 1;
    lastSecByCode[escolhida.code] = currentSec;
    return {
      code: escolhida.code,
      descricao: escolhida.descricao,
      tempo: escolhida.tempo || '00:00:30',
      midia: escolhida.midia || '0OMN',
      type: escolhida.type || targetTypes[0],
      _autoDistribuida: true
    };
  }

  const novoRoteiro = [];
  let cumSec = startSec;
  let chamadasPreenchidas = 0;
  let interprogramasPreenchidos = 0;
  let gapsResolvidos = 0;
  let slotsVaziosRestantes = 0;

  for (let i = 0; i < (roteiro || []).length; i++) {
    const it = roteiro[i];
    const prevItem = novoRoteiro[novoRoteiro.length - 1];
    const prevType = prevItem ? prevItem.type : null;

    if (it.code === '__GAP__' || it.type === '__GAP__') {
      const gapSec = timeToSec(it.tempo);
      if (gapSec > 0) {
        const candidatosGap = pecasAtivas.filter(p => ['ECHM', 'EINT', 'EINS', 'ECOM'].includes(p.type) && isEligible(p, cumSec, prevType));
        candidatosGap.sort((a, b) => (usageCounts[a.code] || 0) - (usageCounts[b.code] || 0));

        const combo = findCombinationForDuration(candidatosGap, gapSec, 4);
        if (combo.length > 0) {
          let comboSum = 0;
          combo.forEach(peca => {
            usageCounts[peca.code] = (usageCounts[peca.code] || 0) + 1;
            lastSecByCode[peca.code] = cumSec;
            const aloc = {
              code: peca.code,
              descricao: peca.descricao,
              tempo: peca.tempo,
              midia: peca.midia || '0OMN',
              type: peca.type,
              _autoDistribuida: true
            };
            novoRoteiro.push(aloc);
            const pSec = timeToSec(peca.tempo);
            comboSum += pSec;
            cumSec += pSec;
          });

          gapsResolvidos++;
          const residuo = gapSec - comboSum;
          if (residuo > 0) {
            novoRoteiro.push({
              code: '__GAP__',
              descricao: '[ AJUSTE DE GRADE ]',
              tempo: secToTime(residuo),
              midia: '0OMN',
              type: '__SLOT__'
            });
            cumSec += residuo;
          }
        } else {
          novoRoteiro.push({ ...it });
          cumSec += gapSec;
          slotsVaziosRestantes++;
        }
      } else {
        novoRoteiro.push({ ...it });
      }
    } else if (it.type === '__SLOT__') {
      const descLower = String(it.descricao || '').toLowerCase();
      let alocada = null;

      if (descLower.includes('chamada')) {
        alocada = pickPiece(['ECHM', 'ECOM'], cumSec, prevType);
        if (alocada) chamadasPreenchidas++;
      } else if (descLower.includes('interprograma')) {
        alocada = pickPiece(['EINT', 'EINS'], cumSec, prevType);
        if (alocada) interprogramasPreenchidos++;
      }

      if (alocada) {
        novoRoteiro.push(alocada);
        cumSec += timeToSec(alocada.tempo);
      } else {
        novoRoteiro.push({ ...it });
        cumSec += timeToSec(it.tempo);
        slotsVaziosRestantes++;
      }
    } else {
      novoRoteiro.push({ ...it });
      cumSec += timeToSec(it.tempo);
    }
  }

  return {
    roteiro: novoRoteiro,
    resultado: {
      chamadasPreenchidas,
      interprogramasPreenchidos,
      gapsResolvidos,
      slotsVaziosRestantes,
      totalAlocado: chamadasPreenchidas + interprogramasPreenchidos + gapsResolvidos
    }
  };
}

if (typeof window !== 'undefined') {
  window.BreakDistributor = {
    distribuirPecasNosBreaks,
    findCombinationForDuration,
    isValidadeExpired
  };
}

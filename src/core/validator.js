// src/core/validator.js
import { timeToSec } from './time.js';

/**
 * Valida o roteiro contra as regras fornecidas.
 * @param {Array} roteiro - array de itens do roteiro
 * @param {Object} regras - objeto com as regras (REGRAS)
 * @returns {Object} - { [idx]: [msg1, msg2, ...] }
 */
export function validateRoteiroRegras(roteiro, regras) {
  const out = {};
  const rt = regras.regrasTipos || {};
  const itens = roteiro;
  const ocorrPorCode = {};

  const _hhmmToSec = (s) => {
    const [h, m] = (s || '00:00').split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60;
  };

  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    if (!it || !it.type || it.type === '__SLOT__' || it.type === 'RPRO') continue;
    const cfg = rt[it.type];
    if (!cfg || !cfg.ativo) continue;
    const sec = it.IN ? timeToSec(it.IN) : null;
    const msgs = [];

    // Janela horária
    if (sec != null) {
      const ini = _hhmmToSec(cfg.inicio);
      const fim = _hhmmToSec(cfg.fim);
      if (sec < ini || sec > fim) {
        msgs.push(`${it.type} fora da janela ${cfg.inicio}–${cfg.fim} (IN ${it.IN})`);
      }
    }

    // Não-adjacente
    const proibidos = cfg.naoAdjacenteA || [];
    if (proibidos.length) {
      const _viz = (delta) => {
        let j = i + delta;
        while (j >= 0 && j < itens.length) {
          const v = itens[j];
          if (v && v.type && v.type !== '__SLOT__' && v.type !== 'RPRO') return v;
          j += delta;
        }
        return null;
      };
      const ant = _viz(-1);
      const pos = _viz(+1);
      if (ant && proibidos.includes(ant.type)) msgs.push(`adjacente a ${ant.type} (proibido)`);
      if (pos && proibidos.includes(pos.type)) msgs.push(`adjacente a ${pos.type} (proibido)`);
    }

    // Intervalo mínimo entre repetições
    if (cfg.intervaloMinMin > 0 && it.code && sec != null) {
      const prev = ocorrPorCode[it.code];
      if (prev != null) {
        const deltaMin = (sec - prev) / 60;
        if (deltaMin < cfg.intervaloMinMin) {
          msgs.push(`repetida ${Math.round(deltaMin)}min depois (mín. ${cfg.intervaloMinMin}min)`);
        }
      }
      ocorrPorCode[it.code] = sec;
    } else if (it.code && sec != null) {
      ocorrPorCode[it.code] = sec;
    }

    if (msgs.length) out[i] = msgs;
  }
  return out;
}
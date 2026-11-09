// src/core/pecasDeduplicador.js
// Identificação de peças duplicadas por descrição dentro da mesma emissora.

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PecasDeduplicador = factory();
  }
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /**
   * Compara dois códigos (code) priorizando valor numérico e ordenação natural.
   * Valores maiores vêm depois (ordem crescente).
   */
  function compararCodes(codeA, codeB) {
    const sa = String(codeA ?? '').trim();
    const sb = String(codeB ?? '').trim();
    if (!sa && !sb) return 0;
    if (!sa) return -1;
    if (!sb) return 1;

    const na = Number(sa);
    const nb = Number(sb);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      return na - nb;
    }
    return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
  }

  /**
   * Normaliza uma descrição para comparação:
   * - Converte para minúsculas
   * - Remove acentos
   * - Remove pontuações e caracteres especiais
   * - Reduz múltiplos espaços
   */
  function normalizarTexto(texto) {
    if (!texto || typeof texto !== 'string') return '';

    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacríticos/acentos
      .replace(/[^a-z0-9\s]/g, ' ')   // substitui símbolos por espaço
      .replace(/\s+/g, ' ')          // colapsa espaços
      .trim();
  }

  /**
   * Agrupa peças que compartilham a mesma descrição normalizada.
   * Retorna apenas os grupos com 2 ou mais ocorrências.
   *
   * @param {Array} pecas - Lista de peças carregadas
   * @returns {Array<{ chave: string, itens: Array }>} Lista de grupos duplicados
   */
  function encontrarDuplicados(pecas = []) {
    const grupos = new Map();

    for (const p of pecas) {
      if (!p || !p.code) continue;
      const chave = normalizarTexto(p.descricao || p.titulo);
      if (!chave) continue; // ignora peças sem descrição preenchida

      if (!grupos.has(chave)) {
        grupos.set(chave, []);
      }
      grupos.get(chave).push(p);
    }

    const resultado = [];
    for (const [chave, itens] of grupos.entries()) {
      if (itens.length > 1) {
        resultado.push({ chave, itens });
      }
    }

    return resultado;
  }

  /**
   * Sugere quais peças marcar para desativar/excluir em cada grupo.
   * Por padrão, mantém a peça com o MAIOR número de code e sugere descarte das demais.
   * 
   * @param {Array} grupos - Resultado de encontrarDuplicados()
   * @param {'manter_maior_code' | 'manter_menor_code' | 'manter_recente' | 'manter_antiga'} estrategia
   * @returns {Array<string>} Lista de codes sugeridos para ação
   */
  function selecionarParaAcao(grupos = [], estrategia = 'manter_maior_code') {
    const codesParaAcao = [];

    for (const grupo of grupos) {
      const itens = [...grupo.itens];
      if (itens.length <= 1) continue;

      if (estrategia === 'manter_maior_code') {
        // Ordena por code crescente: o último item terá o maior code (será preservado).
        // Todos os anteriores são marcados para descarte.
        itens.sort((a, b) => compararCodes(a.code, b.code));
        const descartar = itens.slice(0, itens.length - 1);
        descartar.forEach((p) => codesParaAcao.push(p.code));
      } else if (estrategia === 'manter_menor_code') {
        // Mantém o primeiro (menor code)
        itens.sort((a, b) => compararCodes(a.code, b.code));
        const descartar = itens.slice(1);
        descartar.forEach((p) => codesParaAcao.push(p.code));
      } else if (estrategia === 'manter_recente') {
        // A mais recente é a última por rowVersion
        itens.sort((a, b) => {
          const vA = a.rowVersion || a.row_version || 0;
          const vB = b.rowVersion || b.row_version || 0;
          return vA - vB;
        });
        const descartar = itens.slice(0, itens.length - 1);
        descartar.forEach((p) => codesParaAcao.push(p.code));
      } else if (estrategia === 'manter_antiga') {
        // A mais antiga é a primeira
        itens.sort((a, b) => {
          const vA = a.rowVersion || a.row_version || 0;
          const vB = b.rowVersion || b.row_version || 0;
          return vA - vB;
        });
        const descartar = itens.slice(1);
        descartar.forEach((p) => codesParaAcao.push(p.code));
      }
    }

    return codesParaAcao;
  }

  return {
    compararCodes,
    normalizarTexto,
    encontrarDuplicados,
    selecionarParaAcao,
  };
});

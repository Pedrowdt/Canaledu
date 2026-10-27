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
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

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
   * 
   * @param {Array} grupos - Resultado de encontrarDuplicados()
   * @param {'manter_recente' | 'manter_antiga'} estrategia
   * @returns {Array<string>} Lista de codes sugeridos para ação
   */
  function selecionarParaAcao(grupos = [], estrategia = 'manter_recente') {
    const codesParaAcao = [];

    for (const grupo of grupos) {
      const itens = [...grupo.itens];
      if (itens.length <= 1) continue;

      // Ordena por versão ou recência (se disponível)
      itens.sort((a, b) => {
        const vA = a.rowVersion || a.row_version || 0;
        const vB = b.rowVersion || b.row_version || 0;
        return vA - vB;
      });

      if (estrategia === 'manter_recente') {
        // A mais recente é a última; seleciona todas exceto a última
        const descartar = itens.slice(0, itens.length - 1);
        descartar.forEach((p) => codesParaAcao.push(p.code));
      } else if (estrategia === 'manter_antiga') {
        // A mais antiga é a primeira; seleciona todas exceto a primeira
        const descartar = itens.slice(1);
        descartar.forEach((p) => codesParaAcao.push(p.code));
      }
    }

    return codesParaAcao;
  }

  return {
    normalizarTexto,
    encontrarDuplicados,
    selecionarParaAcao,
  };
});

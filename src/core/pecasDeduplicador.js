// src/core/pecasDeduplicador.js
// Identificação de peças e programas duplicados dentro da mesma emissora.

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
   * Normaliza um código para comparação estrita (ignora espaços extras e maiúsculas/minúsculas).
   */
  function normalizarCode(code) {
    if (code == null) return '';
    return String(code).trim().toUpperCase();
  }

  /**
   * Agrupa itens duplicados dentro da mesma emissora.
   * - Se criterio === 'code' (recomendado para Programas): agrupa exclusivamente por código idêntico.
   *   Evita falso-positivo com blocos de programa (ex: BL01 e BL02 de uma mesma atração).
   * - Se criterio === 'descricao' (padrão para Peças): agrupa por descrição normalizada.
   *
   * @param {Array} itens - Lista de peças ou programas
   * @param {'descricao' | 'code' | { criterio?: 'descricao' | 'code' }} [opcoes='descricao']
   * @returns {Array<{ chave: string, itens: Array }>} Lista de grupos duplicados (apenas com >= 2 itens)
   */
  function encontrarDuplicados(itens = [], opcoes = 'descricao') {
    const criterio = (typeof opcoes === 'object' && opcoes !== null)
      ? (opcoes.criterio || 'descricao')
      : (typeof opcoes === 'string' ? opcoes : 'descricao');

    const grupos = new Map();

    for (const p of itens) {
      if (!p || !p.code) continue;

      let chave = '';
      if (criterio === 'code') {
        chave = normalizarCode(p.code);
      } else {
        chave = normalizarTexto(p.descricao || p.titulo);
      }

      if (!chave) continue; // ignora entradas vazias

      if (!grupos.has(chave)) {
        grupos.set(chave, []);
      }
      grupos.get(chave).push(p);
    }

    const resultado = [];
    for (const [chave, itensGrupo] of grupos.entries()) {
      if (itensGrupo.length > 1) {
        resultado.push({ chave, itens: itensGrupo });
      }
    }

    return resultado;
  }

  /**
   * Sugere quais itens marcar para desativar/excluir em cada grupo de duplicados.
   * - Para peças (manter_maior_code): preserva a de maior code numérico/alfanumérico e descarta as demais.
   * - Para empate de codes ou programas (manter_recente): preserva a de maior versão/atualização.
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
        // Ordena por code crescente; se empatar, desempata por recência (rowVersion)
        itens.sort((a, b) => {
          const c = compararCodes(a.code, b.code);
          if (c !== 0) return c;
          const vA = a.rowVersion || a.row_version || 0;
          const vB = b.rowVersion || b.row_version || 0;
          return vA - vB;
        });
        const descartar = itens.slice(0, itens.length - 1);
        descartar.forEach((p) => codesParaAcao.push(p.code));
      } else if (estrategia === 'manter_menor_code') {
        itens.sort((a, b) => {
          const c = compararCodes(a.code, b.code);
          if (c !== 0) return c;
          const vA = a.rowVersion || a.row_version || 0;
          const vB = b.rowVersion || b.row_version || 0;
          return vA - vB;
        });
        const descartar = itens.slice(1);
        descartar.forEach((p) => codesParaAcao.push(p.code));
      } else if (estrategia === 'manter_recente') {
        itens.sort((a, b) => {
          const vA = a.rowVersion || a.row_version || 0;
          const vB = b.rowVersion || b.row_version || 0;
          return vA - vB;
        });
        const descartar = itens.slice(0, itens.length - 1);
        descartar.forEach((p) => codesParaAcao.push(p.code));
      } else if (estrategia === 'manter_antiga') {
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
    normalizarCode,
    encontrarDuplicados,
    selecionarParaAcao,
  };
});

/**
 * src/core/semanaUtils.js
 * Utilitários para cálculo de períodos semanais, número da semana (ISO / Emissora)
 * e sincronização de grade com roteiros semana a semana.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SemanaUtils = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Calcula o número da semana conforme padrão ISO 8601 (segunda-feira como 1º dia).
   * @param {Date|string|number} data
   * @returns {{ ano: number, semana: number }}
   */
  function normalizarData(data) {
    if (!data) return new Date();
    if (typeof data === 'string') {
      const match = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
      }
    }
    const d = new Date(data);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  }

  function calcularSemanaISO(data) {
    const d = normalizarData(data);
    // Quinta-feira na semana decide o ano da semana
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const semana1 = new Date(d.getFullYear(), 0, 4);
    const numSemana = 1 + Math.round(((d.getTime() - semana1.getTime()) / 86400000 - 3 + (semana1.getDay() + 6) % 7) / 7);
    return {
      ano: d.getFullYear(),
      semana: numSemana
    };
  }

  /**
   * Retorna a data da segunda-feira da semana de uma data dada.
   * @param {Date|string} data
   * @returns {Date}
   */
  function obterSegundaFeira(data) {
    const dt = normalizarData(data);
    const dow = dt.getDay(); // 0 = Dom, 1 = Seg...
    const diff = (dow === 0) ? -6 : 1 - dow;
    dt.setDate(dt.getDate() + diff);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  /**
   * Retorna as 7 datas (Segunda a Domingo) de uma semana deslocada por offset (em semanas).
   * @param {Date|string} dataBase
   * @param {number} offsetSemanas
   * @returns {Date[]}
   */
  function obterDatasDaSemana(dataBase, offsetSemanas = 0) {
    const seg = obterSegundaFeira(dataBase);
    seg.setDate(seg.getDate() + offsetSemanas * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(seg);
      d.setDate(seg.getDate() + i);
      return d;
    });
  }

  /**
   * Formata data em DD/MM.
   */
  function formatarDiaMes(d) {
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}`;
  }

  /**
   * Formata data em YYYY-MM-DD.
   */
  function formatarDataISO(d) {
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${ano}-${mes}-${dia}`;
  }

  /**
   * Gera o resumo completo da semana com suporte a ajuste manual de número (ex.: EBC).
   * @param {Date|string} dataBase
   * @param {number} offsetSemanas
   * @param {number|null} numeroSemanaManual Opcional: sobrescreve o número ISO
   * @returns {object}
   */
  function obterResumoSemana(dataBase, offsetSemanas = 0, numeroSemanaManual = null) {
    const datas = obterDatasDaSemana(dataBase, offsetSemanas);
    const seg = datas[0];
    const dom = datas[6];
    const iso = calcularSemanaISO(seg);
    const semanaNum = (numeroSemanaManual !== null && numeroSemanaManual !== undefined)
      ? Number(numeroSemanaManual)
      : iso.semana;

    const rotuloCurto = `Semana ${semanaNum}`;
    const periodoFormatado = `${formatarDiaMes(seg)} a ${formatarDiaMes(dom)}/${dom.getFullYear()}`;
    const rotuloCompleto = `${rotuloCurto} (${periodoFormatado})`;

    return {
      numeroSemana: semanaNum,
      numeroSemanaISO: iso.semana,
      ano: dom.getFullYear(),
      segunda: seg,
      domingo: dom,
      dataInicio: formatarDataISO(seg),
      dataFim: formatarDataISO(dom),
      rotuloCurto,
      periodoFormatado,
      rotuloCompleto,
      datas
    };
  }

  /**
   * Extrai o número da semana a partir de strings como:
   * "SEMANA 45", "Semana 44", "GRADE_TV_BRASIL_SEMANA_45.xlsx"
   * @param {string} texto
   * @returns {number|null}
   */
  function extrairNumeroSemanaDoTexto(texto) {
    if (!texto) return null;
    const match = String(texto).match(/semana[_\s-]*(\d{1,2})(?=[^\d]|$)/i);
    if (match && match[1]) {
      const n = parseInt(match[1], 10);
      if (n >= 1 && n <= 53) return n;
    }
    return null;
  }

  return {
    calcularSemanaISO,
    obterSegundaFeira,
    obterDatasDaSemana,
    formatarDiaMes,
    formatarDataISO,
    obterResumoSemana,
    extrairNumeroSemanaDoTexto
  };
});

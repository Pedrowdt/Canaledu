// src/core/csvImportador.js
// Utilitário para detecção de delimitador, conversão de durações e pré-visualização de importação de CSV/XLSX.

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CsvImportador = factory();
  }
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /**
   * Remove BOM UTF-8 se presente no início da string.
   */
  function stripBOM(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charCodeAt(0) === 0xFEFF ? str.slice(1) : str;
  }

  /**
   * Detecta o delimitador do CSV.
   * Por padrão e regra de negócio, o delimitador prioritário é o ponto e vírgula (;).
   * Também suporta detecção de vírgula (,), tabulação (\t) ou dois-pontos (:).
   *
   * @param {string} texto
   * @returns {{ delimitador: string, nome: string }}
   */
  function detectarDelimitador(texto) {
    const limpo = stripBOM(String(texto || '')).trim();
    if (!limpo) return { delimitador: ';', nome: 'Ponto e vírgula (;)' };

    // Pega as primeiras linhas (até 5)
    const linhas = limpo.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 5);
    if (!linhas.length) return { delimitador: ';', nome: 'Ponto e vírgula (;)' };

    // Candidatos a delimitador ordenados por prioridade (; primeiro)
    const candidatos = [
      { delimitador: ';', nome: 'Ponto e vírgula (;)' },
      { delimitador: ',', nome: 'Vírgula (,)' },
      { delimitador: '\t', nome: 'Tabulação (Tab)' },
      { delimitador: ':', nome: 'Dois-pontos (:)' },
    ];

    // Se a primeira linha contiver ponto e vírgula, confirma ponto e vírgula diretamente
    if (linhas[0].includes(';')) {
      return candidatos[0];
    }

    // Caso não tenha ponto e vírgula, avalia a contagem média e consistência
    let melhorCandidato = candidatos[0];
    let maiorPontuacao = -1;

    for (const c of candidatos) {
      const contagens = linhas.map(l => (l.split(c.delimitador).length - 1));
      const total = contagens.reduce((acc, v) => acc + v, 0);
      const media = total / contagens.length;

      // Verifica se todas as linhas têm contagem idêntica e > 0
      const consistente = contagens.every(cnt => cnt > 0 && cnt === contagens[0]);
      const pontuacao = (consistente ? 100 : 0) + media;

      if (pontuacao > maiorPontuacao && total > 0) {
        maiorPontuacao = pontuacao;
        melhorCandidato = c;
      }
    }

    return melhorCandidato;
  }

  /**
   * Normaliza qualquer formato de duração para HH:MM:SS.
   * Suporta:
   * - MMMM:SS.FF ou MMMM:SS,FF (ex: 0000:29.00 -> 00:00:29; 0001:01.26 -> 00:01:01; 0075:30.00 -> 01:15:30)
   * - HH:MM:SS ou HH:MM:SS.FF (ex: 00:30:00 ou 01:23:45.12 -> 01:23:45)
   * - MM:SS (ex: 30:00 -> 00:30:00)
   * - Fração de dia decimal do Excel (ex: 0.020833333333333332 -> 00:30:00)
   *
   * @param {string|number} v
   * @param {string} fallback
   * @returns {string} HH:MM:SS
   */
  function normalizarDuracao(v, fallback = '00:01:00') {
    if (v == null || v === '') return fallback;

    if (typeof v === 'number') {
      const secs = Math.round(v * 86400);
      const hh = String(Math.floor(secs / 3600)).padStart(2, '0');
      const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }

    let s = String(v).trim().replace(/^"+|"+$/g, '');

    // Formato padrão HH:MM:SS com ou sem frames/decimais: 01:23:45 ou 01:23:45.12
    let m = s.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:[.,]\d+)?$/);
    if (m) {
      return `${m[1].padStart(2, '0')}:${m[2]}:${m[3]}`;
    }

    // Formato de exibidor de vídeo MMMM:SS.FF ou MMMM:SS,FF: ex: 0000:29.00, 0001:01.26, 0075:30.00
    m = s.match(/^(\d+):(\d{2})[.,](\d{2})$/);
    if (m) {
      const totalSecs = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      const hh = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
      const mm = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
      const ss = String(totalSecs % 60).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }

    // Formato MM:SS (minutos e segundos)
    m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const hh = String(Math.floor(min / 60)).padStart(2, '0');
      const mm = String(min % 60).padStart(2, '0');
      const ss = String(sec).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }

    // Fração numérica vinda como string "0.020833..."
    const n = parseFloat(s.replace(',', '.'));
    if (!isNaN(n) && s.match(/^[\d.,]+$/)) {
      return normalizarDuracao(n, fallback);
    }

    return fallback;
  }

  /**
   * Detecta índices de colunas baseado nos cabeçalhos encontrados.
   */
  function detectarColunas(headers = [], rows = []) {
    const filledCount = (colIdx) => {
      let cnt = 0;
      for (let r = 1; r < Math.min(rows.length, 30); r++) {
        const v = rows[r] ? rows[r][colIdx] : '';
        if (v != null && String(v).trim() !== '') cnt++;
      }
      return cnt;
    };

    const fi = (kws) => {
      const candidates = [];
      for (const kw of kws) {
        for (let i = 0; i < headers.length; i++) {
          const h = stripBOM(String(headers[i] || '')).trim().toUpperCase();
          if (h === kw || h.includes(kw)) {
            if (!candidates.includes(i)) candidates.push(i);
          }
        }
        if (candidates.length) break;
      }
      if (!candidates.length) return -1;
      if (candidates.length === 1) return candidates[0];
      return candidates.sort((a, b) => filledCount(b) - filledCount(a))[0];
    };

    return {
      code:  fi(['CODE', 'COD', 'CÓDIGO']),
      desc:  fi(['PROGRAMA', 'DESC', 'DESCRIPTION', 'DESCRIÇÃO', 'ESPELHO', 'TITULO', 'TÍTULO', 'NOME']),
      tempo: fi(['TEMPO', 'DUR', 'DURATION', 'DURAÇÃO']),
      type:  fi(['TYPE', 'TIPO']),
      val:   fi(['VALID', 'VALIDADE', 'KILL']),
      obs:   fi(['OBS', 'OBSERV', 'OBSERVAÇÃO']),
      cat:   fi(['CAT', 'CATEG', 'CATEGORIA']),
      midia: fi(['MIDIA', 'MÍDIA', 'MEDIA']),
    };
  }

  /**
   * Analisa as linhas do arquivo e prepara o resumo e a amostra de pré-visualização.
   *
   * @param {Object} params
   * @param {Array<Array>} params.rows
   * @param {Array|Set} params.itensExistentes - Itens já existentes no acervo
   * @param {boolean} params.isPecas - true se aba peças, false se programas
   * @param {Function} [params.uidGenerator] - gerador de id
   * @returns {Object} resumo da pré-visualização
   */
  /**
   * Mapeia tipos brutos exportados do servidor (ex: "CANAL EDUCACAO - VINHETA", "(GCHM)")
   * para os tipos reconhecidos pelo sistema: ECHE, ECHM, RCOM, RPOL, EINT, EVNH, RPRO.
   */
  function mapearTipo(tipoRaw, descRaw, isPecas) {
    const t = String(tipoRaw || '').toUpperCase().trim();
    const d = String(descRaw || '').toUpperCase().trim();

    const padroesConhecidos = new Set(['ECHE', 'ECHM', 'RCOM', 'RPOL', 'EINT', 'EVNH', 'RPRO']);
    if (padroesConhecidos.has(t)) return t;

    if (t.includes('ESTREIA')) return 'ECHE';
    if (t.includes('VINHETA') || t.includes('(GVNH)') || t === 'VH') return 'EVNH';
    if (t.includes('INTERPROGRAMA') || t.includes('(GINT)') || t.includes('INTPGM')) return 'EINT';
    if (t.includes('CHAMADA') || t.includes('(GCHM)') || t.includes('MANUT')) return 'ECHM';
    if (t.includes('COMERCIAL') || t.includes('(GCOM)')) return 'RCOM';
    if (t.includes('POLITIC') || t.includes('(GPOL)')) return 'RPOL';
    if (t.includes('PROGRAMA') || t.includes('(GPRO)')) return 'RPRO';

    // Heurística secundária pelo prefixo da descrição
    if (d.startsWith('VH ') || d.startsWith('VINHETA ')) return 'EVNH';
    if (d.startsWith('CH ') || d.startsWith('CHAMADA ')) return 'ECHM';
    if (d.startsWith('INTPGM ') || d.startsWith('INTERPROGRAMA ')) return 'EINT';

    return isPecas ? 'EVNH' : 'RPRO';
  }

  function analisarImportacao({ rows = [], itensExistentes = [], isPecas = true, uidGenerator = null }) {
    if (!rows || rows.length < 2) {
      return { valido: false, erro: 'Arquivo vazio ou sem linhas de dados' };
    }

    const genId = uidGenerator || (() => Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

    const rawHeaders = rows[0] || [];
    const headers = rawHeaders.map(h => stripBOM(String(h || '')).trim());
    const ci = detectarColunas(headers, rows);

    if (ci.code < 0 || ci.desc < 0) {
      return {
        valido: false,
        erro: 'Não foram encontradas as colunas obrigatórias CODE e DESCRIÇÃO no cabeçalho do arquivo.',
        headers,
      };
    }

    const existingCodes = itensExistentes instanceof Set
      ? itensExistentes
      : new Set((itensExistentes || []).map(p => String(p.code || '').trim()).filter(Boolean));

    const itens = [];
    const amostra = [];
    let totalNovos = 0;
    let totalDuplicados = 0;
    let totalInvalidos = 0;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || (Array.isArray(r) && r.every(c => c == null || String(c).trim() === ''))) {
        continue; // ignora linhas totalmente vazias
      }

      const rawCode = String(r[ci.code] ?? '').trim().replace(/^"+|"+$/g, '');
      const rawDesc = String(r[ci.desc] ?? '').trim().replace(/^"+|"+$/g, '');
      const rawTempo = ci.tempo >= 0 ? String(r[ci.tempo] ?? '').trim().replace(/^"+|"+$/g, '') : '';
      const rawType = ci.type >= 0 ? String(r[ci.type] ?? '').trim().replace(/^"+|"+$/g, '') : '';

      if (!rawCode || !rawDesc) {
        totalInvalidos++;
        continue;
      }

      const tempoFormatado = normalizarDuracao(rawTempo, isPecas ? '00:01:00' : '00:30:00');
      const jaExiste = existingCodes.has(rawCode);

      const tipoFinal = mapearTipo(rawType, rawDesc, isPecas);

      let novoItem = {
        id: genId(),
        code: rawCode,
        descricao: rawDesc,
        tempo: tempoFormatado,
        midia: ci.midia >= 0 ? String(r[ci.midia] || '0OMN').trim().replace(/^"+|"+$/g, '') : '0OMN',
        type: tipoFinal,
      };

      if (isPecas) {
        novoItem = {
          ...novoItem,
          validade: ci.val >= 0 ? String(r[ci.val] || '').trim().replace(/^"+|"+$/g, '') : '',
          obs: ci.obs >= 0 ? String(r[ci.obs] || '').trim().replace(/^"+|"+$/g, '') : '',
          categoria: ci.cat >= 0 ? String(r[ci.cat] || '').trim().replace(/^"+|"+$/g, '') : 'IMPORTADO',
          dias: [],
          hIni: '',
          hFim: '',
          freq: '',
        };
      }

      if (jaExiste) {
        totalDuplicados++;
      } else {
        totalNovos++;
        existingCodes.add(rawCode); // evita duplicados internos dentro da mesma planilha
      }

      const itemAmostra = {
        linha: i + 1,
        code: rawCode,
        descricao: rawDesc,
        tempoOriginal: rawTempo || '-',
        tempoFormatado,
        type: tipoFinal,
        status: jaExiste ? 'duplicado' : 'novo',
      };

      if (amostra.length < 8) {
        amostra.push(itemAmostra);
      }

      if (!jaExiste) {
        itens.push(novoItem);
      }
    }

    return {
      valido: true,
      colunasMapeadas: {
        code: headers[ci.code],
        desc: headers[ci.desc],
        tempo: ci.tempo >= 0 ? headers[ci.tempo] : null,
        type: ci.type >= 0 ? headers[ci.type] : null,
      },
      totalLinhas: rows.length - 1,
      totalNovos,
      totalDuplicados,
      totalInvalidos,
      amostra,
      novosItens: itens,
    };
  }

  return {
    stripBOM,
    detectarDelimitador,
    normalizarDuracao,
    detectarColunas,
    mapearTipo,
    analisarImportacao,
  };
});

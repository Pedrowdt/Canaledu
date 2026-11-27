// src/core/gradeRoteiroSyncCore.js
// Etapa 3.4: Motor de Sincronização e Publicação Grade Semanal -> Roteiro Diário
// Conecta a publicação da Grade Semanal com a atualização dos roteiros diários,
// preservando rigorosamente todas as chamadas, vinhetas manuais, breaks preenchidos
// e edições feitas pelos operadores no roteiro.

(function (root, factory) { const lib = factory(); if (root) root.GradeRoteiroSyncCore = lib; if (typeof module === "object" && module.exports) module.exports = lib; })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const START_SECONDS_DEFAULT = 6 * 3600; // 06:00:00

  function timeToSec(t) {
    if (!t) return 0;
    const parts = String(t).trim().split(/[:;]/).map(Number);
    if (parts.length >= 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    if (parts.length === 2) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60;
    return 0;
  }

  function secToTime(s) {
    if (!Number.isFinite(s)) s = 0;
    s = Math.max(0, Math.floor(s));
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  }

  function normalizeKey(s) {
    return normalizarTituloCatalogo(s);
  }

  function baseProgramTitle(desc) {
    return String(desc || '')
      .replace(/^\s*(?:PGM|PROGRAMA|INTPGM|INTERPROGRAMA|RPRO|GPRO|IPRO)\b(?:\s*[-–—:]\s*|\s+)/i, '')
      .replace(/\s*-?\s*T\s*\d+\s*EP\s*\d+.*$/i, '')
      .replace(/\s*-?\s*EP\s*\d+.*$/i, '')
      .replace(/\s*-?\s*\bBL\s*0*\d+.*$/i, '')
      .replace(/\s*\[\s*\d+\s*[ªaº°]?\s*\]/gi, '')
      .replace(/\s*\[[^\]]*\]/g, '')
      .replace(/\s*\(REPRISE\)\s*$/i, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/\s*\d+\s*['’]\s*$/, '')
      .replace(/_\d+\b/g, '')
      .trim();
  }

  function getBlockNumber(desc) {
    const match = String(desc || '').match(/BL\s*0*(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  }

  /**
   * Determina se um item da tabela é um bloco de programa.
   */
  function isProgramaItem(item) {
    if (!item) return false;
    if (item.type === 'RPRO' || item.type === 'GPRO' || item.type === 'IPRO') return true;
    if (item._isPrograma || item.tipoBloco === 'programa') return true;
    // Itens que não são breaks, gaps ou vinhetas padrão e possuem minutagem de programa
    if (!item._break && !item._gap && !item._fixa && item.bloco != null) return true;
    return false;
  }

  /**
   * Determina se um item do roteiro é um slot vazio de break ou gap.
   */
  function isSlotVazio(item) {
    if (!item) return false;
    if (item._break || item._gap) return true;
    if (item.type === '__SLOT__' || item.code === '__BREAK__' || item.code === '__GAP__') return true;
    return false;
  }

  /**
   * Determina se um item foi inserido ou editado manualmente pelo operador no roteiro.
   */
  function isPecaManual(item) {
    if (!item) return false;
    if (isSlotVazio(item)) return false;
    if (item._fixa) return false;
    if (isProgramaItem(item)) return false;

    // Chamadas, interprogramas, comerciais, vinhetas manuais, apoios
    const tiposManuais = [
      'ECHM', 'ECHE', 'EINT', 'RCOM', 'RPOL', 'EVNH',
      'GCHM', 'GPRO', 'GVNH', 'GGV', 'GINS',
      'PCHM', 'PVNH', 'PPRO', 'PINT', 'PROP',
      'ICHM', 'IVNH', 'IPRO', 'IINT'
    ];

    if (tiposManuais.includes(item.type)) return true;
    if (item._manual === true || item._inseridoPeloUsuario === true) return true;
    return true; // Qualquer item não classificado como programa/slot vazio é considerado peça manual editada
  }

  /**
   * Identifica e particiona a estrutura de um roteiro diário em:
   * - Peças fixas iniciais
   * - Programas com seus blocos e as peças alocadas em seus breaks internos e externos
   * - Peças fixas finais
   */
  function desestruturarRoteiro(roteiro = []) {
    const itens = Array.isArray(roteiro) ? roteiro : [];
    const fixasInicio = [];
    const fixasFim = [];
    const gruposProgramas = [];
    let grupoAtual = null;

    let indexPrimeiroProg = itens.findIndex(isProgramaItem);
    if (indexPrimeiroProg < 0) {
      // Sem programas no roteiro: todas as peças são tratadas como avulsas/iniciais
      return {
        fixasInicio: [],
        fixasFim: [],
        itensAvulsos: itens.filter(i => !isSlotVazio(i)),
        gruposProgramas: []
      };
    }

    // Coleta peças fixas ou itens que antecedem o primeiro programa
    for (let i = 0; i < indexPrimeiroProg; i++) {
      const it = itens[i];
      if (it._fixa || it.posicao === 'inicio') {
        fixasInicio.push(it);
      } else if (!isSlotVazio(it)) {
        fixasInicio.push(it);
      }
    }

    // Percorre a partir do primeiro programa agrupando blocos e peças de break
    for (let i = indexPrimeiroProg; i < itens.length; i++) {
      const it = itens[i];

      if (it._fixa && it.posicao === 'fim') {
        fixasFim.push(it);
        continue;
      }

      if (isProgramaItem(it)) {
        const tituloBase = baseProgramTitle(it.descricao);
        const normKey = normalizeKey(tituloBase);
        const numBloco = it.bloco || getBlockNumber(it.descricao);

        // Se for o primeiro bloco ou um novo programa
        if (!grupoAtual || grupoAtual.normKey !== normKey || numBloco === 1) {
          if (grupoAtual) {
            gruposProgramas.push(grupoAtual);
          }
          grupoAtual = {
            id: it.programaId || `prog-${normKey}-${gruposProgramas.length + 1}`,
            tituloBase,
            normKey,
            programaNome: it.programaNome || tituloBase,
            codigoBase: it.code ? it.code.replace(/_B\d+.*$/i, '') : '',
            blocos: [{ ...it, numBloco }],
            pecasBreaksInternos: [], // Peças inseridas entre blocos do mesmo programa
            pecasBreakFinal: [],    // Peças inseridas após o último bloco do programa
            itensSlotsVazios: []
          };
        } else {
          // Bloco subsequente do mesmo programa
          grupoAtual.blocos.push({ ...it, numBloco });
        }
      } else if (grupoAtual) {
        // Item entre programas ou dentro do programa
        if (isPecaManual(it)) {
          // Peça inserida pelo operador: preserva!
          grupoAtual.pecasBreakFinal.push({ ...it, _preservado: true });
        } else if (isSlotVazio(it)) {
          grupoAtual.itensSlotsVazios.push(it);
        } else {
          // Vinhetas automáticas ou transições
          grupoAtual.pecasBreakFinal.push({ ...it, _preservado: true });
        }
      } else if (!isSlotVazio(it)) {
        fixasInicio.push(it);
      }
    }

    if (grupoAtual) {
      gruposProgramas.push(grupoAtual);
    }

    return {
      fixasInicio,
      fixasFim,
      gruposProgramas,
      itensAvulsos: []
    };
  }

  /**
   * Converte slots de grade (do GradeEditor ou GradeRecorrenciaCore) em especificações de programa normalizadas.
   */
  function normalizarTituloCatalogo(texto) {
    if (typeof GradeEditorCore !== 'undefined' && typeof GradeEditorCore.normalizarTituloGrade === 'function') {
      return GradeEditorCore.normalizarTituloGrade(texto);
    }
    if (!texto) return '';
    let s = String(texto)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    s = s.replace(/&/g, ' E ');
    s = s.replace(/^\s*(?:PGM|PROGRAMA|INTPGM|INTERPROGRAMA|RPRO|GPRO|IPRO)\b(?:\s*[-–—:]\s*|\s+)/i, '');
    s = s.replace(/\s*-?\s*T\s*\d+\s*EP\s*\d+.*$/i, '');
    s = s.replace(/\s*-?\s*EP\s*\d+.*$/i, '');
    s = s.replace(/\s*-?\s*BL\s*0*\d+.*$/i, '');
    s = s.replace(/\s*\[\s*\d+\s*[ªaº°]?\s*\]/gi, '');
    s = s.replace(/\s*\[[^\]]*\]/g, '');
    s = s.replace(/\s*\(REPRISE\)/gi, '');
    s = s.replace(/\s*\([^)]*\)\s*$/g, '');
    s = s.replace(/\s*\d+\s*['’]\s*/g, ' ');
    s = s.replace(/_\d+\b/g, ' ');

    const semCanal = s.replace(/\s*[-–—:]?\s*(?:CANAL\s+EDUCACAO|TV\s+BRASIL(?:\s+INTERNACIONAL)?|CANAL\s+GOV|TVBI)\b.*$/i, '');
    if (semCanal.trim()) s = semCanal;

    s = s.replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    const CONECTIVOS = new Set(['E', 'DE', 'DA', 'DO', 'DAS', 'DOS']);
    const palavras = s.split(' ').filter(p => p && !CONECTIVOS.has(p));
    if (palavras.length > 0) {
      s = palavras.join(' ');
    }
    return s;
  }

  function extrairEpisodioDeTexto(texto) {
    const match = String(texto || '').match(/(?:T\s*(\d+)\s*)?EP\s*(\d+)/i);
    return match ? { temporada: match[1] ? Number(match[1]) : null, episodio: Number(match[2]) } : { temporada: null, episodio: null };
  }

  function extrairNumeroBlocoDeItem(item) {
    const descricao = String(item && item.descricao || '');
    const porDescricao = descricao.match(/BL\s*0*(\d+)/i);
    if (porDescricao) return Number(porDescricao[1]);
    const porCode = String(item && item.code || '').match(/_(\d+)$/);
    return porCode ? Number(porCode[1]) : 1;
  }

  function indexarAcervo(acervo = []) {
    const porId = new Map();
    const porCode = new Map();
    const porTitulo = new Map();
    const itensInvalidos = [];
    const vistosInvalidos = new Set();

    (Array.isArray(acervo) ? acervo : []).forEach(item => {
      if (!item) return;
      const temCode = Boolean(item.code && String(item.code).trim());
      const temTempo = Boolean(item.tempo && String(item.tempo).trim());
      if (!temCode || !temTempo) {
        const nome = item.title || item.nome || item.descricao || item.programaTitulo || item.code || 'Item sem nome';
        const chaveInvalido = `${item.id || ''}|${item.code || ''}|${nome}`;
        if (!vistosInvalidos.has(chaveInvalido)) {
          vistosInvalidos.add(chaveInvalido);
          itensInvalidos.push({
            id: item.id || null,
            code: item.code || null,
            tempo: item.tempo || null,
            nome,
            semCode: !temCode,
            semTempo: !temTempo
          });
        }
        return;
      }

      const idVal = item.id != null ? String(item.id) : (item.programaId != null ? String(item.programaId) : (item.programa_id != null ? String(item.programa_id) : null));
      if (idVal) porId.set(idVal, item);

      if (item.code) {
        porCode.set(String(item.code), item);
      }

      const chave = normalizarTituloCatalogo(item.descricao || item.title || item.nome || item.programaTitulo || item.programa_titulo);
      if (chave) {
        if (!porTitulo.has(chave)) porTitulo.set(chave, []);
        porTitulo.get(chave).push(item);
      }
    });

    return {
      porId,
      porCode,
      porTitulo,
      itensInvalidos,
      get(chave) { return porTitulo.get(chave) || []; },
      has(chave) { return porTitulo.has(chave); }
    };
  }

  function obterBlocosOficiais(slot, index) {
    if (!index || !slot || slot.catalogoEncontrado === false) return [];

    const epSlot = slot.episodio || extrairEpisodioDeTexto(slot.titulo || '');
    const temEpAlvo = epSlot && (epSlot.temporada != null || epSlot.episodio != null || epSlot.episodioNumero != null);
    const numeroAlvo = temEpAlvo
      ? (epSlot.episodioNumero != null ? Number(epSlot.episodioNumero) : (epSlot.episodio != null ? Number(epSlot.episodio) : null))
      : null;

    function filtrarPorEpisodio(candidatos) {
      if (!Array.isArray(candidatos) || !candidatos.length) return [];
      if (!temEpAlvo) return candidatos;
      return candidatos.filter(item => {
        const ep = extrairEpisodioDeTexto(item.descricao || '');
        if (epSlot.temporada != null && ep.temporada != null && Number(epSlot.temporada) !== ep.temporada) return false;
        if (numeroAlvo != null && ep.episodio != null && numeroAlvo !== ep.episodio) return false;
        return true;
      });
    }

    function ordenarEUnificar(lista) {
      const unicos = new Map();
      lista.forEach(item => {
        if (item && item.code && !unicos.has(String(item.code))) {
          unicos.set(String(item.code), item);
        }
      });
      return [...unicos.values()].sort((a, b) => extrairNumeroBlocoDeItem(a) - extrairNumeroBlocoDeItem(b));
    }

    // 1. Prioridade A: Casar por id ou code oficial existente no acervo
    let matchDireto = null;
    const progId = slot.programaId || (slot.program && (slot.program.id || slot.program.programaId));
    if (progId != null && index.porId && index.porId.has(String(progId))) {
      matchDireto = index.porId.get(String(progId));
    }

    if (!matchDireto) {
      const rawCode = slot.code || (slot.program && slot.program.code);
      if (rawCode && !String(rawCode).startsWith('GRD_') && index.porCode && index.porCode.has(String(rawCode))) {
        matchDireto = index.porCode.get(String(rawCode));
      }
    }

    if (matchDireto) {
      const chaveMatch = normalizarTituloCatalogo(matchDireto.descricao || matchDireto.title || matchDireto.nome || matchDireto.programaTitulo || matchDireto.programa_titulo);
      const candidatosMatch = (index.porTitulo && chaveMatch && index.porTitulo.get(chaveMatch)) || [matchDireto];
      const filtrados = filtrarPorEpisodio(candidatosMatch);
      if (filtrados.length > 0) {
        return ordenarEUnificar(filtrados);
      }
      if (temEpAlvo) {
        return [];
      }
      return [matchDireto];
    }

    // 2. Prioridade B: Casar por título normalizado
    const chave = normalizarTituloCatalogo(slot.titulo || slot.baseTitle);
    const candidatos = (index.porTitulo ? index.porTitulo.get(chave) : (typeof index.get === 'function' ? index.get(chave) : [])) || [];
    if (!candidatos.length) return [];

    const filtrados = filtrarPorEpisodio(candidatos);
    if (!filtrados.length) return [];

    return ordenarEUnificar(filtrados);
  }

  function normalizarSlotsGradeDoDia(slotsOuGrade = [], opcoes = {}) {
    if (!slotsOuGrade) return [];
    const indiceAcervo = opcoes.acervoIndex || indexarAcervo(opcoes.acervo || []);

    // Se for formato array de blocos do GradeEditor (ex: blocksByDay[dow])
    if (Array.isArray(slotsOuGrade)) {
      const normalizados = [];
      slotsOuGrade.forEach((slot, idx) => {
        const p = slot.program || {};
        const titulo = p.title || p.nome || p.descricao || slot.programaNome || '';
        if (!titulo || titulo === 'SEM TÍTULO') return;

        const duracao = slot.duration || p.duration || p.tempo || '00:30:00';
        const horario = slot.time || slot.horario || '08:00:00';
        const baseTitle = baseProgramTitle(titulo);
        const normKey = normalizeKey(baseTitle);

        const normalizado = {
          slotIndex: idx,
          slotId: slot.id || `slot-${idx}-${horario.replace(/:/g, '')}`,
          horario,
          duracao,
          duracaoAlocada: slot.duration || p.duration || null,
          titulo,
          baseTitle,
          normKey,
          code: p.code || slot.code || `GRD_${horario.replace(/[^0-9]/g, '')}`,
          tempoPrograma: p.tempo || null,
          catalogoEncontrado: p.catalogoEncontrado,
          midia: p.midia || '0OMN',
          tipoExibicao: slot.tipoExibicao || p.tipoExibicao || (slot.isReprise ? 'reprise' : 'inedito'),
          isReprise: Boolean(slot.isReprise || slot.tipoExibicao === 'reprise'),
          origemReprise: slot.origemReprise || null,
          episodio: slot.episodio || p.episodio || extrairEpisodioDeTexto(titulo),
          faixaOcupada: slot.faixaNome || p.faixaOcupada || p.faixa_ocupada || '',
          classificacao: slot.classificacao || p.classificacao || 'L',
          programaId: p.programaId || p.id || slot.programaId || null,
          isAoVivo: Boolean(
            slot.isAoVivo || p.isAoVivo ||
            (slot.classificacao && /ao_vivo|aovivo/i.test(slot.classificacao)) ||
            (p.classificacao && /ao_vivo|aovivo/i.test(p.classificacao)) ||
            (p.type === "LIVE") || (slot.type === "LIVE") ||
            /\bAO\s*VIVO\b/i.test(titulo) || /\bAOVIVO\b/i.test(titulo) ||
            /\bAO\s*VIVO\b/i.test(p.code || "")
          ),
          horarioFixo: (slot.isAoVivo || p.isAoVivo || /\bAO\s*VIVO\b/i.test(titulo) || (p.type === "LIVE")) ? horario : (slot.horarioFixo || p.horarioFixo || null),
          subprogramas: Array.isArray(slot.subprogramas) ? slot.subprogramas : null
        };
        const blocosOficiais = obterBlocosOficiais(normalizado, indiceAcervo);
        if (blocosOficiais.length) {
          normalizado.blocosCatalogo = blocosOficiais;
          normalizado.catalogoEncontrado = true;
        } else {
          normalizado.catalogoEncontrado = false;
          normalizado.code = `GRD_${String(horario).replace(/[^0-9]/g, '')}`;
        }
        normalizados.push(normalizado);
      });
      return normalizados;
    }

    // Se for formato simples { "PGM EXEMPLO": "08:00:00" }
    if (typeof slotsOuGrade === 'object') {
      return Object.entries(slotsOuGrade)
        .filter(([k]) => !k.startsWith('_'))
        .map(([titulo, horario], idx) => {
          const baseTitle = baseProgramTitle(titulo);
          const normalizado = {
            slotIndex: idx,
            slotId: `slot-simples-${idx}`,
            horario: String(horario),
            duracao: '00:30:00',
            titulo,
            baseTitle,
            normKey: normalizeKey(baseTitle),
            code: `GRD_${String(horario).replace(/[^0-9]/g, '')}`,
            midia: '0OMN',
            tipoExibicao: 'inedito',
            isReprise: false,
            episodio: extrairEpisodioDeTexto(titulo)
          };
          const blocosOficiais = obterBlocosOficiais(normalizado, indiceAcervo);
          if (blocosOficiais.length) {
            normalizado.blocosCatalogo = blocosOficiais;
            normalizado.catalogoEncontrado = true;
          } else {
            normalizado.catalogoEncontrado = false;
            normalizado.code = `GRD_${String(horario).replace(/[^0-9]/g, '')}`;
          }
          return normalizado;
        });
    }

    return [];
  }

  /**
   * Constrói blocos RPRO padrão para um slot da grade que é novo ou precisa de montagem inicial.
   */
  function construirBlocosPadraoParaSlot(slotGrade, opcoes = {}) {
    const tipoPrograma = opcoes.tipoPrograma || (
      (opcoes.emissora === "tv-brasil-int" || opcoes.emissoraId === "00000000-0000-0000-0000-000000000003" || (slotGrade && slotGrade.code && /^IPRO/i.test(slotGrade.code)))
        ? "IPRO"
        : ((opcoes.emissora === "canal-gov" || opcoes.emissoraId === "00000000-0000-0000-0000-000000000004" || (slotGrade && slotGrade.code && /^GPRO/i.test(slotGrade.code))) ? "GPRO" : "RPRO")
    );
    const duracaoTotal = slotGrade.tempoPrograma || slotGrade.duracao || '00:30:00';
    const ep = slotGrade.episodio;

    // Se a grade contém um programa/episódio localizado no acervo, usa os blocos oficiais
    // com seus codes, descrições e durações, sem repartir a duração alocada do slot.
    if (Array.isArray(slotGrade.blocosCatalogo) && slotGrade.blocosCatalogo.length > 0) {
      const oficiais = slotGrade.blocosCatalogo;
      return oficiais.map(item => {
        const bloco = extrairNumeroBlocoDeItem(item);
        const descricao = String(item.descricao || slotGrade.titulo || slotGrade.baseTitle || '').replace(/\s*\(REPRISE\)\s*$/i, '');
        return {
          ...item,
          type: item.type || tipoPrograma,
          code: item.code,
          midia: item.midia || '0OMN',
          tempo: item.tempo,
          descricao: slotGrade.isReprise && !/\(REPRISE\)/i.test(descricao) ? `${descricao} (REPRISE)` : descricao,
          bloco,
          totalBlocos: oficiais.length,
          programaId: slotGrade.programaId || item.programaId || null,
          programaNome: slotGrade.baseTitle,
          temporada: ep && ep.temporada != null ? ep.temporada : extrairEpisodioDeTexto(item.descricao).temporada,
          episodioNumero: ep && (ep.episodioNumero != null || ep.episodio != null) ? (ep.episodioNumero ?? ep.episodio) : extrairEpisodioDeTexto(item.descricao).episodio,
          episodioTitulo: ep && ep.titulo ? ep.titulo : null,
          isReprise: slotGrade.isReprise,
          origemReprise: slotGrade.origemReprise || null,
          faixaOcupada: slotGrade.faixaOcupada || null,
          _gradeSlotId: slotGrade.slotId,
          _horarioGrade: slotGrade.horario,
          _catalogoOficial: true,
          isAoVivo: Boolean(slotGrade.isAoVivo),
          horarioFixo: slotGrade.isAoVivo ? slotGrade.horario : (slotGrade.horarioFixo || null)
        };
      });
    }

    // Se o slot possui episódios e blocos definidos pelo GradeRecorrenciaCore
    if (ep && Array.isArray(ep.blocos) && ep.blocos.length > 0) {
      const totalBlocos = ep.blocos.length;
      return ep.blocos.map((b, idx) => {
        const numBloco = b.bloco || (idx + 1);
        const epDesc = ep.titulo ? ` - ${ep.titulo}` : '';
        const repTag = slotGrade.isReprise ? ' (REPRISE)' : '';
        const descCompleta = `${(slotGrade.titulo && slotGrade.titulo.trim()) || slotGrade.baseTitle}${epDesc} - BL 0${numBloco}${repTag}`;

        return {
          type: tipoPrograma,
          code: b.code || `${slotGrade.code}_B${numBloco}`,
          midia: b.midia || '0OMN',
          tempo: b.duracao || '00:10:00',
          descricao: descCompleta,
          bloco: numBloco,
          totalBlocos,
          programaId: slotGrade.programaId || null,
          programaNome: slotGrade.baseTitle,
          temporada: ep.temporada || null,
          episodioNumero: ep.episodioNumero || null,
          episodioTitulo: ep.titulo || null,
          isReprise: slotGrade.isReprise,
          origemReprise: slotGrade.origemReprise || null,
          faixaOcupada: slotGrade.faixaOcupada || null,
          _gradeSlotId: slotGrade.slotId,
          _horarioGrade: slotGrade.horario,
          isAoVivo: Boolean(slotGrade.isAoVivo),
          horarioFixo: slotGrade.isAoVivo ? slotGrade.horario : (slotGrade.horarioFixo || null)
        };
      });
    }

    // Quando o slot veio vinculado a um registro único do acervo, preserva code e tempo oficiais.
    if (slotGrade.catalogoEncontrado !== false && slotGrade.code && !String(slotGrade.code).startsWith('GRD_') && slotGrade.tempoPrograma) {
      const epDesc = ep && ep.titulo ? ` - ${ep.titulo}` : '';
      const repTag = slotGrade.isReprise ? ' (REPRISE)' : '';
      return [{
        type: tipoPrograma,
        code: slotGrade.code,
        midia: slotGrade.midia || '0OMN',
        tempo: slotGrade.tempoPrograma,
        descricao: `${slotGrade.titulo || slotGrade.baseTitle}${epDesc}${repTag}`,
        bloco: 1,
        totalBlocos: 1,
        programaId: slotGrade.programaId || null,
        programaNome: slotGrade.baseTitle,
        temporada: ep ? ep.temporada : null,
        episodioNumero: ep ? (ep.episodioNumero ?? ep.episodio ?? null) : null,
        episodioTitulo: ep ? ep.titulo || null : null,
        isReprise: slotGrade.isReprise,
        origemReprise: slotGrade.origemReprise || null,
        faixaOcupada: slotGrade.faixaOcupada || null,
        _gradeSlotId: slotGrade.slotId,
        _horarioGrade: slotGrade.horario,
        _catalogoOficial: true,
        isAoVivo: Boolean(slotGrade.isAoVivo),
        horarioFixo: slotGrade.isAoVivo ? slotGrade.horario : (slotGrade.horarioFixo || null)
      }];
    }

    // Padrão: 2 blocos para programas de 30min ou 1 bloco para programas curtos (15min)
    const durSec = timeToSec(duracaoTotal);
    const numBlocos = durSec <= 900 ? 1 : 2;
    const durBlocoSec = Math.floor((durSec - (numBlocos > 1 ? 180 : 0)) / numBlocos);
    const durBlocoStr = secToTime(durBlocoSec);

    const blocos = [];
    for (let b = 1; b <= numBlocos; b++) {
      const epDesc = ep && ep.titulo ? ` - ${ep.titulo}` : '';
      const repTag = slotGrade.isReprise ? ' (REPRISE)' : '';
      const blocoTag = numBlocos > 1 ? ` - BL 0${b}` : '';
      const descCompleta = `${(slotGrade.titulo && slotGrade.titulo.trim()) || slotGrade.baseTitle}${epDesc}${blocoTag}${repTag}`;

      blocos.push({
        type: tipoPrograma,
        code: `${slotGrade.code}_B${b}`,
        midia: '0OMN',
        tempo: durBlocoStr,
        descricao: descCompleta,
        bloco: b,
        totalBlocos: numBlocos,
        programaId: slotGrade.programaId || null,
        programaNome: slotGrade.baseTitle,
        temporada: ep ? ep.temporada : null,
        episodioNumero: ep ? ep.episodioNumero : null,
        episodioTitulo: ep ? ep.titulo : null,
        isReprise: slotGrade.isReprise,
        origemReprise: slotGrade.origemReprise || null,
        faixaOcupada: slotGrade.faixaOcupada || null,
        _gradeSlotId: slotGrade.slotId,
        _horarioGrade: slotGrade.horario,
        isAoVivo: Boolean(slotGrade.isAoVivo),
        horarioFixo: slotGrade.isAoVivo ? slotGrade.horario : (slotGrade.horarioFixo || null)
      });
    }

    return blocos;
  }

  /**
   * Atualiza as informações de episódio e metadados de um bloco de programa existente,
   * preservando a duração personalizada, edições e o status do operador.
   */
  function atualizarBlocoExistenteComSlotGrade(blocoExistente, slotGrade) {
    const atualizado = { ...blocoExistente };
    if (slotGrade.isAoVivo) {
      atualizado.isAoVivo = true;
      atualizado.horarioFixo = slotGrade.horario;
    }
    const ep = slotGrade.episodio;

    // Código e minutagem oficiais substituem somente identificadores/durações artificiais
    // de sincronizações anteriores. Alterações explicitamente marcadas pelo operador ficam intactas.
    const oficial = (slotGrade.blocosCatalogo || []).find(item => {
      const numero = extrairNumeroBlocoDeItem(item);
      return numero === (Number(blocoExistente.bloco) || getBlockNumber(blocoExistente.descricao));
    }) || (slotGrade.blocosCatalogo || [])[0];
    if (oficial) {
      if ((!blocoExistente.code || /^(?:GRD_|.*_B\d+$)/i.test(blocoExistente.code) || blocoExistente._catalogoOficial) && oficial.code) {
        atualizado.code = oficial.code;
      }
      if (!blocoExistente._tempoEditadoManualmente && oficial.tempo) atualizado.tempo = oficial.tempo;
      if (oficial.descricao) atualizado.descricao = oficial.descricao;
      atualizado._catalogoOficial = true;
    }

    // Atualiza metadados da grade
    atualizado._gradeSlotId = slotGrade.slotId;
    atualizado._horarioGrade = slotGrade.horario;
    atualizado.isReprise = slotGrade.isReprise;
    if (slotGrade.origemReprise) {
      atualizado.origemReprise = slotGrade.origemReprise;
    }
    if (slotGrade.faixaOcupada) {
      atualizado.faixaOcupada = slotGrade.faixaOcupada;
    }

    // Se a grade traz um novo episódio ou título de episódio atualizado
    if (ep && ep.titulo) {
      atualizado.episodioTitulo = ep.titulo;
      atualizado.temporada = ep.temporada != null ? ep.temporada : atualizado.temporada;
      atualizado.episodioNumero = ep.episodioNumero != null ? ep.episodioNumero : atualizado.episodioNumero;

      // Recompõe a descrição mantendo o número do bloco existente
      const numBloco = blocoExistente.bloco || getBlockNumber(blocoExistente.descricao);
      const repTag = slotGrade.isReprise ? ' (REPRISE)' : '';
      const epStr = ` - ${ep.titulo}`;
      atualizado.descricao = `${slotGrade.baseTitle}${epStr} - BL 0${numBloco}${repTag}`;
    } else if (slotGrade.isReprise && !atualizado.descricao.includes('(REPRISE)')) {
      atualizado.descricao = `${atualizado.descricao} (REPRISE)`;
    }

    return atualizado;
  }

  /**
   * FUNÇÃO PRINCIPAL DA ETAPA 3.4:
   * Conecta a Grade Semanal ao Roteiro Diário, conciliando os programas da grade
   * e PRESERVANDO integralmente:
   * 1. Todas as chamadas inseridas nos breaks
   * 2. Todos os interprogramas, comerciais e apoios
   * 3. Vinhetas manuais customizadas
   * 4. Peças fixas de início e fim
   * 5. Durações e ordens ajustadas manualmente
   *
   * @param {Array} roteiroAtual        Array de itens do roteiro diário atual
   * @param {Array|Object} slotsGrade   Slots da grade para o dia selecionado
   * @param {Object} [opcoes]           Configurações de conciliação
   * @returns {Object} { roteiroAtualizado, resumo, alteracoes }
   */
  function mesclarGradeComRoteiroPreservandoEdicoes(roteiroAtual = [], slotsGrade = [], opcoes = {}) {
    const {
      modo = 'inteligente', // 'inteligente' (preserva edições) | 'substituir' (recria tudo)
      regras = {},
      duracaoBreakPadrao = '00:03:00'
    } = opcoes;

    const indiceAcervo = opcoes.acervoIndex || indexarAcervo(opcoes.acervo || []);
    const opcoesComIndice = { ...opcoes, acervoIndex: indiceAcervo };
    const slotsNormalizados = normalizarSlotsGradeDoDia(slotsGrade, opcoesComIndice);

    // MODO SUBSTITUIR: Recria do zero a partir da grade
    if (modo === 'substituir' || !Array.isArray(roteiroAtual) || roteiroAtual.length === 0) {
      const novoRoteiro = [];
      slotsNormalizados.forEach((slot, sIdx) => {
        const blocos = construirBlocosPadraoParaSlot(slot, opcoes);
        if (typeof opcoes.geradorSequenciaPrograma === 'function') {
          const sequencia = opcoes.geradorSequenciaPrograma(blocos, slot, { indice: sIdx, total: slotsNormalizados.length, modo: 'substituir' });
          if (Array.isArray(sequencia)) {
            sequencia.forEach(item => novoRoteiro.push(item));
            return;
          }
        }
        blocos.forEach((b, bIdx) => {
          novoRoteiro.push(b);
          // Adiciona slots vazios de break entre blocos
          if (bIdx < blocos.length - 1) {
            novoRoteiro.push({
              code: '__BREAK__',
              descricao: '[ BREAK — chamada ]',
              tempo: '00:00:00',
              midia: '0OMN',
              type: '__SLOT__',
              _break: true
            });
            novoRoteiro.push({
              code: '__BREAK__',
              descricao: '[ BREAK — interprograma ]',
              tempo: '00:00:00',
              midia: '0OMN',
              type: '__SLOT__',
              _break: true
            });
          }
        });
        // Break ao final do programa se não for o último
        if (sIdx < slotsNormalizados.length - 1) {
          novoRoteiro.push({
            code: '__BREAK__',
            descricao: '[ BREAK — intervalo ]',
            tempo: duracaoBreakPadrao,
            midia: '0OMN',
            type: '__SLOT__',
            _break: true
          });
        }
      });

      const semCadastro = [];
      const titulosVistosSemCadastro = new Set();
      novoRoteiro.forEach(item => {
        if (isProgramaItem(item) && String(item.code || '').startsWith('GRD_')) {
          const nome = item.descricao || item.programaNome || item.baseTitle || item.code;
          const nomeLimpo = String(nome).replace(/\s*-?\s*BL\s*0*\d+.*$/i, '').replace(/\s*\(REPRISE\)\s*$/i, '').trim();
          if (nomeLimpo && !titulosVistosSemCadastro.has(nomeLimpo)) {
            titulosVistosSemCadastro.add(nomeLimpo);
            semCadastro.push(nomeLimpo);
          }
        }
      });
      const msgSubBase = `Roteiro preenchido do zero com ${slotsNormalizados.length} programas da Grade Semanal.`;
      const msgSub = semCadastro.length > 0
        ? `${msgSubBase} (${semCadastro.length} programas sem correspondência no cadastro: ${semCadastro.join(', ')})`
        : msgSubBase;

      return {
        roteiroAtualizado: novoRoteiro,
        resumo: {
          modo: 'substituir',
          totalItensAnteriores: roteiroAtual ? roteiroAtual.length : 0,
          totalItensResultantes: novoRoteiro.length,
          programasAtualizados: slotsNormalizados.length,
          programasNovos: slotsNormalizados.length,
          pecasManuaisPreservadas: 0,
          programasRemovidos: 0,
          programasSemCadastro: semCadastro,
          totalSemCadastro: semCadastro.length,
          itensInvalidosCadastro: (indiceAcervo && indiceAcervo.itensInvalidos) || [],
          totalInvalidosCadastro: (indiceAcervo && indiceAcervo.itensInvalidos ? indiceAcervo.itensInvalidos.length : 0),
          mensagem: msgSub
        }
      };
    }

    // MODO INTELIGENTE: Preserva edições e concilia com a nova grade
    const estrutura = desestruturarRoteiro(roteiroAtual);
    const gruposExistentes = estrutura.gruposProgramas;
    const mapaGruposPorNormKey = new Map();

    gruposExistentes.forEach((g, idx) => {
      if (!mapaGruposPorNormKey.has(g.normKey)) {
        mapaGruposPorNormKey.set(g.normKey, []);
      }
      mapaGruposPorNormKey.get(g.normKey).push({ grupo: g, indexOriginal: idx, usado: false });
    });

    const resultadoRoteiro = [];
    let totalProgramasAtualizados = 0;
    let totalProgramasNovos = 0;
    let totalPecasPreservadas = 0;
    const programasProcessadosKeys = new Set();

    // 1. Adiciona peças fixas iniciais intactas
    estrutura.fixasInicio.forEach(item => {
      resultadoRoteiro.push({ ...item, _preservado: true });
      if (isPecaManual(item)) totalPecasPreservadas++;
    });

    // 2. Itera pelos slots da Grade Semanal na ordem cronológica de exibição
    slotsNormalizados.forEach(slot => {
      const normKey = slot.normKey;
      const ocorrenciasExistentes = mapaGruposPorNormKey.get(normKey) || [];
      const correspondente = ocorrenciasExistentes.find(entry => !entry.usado);

      if (correspondente) {
        // CASO A: PROGRAMA JÁ EXISTIA NO ROTEIRO -> ATUALIZA E PRESERVA EDICÕES
        correspondente.usado = true;
        totalProgramasAtualizados++;
        programasProcessadosKeys.add(correspondente.grupo.id);

        const grupo = correspondente.grupo;

        // Em grupos sem peças manuais, refaz a sequência automática com o mesmo motor de vinhetas
        // do Roteiro. Se houver qualquer inserção do operador, mantém o caminho conservador.
        const temEdicaoManualNoGrupo = [
          ...(grupo.pecasBreaksInternos || []),
          ...(grupo.pecasBreakFinal || [])
        ].some(isPecaManual);
        let sequenciaAutomaticaAplicada = false;
        if (!temEdicaoManualNoGrupo && typeof opcoes.geradorSequenciaPrograma === 'function') {
          const blocosAtualizados = grupo.blocos.map(bloco => atualizarBlocoExistenteComSlotGrade(bloco, slot));
          const sequencia = opcoes.geradorSequenciaPrograma(blocosAtualizados, slot, { modo: 'inteligente', existente: true });
          if (Array.isArray(sequencia)) {
            sequencia.forEach(item => resultadoRoteiro.push(item));
            sequenciaAutomaticaAplicada = true;
          }
        }

        if (!sequenciaAutomaticaAplicada) {
          // Atualiza blocos existentes preservando chamadas e edições do operador
          grupo.blocos.forEach((blocoOriginal, bIdx) => {
            const blocoAtualizado = atualizarBlocoExistenteComSlotGrade(blocoOriginal, slot);
            resultadoRoteiro.push(blocoAtualizado);

            // Se houver peças em breaks internos entre blocos deste programa, reinsere todas!
            if (grupo.pecasBreaksInternos && grupo.pecasBreaksInternos.length > 0) {
              grupo.pecasBreaksInternos.forEach(p => {
                resultadoRoteiro.push({ ...p, _preservado: true });
                if (isPecaManual(p)) totalPecasPreservadas++;
              });
            } else if (bIdx < grupo.blocos.length - 1) {
              resultadoRoteiro.push({
                code: '__BREAK__', descricao: '[ BREAK — chamada ]', tempo: '00:00:00',
                midia: '0OMN', type: '__SLOT__', _break: true
              });
            }
          });
        }

        // Reinsere TODAS as peças manuais, chamadas e interprogramas que estavam no break deste programa
        if (!sequenciaAutomaticaAplicada && grupo.pecasBreakFinal && grupo.pecasBreakFinal.length > 0) {
          grupo.pecasBreakFinal.forEach(pecaManual => {
            resultadoRoteiro.push({ ...pecaManual, _preservado: true });
            if (isPecaManual(pecaManual)) totalPecasPreservadas++;
          });
        } else if (!sequenciaAutomaticaAplicada) {
          // Mantém slot de intervalo se não havia peças
          resultadoRoteiro.push({
            code: '__BREAK__',
            descricao: '[ BREAK — intervalo ]',
            tempo: duracaoBreakPadrao,
            midia: '0OMN',
            type: '__SLOT__',
            _break: true
          });
        }
      } else {
        // CASO B: NOVO PROGRAMA DA GRADE -> INSERE COM SEUS BLOCOS E BREAKS PADRÃO
        totalProgramasNovos++;
        const novosBlocos = construirBlocosPadraoParaSlot(slot, opcoes);
        if (typeof opcoes.geradorSequenciaPrograma === 'function') {
          const sequencia = opcoes.geradorSequenciaPrograma(novosBlocos, slot, { modo: 'inteligente' });
          if (Array.isArray(sequencia)) {
            sequencia.forEach(item => resultadoRoteiro.push(item));
            resultadoRoteiro.push({
              code: '__BREAK__', descricao: '[ BREAK — intervalo ]', tempo: duracaoBreakPadrao,
              midia: '0OMN', type: '__SLOT__', _break: true
            });
            return;
          }
        }
        novosBlocos.forEach((b, bIdx) => {
          resultadoRoteiro.push({ ...b, _novoDaGrade: true });
          if (bIdx < novosBlocos.length - 1) {
            resultadoRoteiro.push({
              code: '__BREAK__',
              descricao: '[ BREAK — chamada ]',
              tempo: '00:00:00',
              midia: '0OMN',
              type: '__SLOT__',
              _break: true
            });
            resultadoRoteiro.push({
              code: '__BREAK__',
              descricao: '[ BREAK — interprograma ]',
              tempo: '00:00:00',
              midia: '0OMN',
              type: '__SLOT__',
              _break: true
            });
          }
        });
        resultadoRoteiro.push({
          code: '__BREAK__',
          descricao: '[ BREAK — intervalo ]',
          tempo: duracaoBreakPadrao,
          midia: '0OMN',
          type: '__SLOT__',
          _break: true
        });
      }
    });

    // 3. PROGRAMAS EXISTENTES QUE NÃO ESTAVAM NA NOVA GRADE:
    // Se continham peças manuais do operador, PRESERVA no final ou marca como [FORA DA GRADE]
    let totalProgramasRemovidos = 0;
    gruposExistentes.forEach(g => {
      const ocorrencias = mapaGruposPorNormKey.get(g.normKey) || [];
      const sobrouSemUso = ocorrencias.some(entry => entry.grupo === g && !entry.usado);

      if (sobrouSemUso) {
        totalProgramasRemovidos++;
        const temPecasManuais = (g.pecasBreakFinal && g.pecasBreakFinal.length > 0) ||
                                (g.pecasBreaksInternos && g.pecasBreaksInternos.length > 0);

        if (temPecasManuais) {
          // Preserva o bloco com aviso visual para não perder o trabalho de inserção de chamadas
          g.blocos.forEach(b => {
            resultadoRoteiro.push({
              ...b,
              descricao: `${b.descricao} [NÃO CONSTA NA NOVA GRADE]`,
              _foraDaGrade: true,
              _preservado: true
            });
          });
          if (g.pecasBreakFinal) {
            g.pecasBreakFinal.forEach(p => {
              resultadoRoteiro.push({ ...p, _preservado: true });
              if (isPecaManual(p)) totalPecasPreservadas++;
            });
          }
        }
      }
    });

    // 4. Adiciona peças fixas finais intactas
    estrutura.fixasFim.forEach(item => {
      resultadoRoteiro.push({ ...item, _preservado: true });
      if (isPecaManual(item)) totalPecasPreservadas++;
    });

    // 5. Recalcula horários IN e OUT acumulados
    let cumSec = START_SECONDS_DEFAULT;
    const roteiroFinalRecalculado = resultadoRoteiro.map(item => {
      const durSec = timeToSec(item.tempo);
      const inTime = secToTime(cumSec % 86400);
      cumSec += durSec;
      const outTime = secToTime(cumSec % 86400);
      return {
        ...item,
        in: inTime,
        out: outTime
      };
    });

    const semCadastro = [];
    const titulosVistosSemCadastro = new Set();
    roteiroFinalRecalculado.forEach(item => {
      if (isProgramaItem(item) && String(item.code || '').startsWith('GRD_')) {
        const nome = item.descricao || item.programaNome || item.baseTitle || item.code;
        const nomeLimpo = String(nome).replace(/\s*-?\s*BL\s*0*\d+.*$/i, '').replace(/\s*\(REPRISE\)\s*$/i, '').trim();
        if (nomeLimpo && !titulosVistosSemCadastro.has(nomeLimpo)) {
          titulosVistosSemCadastro.add(nomeLimpo);
          semCadastro.push(nomeLimpo);
        }
      }
    });
    const msgIntelBase = `Sincronização concluída com segurança: ${totalProgramasAtualizados} programas atualizados, ${totalProgramasNovos} novos inseridos e ${totalPecasPreservadas} chamadas/vinhetas preservadas.`;
    const msgIntel = semCadastro.length > 0
      ? `${msgIntelBase} (${semCadastro.length} programas sem correspondência no cadastro: ${semCadastro.join(', ')})`
      : msgIntelBase;

    return {
      roteiroAtualizado: roteiroFinalRecalculado,
      resumo: {
        modo: 'inteligente',
        totalItensAnteriores: roteiroAtual.length,
        totalItensResultantes: roteiroFinalRecalculado.length,
        programasAtualizados: totalProgramasAtualizados,
        programasNovos: totalProgramasNovos,
        programasRemovidos: totalProgramasRemovidos,
        pecasManuaisPreservadas: totalPecasPreservadas,
        programasSemCadastro: semCadastro,
        totalSemCadastro: semCadastro.length,
        itensInvalidosCadastro: (indiceAcervo && indiceAcervo.itensInvalidos) || [],
        totalInvalidosCadastro: (indiceAcervo && indiceAcervo.itensInvalidos ? indiceAcervo.itensInvalidos.length : 0),
        mensagem: msgIntel
      }
    };
  }

  /**
   * Empacota a publicação da Grade Semanal gerando metadados auditáveis e snapshots.
   */
  function selecionarGradeParaData(dataKey, diaSemana, saved = {}) {
    const info = saved.gradePublicadaInfo || saved.gradeSemanalInfo || null;
    const temPeriodo = !!(info && info.dataInicio && info.dataFim);
    const dentroDaSemana = temPeriodo ? (dataKey >= info.dataInicio && dataKey <= info.dataFim) : null;
    if (temPeriodo && !dentroDaSemana) return { blocks: [], info, dentroDaSemana: false, fonte: 'fora_da_vigencia' };

    if (dentroDaSemana) {
      const publicados = (saved.gradePublicadaBlocksByDay || {})[diaSemana] || [];
      if (publicados.length) return { blocks: publicados, info, dentroDaSemana: true, fonte: 'publicada' };
    }
    const rascunho = (saved.gradeBlocksByDay || {})[diaSemana] || [];
    if (rascunho.length) return { blocks: rascunho, info, dentroDaSemana, fonte: 'rascunho' };
    return { blocks: [], info, dentroDaSemana, fonte: 'nenhuma' };
  }

  function prepararPublicacaoGradeSemanal(params = {}) {
    const {
      emissoraId = null,
      blocksByDay = {},
      recurrenceState = {},
      resumoSemana = null,
      publicadoPor = null
    } = params;

    const agora = new Date();
    const versao = agora.getTime();

    const info = {
      versao,
      publicadoEm: agora.toISOString(),
      publicadoPor: publicadoPor || 'Operador',
      emissoraId: emissoraId || 'padrao',
      status: 'publicada',
      semanaNumero: resumoSemana ? resumoSemana.numeroSemana : null,
      periodoFormatado: resumoSemana ? resumoSemana.periodoFormatado : null,
      dataInicio: resumoSemana ? resumoSemana.dataInicio : null,
      dataFim: resumoSemana ? resumoSemana.dataFim : null,
      rotuloCompleto: resumoSemana ? resumoSemana.rotuloCompleto : `Grade Publicada em ${agora.toLocaleDateString('pt-BR')}`
    };

    return {
      info,
      gradePublicadaByDay: blocksByDay,
      gradeRecorrencia: recurrenceState,
      versao
    };
  }

  /**
   * Verifica se uma data específica do Roteiro possui atualização de Grade Semanal pendente de sincronização.
   */
  function verificarGradePendenteParaData(dataStr, roteiroSalvo = {}, gradePublicadaInfo = null) {
    if (!dataStr || !gradePublicadaInfo) return { pendente: false };

    const metaRoteiro = (roteiroSalvo && roteiroSalvo._metaGrade) || {};
    const versaoRoteiro = metaRoteiro.versaoGrade || 0;
    const versaoPublicada = gradePublicadaInfo.versao || 0;

    const pendente = versaoPublicada > versaoRoteiro;

    return {
      pendente,
      versaoPublicada,
      versaoRoteiro,
      publicadoEm: gradePublicadaInfo.publicadoEm,
      semanaNumero: gradePublicadaInfo.semanaNumero,
      rotuloCompleto: gradePublicadaInfo.rotuloCompleto || 'Grade Semanal Atualizada'
    };
  }

  return {
    timeToSec,
    secToTime,
    normalizeKey,
    baseProgramTitle,
    getBlockNumber,
    isProgramaItem,
    isPecaManual,
    isSlotVazio,
    desestruturarRoteiro,
    normalizarTituloCatalogo,
    normalizarSlotsGradeDoDia,
    construirBlocosPadraoParaSlot,
    atualizarBlocoExistenteComSlotGrade,
    mesclarGradeComRoteiroPreservandoEdicoes,
    prepararPublicacaoGradeSemanal,
    selecionarGradeParaData,
    verificarGradePendenteParaData
  };
});

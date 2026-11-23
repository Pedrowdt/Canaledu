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
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function baseProgramTitle(desc) {
    return String(desc || '')
      .replace(/^\s*(?:PGM|RPRO|GPRO|IPRO)\s+/i, '')
      .replace(/\s*-?\s*T\s*\d+\s*EP\s*\d+.*$/i, '')
      .replace(/\s*-?\s*EP\s*\d+.*$/i, '')
      .replace(/\s*-?\s*\bBL\s*\d+.*$/i, '')
      .replace(/\s*\(.*?\)\s*$/, '')
      .replace(/\s*\d+'\s*$/, '')
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
  function normalizarSlotsGradeDoDia(slotsOuGrade = []) {
    if (!slotsOuGrade) return [];

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

        normalizados.push({
          slotIndex: idx,
          slotId: slot.id || `slot-${idx}-${horario.replace(/:/g, '')}`,
          horario,
          duracao,
          titulo,
          baseTitle,
          normKey,
          code: p.code || slot.code || `GRD_${horario.replace(/[^0-9]/g, '')}`,
          midia: p.midia || '0OMN',
          tipoExibicao: slot.tipoExibicao || p.tipoExibicao || (slot.isReprise ? 'reprise' : 'inedito'),
          isReprise: Boolean(slot.isReprise || slot.tipoExibicao === 'reprise'),
          origemReprise: slot.origemReprise || null,
          episodio: slot.episodio || p.episodio || null,
          faixaOcupada: slot.faixaNome || p.faixaOcupada || p.faixa_ocupada || '',
          classificacao: slot.classificacao || p.classificacao || 'L',
          programaId: p.id || slot.programaId || null,
          subprogramas: Array.isArray(slot.subprogramas) ? slot.subprogramas : null
        });
      });
      return normalizados;
    }

    // Se for formato simples { "PGM EXEMPLO": "08:00:00" }
    if (typeof slotsOuGrade === 'object') {
      return Object.entries(slotsOuGrade)
        .filter(([k]) => !k.startsWith('_'))
        .map(([titulo, horario], idx) => {
          const baseTitle = baseProgramTitle(titulo);
          return {
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
            episodio: null
          };
        });
    }

    return [];
  }

  /**
   * Constrói blocos RPRO padrão para um slot da grade que é novo ou precisa de montagem inicial.
   */
  function construirBlocosPadraoParaSlot(slotGrade, opcoes = {}) {
    const tipoPrograma = opcoes.tipoPrograma || 'RPRO';
    const duracaoTotal = slotGrade.duracao || '00:30:00';
    const ep = slotGrade.episodio;

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
          _horarioGrade: slotGrade.horario
        };
      });
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
        _horarioGrade: slotGrade.horario
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
    const ep = slotGrade.episodio;

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

    const slotsNormalizados = normalizarSlotsGradeDoDia(slotsGrade);

    // MODO SUBSTITUIR: Recria do zero a partir da grade
    if (modo === 'substituir' || !Array.isArray(roteiroAtual) || roteiroAtual.length === 0) {
      const novoRoteiro = [];
      slotsNormalizados.forEach((slot, sIdx) => {
        const blocos = construirBlocosPadraoParaSlot(slot, opcoes);
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
          mensagem: `Roteiro preenchido do zero com ${slotsNormalizados.length} programas da Grade Semanal.`
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
            // Se não tinha peças, preserva os slots de break padrão
            resultadoRoteiro.push({
              code: '__BREAK__',
              descricao: '[ BREAK — chamada ]',
              tempo: '00:00:00',
              midia: '0OMN',
              type: '__SLOT__',
              _break: true
            });
          }
        });

        // Reinsere TODAS as peças manuais, chamadas e interprogramas que estavam no break deste programa
        if (grupo.pecasBreakFinal && grupo.pecasBreakFinal.length > 0) {
          grupo.pecasBreakFinal.forEach(pecaManual => {
            resultadoRoteiro.push({ ...pecaManual, _preservado: true });
            if (isPecaManual(pecaManual)) totalPecasPreservadas++;
          });
        } else {
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
        mensagem: `Sincronização concluída com segurança: ${totalProgramasAtualizados} programas atualizados, ${totalProgramasNovos} novos inseridos e ${totalPecasPreservadas} chamadas/vinhetas preservadas.`
      }
    };
  }

  /**
   * Empacota a publicação da Grade Semanal gerando metadados auditáveis e snapshots.
   */
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
    normalizarSlotsGradeDoDia,
    construirBlocosPadraoParaSlot,
    atualizarBlocoExistenteComSlotGrade,
    mesclarGradeComRoteiroPreservandoEdicoes,
    prepararPublicacaoGradeSemanal,
    verificarGradePendenteParaData
  };
});

// src/core/gradeRecorrenciaCore.js
// Lógica pura para gestão de recorrência de programas na grade:
// - Slots de Inédito vs Reprise vinculada a um slot inédito de referência
// - Fila ordenada de episódios por programa (títulos arbitrários / códigos)
// - Exceções pontuais por data (overrides de episódio ou programa sem tocar na regra semanal)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GradeRecorrenciaCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TIPOS_SLOT = {
    INEDITO: 'inedito',
    REPRISE: 'reprise',
    FIXO: 'fixo' // programa fixo sem fila/episódio (ex: jornal ao vivo, interprograma)
  };

  const TIPOS_EXCECAO = {
    SUBSTITUIR_EPISODIO: 'substituir_episodio',
    SUBSTITUIR_PROGRAMA: 'substituir_programa',
    CANCELAR_SLOT: 'cancelar_slot'
  };

  /**
   * Cria ou normaliza um slot com regras de recorrência para a grade base.
   */
  function criarSlotRecorrente(config = {}) {
    const {
      id = `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      diaSemana = 1, // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
      horario = '08:00:00',
      duracao = '00:30:00',
      programaId = null,
      programaNome = '',
      tipoExibicao = TIPOS_SLOT.INEDITO,
      origemReprise = null // ex: { diaSemana: 1, horario: '08:00:00' }
    } = config;

    const normalizado = {
      id,
      diaSemana: Number(diaSemana),
      horario: String(horario).trim(),
      duracao: String(duracao).trim(),
      programaId: programaId ? String(programaId) : null,
      programaNome: String(programaNome || '').trim(),
      tipoExibicao: Object.values(TIPOS_SLOT).includes(tipoExibicao) ? tipoExibicao : TIPOS_SLOT.INEDITO,
      mestreSlotId: config.mestreSlotId || config.repriseDeSlotId || null,
      episodio: config.episodio || null,
      origemReprise: null
    };

    if (normalizado.tipoExibicao === TIPOS_SLOT.REPRISE && origemReprise) {
      normalizado.origemReprise = {
        diaSemana: Number(origemReprise.diaSemana),
        horario: String(origemReprise.horario).trim()
      };
    }

    return normalizado;
  }

  /**
   * Adiciona ou atualiza um episódio na fila ordenada de um programa.
   * Não depende de números no título; a ordem é explícita.
   */
  function adicionarEpisodioFila(fila = [], episodio = {}) {
    const novaFila = Array.isArray(fila) ? [...fila] : [];
    const id = episodio.id || `ep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const ordem = typeof episodio.ordem === 'number' ? episodio.ordem : (novaFila.length + 1);

    const novoEp = {
      id: String(id),
      codigo: episodio.codigo ? String(episodio.codigo).trim() : '',
      titulo: String(episodio.titulo || '').trim(),
      duracao: episodio.duracao ? String(episodio.duracao).trim() : '00:26:00',
      ordem,
      status: episodio.status || 'pendente', // 'pendente' | 'exibido' | 'pulado'
      exibicoes: Array.isArray(episodio.exibicoes) ? [...episodio.exibicoes] : []
    };

    const idxExistente = novaFila.findIndex(e => e.id === novoEp.id || (novoEp.codigo && e.codigo === novoEp.codigo));
    if (idxExistente >= 0) {
      novaFila[idxExistente] = { ...novaFila[idxExistente], ...novoEp };
    } else {
      novaFila.push(novoEp);
    }

    return ordenarFila(novaFila);
  }

  /**
   * Ordena a fila de episódios por número de ordem crescente.
   */
  function ordenarFila(fila = []) {
    return [...fila].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }

  /**
   * Obtém o próximo episódio pendente de exibição.
   */
  function obterProximoEpisodio(fila = [], cursor = 0) {
    if (!Array.isArray(fila) || fila.length === 0) return null;
    const ordenados = ordenarFila(fila);
    if (cursor >= 0 && cursor < ordenados.length) {
      return ordenados[cursor];
    }
    const pendente = ordenados.find(e => e.status === 'pendente');
    return pendente || ordenados[0] || null;
  }

  /**
   * Cadastra uma exceção pontual para uma data e horário específicos.
   * Garante isolamento: NUNCA altera a grade base semanal.
   */
  function cadastrarExcecao(mapaExcecoes = {}, params = {}) {
    const novoMapa = { ...mapaExcecoes };
    const {
      data, // 'YYYY-MM-DD'
      horario, // 'HH:MM:SS' ou 'HH:MM'
      tipoExcecao = TIPOS_EXCECAO.SUBSTITUIR_EPISODIO,
      programaId = null,
      programaNome = '',
      episodioId = null,
      episodioTitulo = '',
      motivo = '',
      avancarFila = false // Se true, consome episódio da fila; se false, mantém cursor pausado
    } = params;

    if (!data || !horario) {
      throw new Error('Data e horário são obrigatórios para cadastrar uma exceção pontual.');
    }

    const dataChave = String(data).trim();
    const horaChave = String(horario).trim();

    if (!novoMapa[dataChave]) {
      novoMapa[dataChave] = {};
    } else {
      novoMapa[dataChave] = { ...novoMapa[dataChave] };
    }

    novoMapa[dataChave][horaChave] = {
      tipoExcecao,
      programaId: programaId ? String(programaId) : null,
      programaNome: String(programaNome || '').trim(),
      episodioId: episodioId ? String(episodioId) : null,
      episodioTitulo: String(episodioTitulo || '').trim(),
      motivo: String(motivo || '').trim(),
      avancarFila: Boolean(avancarFila),
      criadoEm: new Date().toISOString()
    };

    return novoMapa;
  }

  /**
   * Remove uma exceção pontual, restaurando a regra semanal para aquela data/hora.
   */
  function removerExcecao(mapaExcecoes = {}, data, horario) {
    const novoMapa = { ...mapaExcecoes };
    const dataChave = String(data).trim();
    const horaChave = String(horario).trim();

    if (novoMapa[dataChave] && novoMapa[dataChave][horaChave]) {
      novoMapa[dataChave] = { ...novoMapa[dataChave] };
      delete novoMapa[dataChave][horaChave];
      if (Object.keys(novoMapa[dataChave]).length === 0) {
        delete novoMapa[dataChave];
      }
    }
    return novoMapa;
  }

  /**
   * Consulta se há exceção pontual para uma data e horário.
   */
  function obterExcecao(mapaExcecoes = {}, data, horario) {
    if (!mapaExcecoes || !data || !horario) return null;
    const dataChave = String(data).trim();
    const horaChave = String(horario).trim();
    return mapaExcecoes[dataChave]?.[horaChave] || null;
  }

  /**
   * Resolve a grade de um dia específico aplicando:
   * 1. Regra semanal mestre
   * 2. Vínculo de reprise com o inédito da semana
   * 3. Exceção pontual da data (override isolado)
   * 4. Consumo da fila de episódios
   */
  function resolverGradeDoDia(params = {}) {
    const {
      data, // 'YYYY-MM-DD'
      diaSemana, // 0..6
      slotsGradeBase = [], // slots do diaSemana configurados na grade mestre
      filasPorPrograma = {}, // { [programaId || programaNome]: [episodios] }
      cursoresProgramas = {}, // { [programaId || programaNome]: index }
      excecoesPorData = {}, // mapa de exceções
      exibicoesSemana = {} // mapa de inéditos já agendados na semana { "diaSemana-horario": { programa, episodio } }
    } = params;

    const dataChave = String(data).trim();
    const slotsResolvidos = [];
    const novoCursores = { ...cursoresProgramas };
    const novasExibicoesSemana = { ...exibicoesSemana };

    for (const slot of slotsGradeBase) {
      const horaChave = slot.horario;
      const chaveOrigem = `${diaSemana}-${horaChave}`;
      const progIdentificador = slot.programaId || slot.programaNome;
      const excecao = obterExcecao(excecoesPorData, dataChave, horaChave);

      // CASO 1: Slot cancelado por exceção na data
      if (excecao && excecao.tipoExcecao === TIPOS_EXCECAO.CANCELAR_SLOT) {
        slotsResolvidos.push({
          ...slot,
          cancelado: true,
          isExcecao: true,
          motivoExcecao: excecao.motivo || 'Cancelado pontualmente nesta data',
          programaNome: '(Transmissão Cancelada / Vago)',
          episodio: null
        });
        continue;
      }

      // CASO 2: Exceção pontual de troca de programa
      if (excecao && excecao.tipoExcecao === TIPOS_EXCECAO.SUBSTITUIR_PROGRAMA) {
        slotsResolvidos.push({
          ...slot,
          programaId: excecao.programaId || null,
          programaNome: excecao.programaNome || 'Especial',
          isExcecao: true,
          tipoExcecao: excecao.tipoExcecao,
          motivoExcecao: excecao.motivo,
          episodio: excecao.episodioTitulo ? { titulo: excecao.episodioTitulo, id: excecao.episodioId } : null
        });
        continue;
      }

      // CASO 3: Exceção pontual de troca de episódio (mantém programa, altera episódio)
      if (excecao && excecao.tipoExcecao === TIPOS_EXCECAO.SUBSTITUIR_EPISODIO) {
        const epSubstituto = {
          id: excecao.episodioId || 'ep-excecao',
          titulo: excecao.episodioTitulo || 'Episódio Especial',
          isExcecao: true
        };

        if (excecao.avancarFila && progIdentificador) {
          novoCursores[progIdentificador] = (novoCursores[progIdentificador] || 0) + 1;
        }

        // Se este slot era inédito de origem, registra na semana para as reprises acompanharem
        novasExibicoesSemana[chaveOrigem] = {
          programaNome: slot.programaNome,
          episodio: epSubstituto
        };

        slotsResolvidos.push({
          ...slot,
          episodio: epSubstituto,
          isExcecao: true,
          tipoExcecao: excecao.tipoExcecao,
          motivoExcecao: excecao.motivo
        });
        continue;
      }

      // CASO 4: Sem exceção — segue regra semanal normal
      if (slot.tipoExibicao === TIPOS_SLOT.INEDITO) {
        const fila = filasPorPrograma[progIdentificador] || [];
        const cursorAtual = novoCursores[progIdentificador] || 0;
        const ep = obterProximoEpisodio(fila, cursorAtual);

        // Registra o episódio deste inédito para ser espelhado pelas reprises da mesma semana
        novasExibicoesSemana[chaveOrigem] = {
          programaNome: slot.programaNome,
          episodio: ep
        };

        // Avança o cursor para a próxima exibição inédita
        if (ep) {
          novoCursores[progIdentificador] = cursorAtual + 1;
        }

        slotsResolvidos.push({
          ...slot,
          episodio: ep,
          isExcecao: false,
          isReprise: false
        });
      } else if (slot.tipoExibicao === TIPOS_SLOT.REPRISE) {
        // Busca o episódio do slot inédito de origem configurado
        let epReprise = null;
        let origemEncontrada = null;

        if (slot.origemReprise) {
          const chaveBusca = `${slot.origemReprise.diaSemana}-${slot.origemReprise.horario}`;
          origemEncontrada = novasExibicoesSemana[chaveBusca];
          if (origemEncontrada) {
            epReprise = origemEncontrada.episodio;
          }
        }

        // Fallback caso a reprise ocorra antes do inédito na semana ou origem não preenchida
        if (!epReprise && progIdentificador) {
          const fila = filasPorPrograma[progIdentificador] || [];
          const cursorAtual = novoCursores[progIdentificador] || 0;
          epReprise = obterProximoEpisodio(fila, Math.max(0, cursorAtual - 1)) || obterProximoEpisodio(fila, 0);
        }

        slotsResolvidos.push({
          ...slot,
          episodio: epReprise,
          isExcecao: false,
          isReprise: true,
          origemReprise: slot.origemReprise || null
        });
      } else {
        // Fixo / livre
        slotsResolvidos.push({
          ...slot,
          isExcecao: false,
          episodio: null
        });
      }
    }

    return {
      data: dataChave,
      diaSemana,
      slots: slotsResolvidos,
      cursoresAtualizados: novoCursores,
      exibicoesSemana: novasExibicoesSemana
    };
  }

  /**
   * Resolve uma semana inteira (7 dias consecutivos) garantindo que:
   * - Inéditos avançam a fila
   * - Reprises espelham os episódios dos dias anteriores correspondentes
   * - Exceções por data específica aplicam sem poluir a grade semanal
   */
  function resolverGradeSemana(params = {}) {
    const {
      dataInicio, // 'YYYY-MM-DD' (data de referência do início da semana, ex: Segunda)
      diasSemana = [1, 2, 3, 4, 5, 6, 0], // Seg -> Dom
      gradeBasePorDia = {}, // { [diaSemana]: [slots] }
      filasPorPrograma = {},
      cursoresIniciais = {},
      excecoesPorData = {}
    } = params;

    const dataObj = new Date(dataInicio + 'T00:00:00');
    const inicioDow = dataObj.getDay();
    const normInicio = inicioDow === 0 ? 7 : inicioDow;

    let cursoresAtuais = { ...cursoresIniciais };
    let exibicoesSemana = {};
    const diasResolvidos = [];

    for (const dow of diasSemana) {
      const normDow = dow === 0 ? 7 : dow;
      const offsetDias = normDow - normInicio;
      const diaCorrente = new Date(dataObj);
      diaCorrente.setDate(dataObj.getDate() + offsetDias);
      const dataStr = diaCorrente.toISOString().split('T')[0];

      const slotsDoDia = gradeBasePorDia[dow] || [];
      const resultadoDia = resolverGradeDoDia({
        data: dataStr,
        diaSemana: dow,
        slotsGradeBase: slotsDoDia,
        filasPorPrograma,
        cursoresProgramas: cursoresAtuais,
        excecoesPorData,
        exibicoesSemana
      });

      cursoresAtuais = resultadoDia.cursoresAtualizados;
      exibicoesSemana = resultadoDia.exibicoesSemana;
      diasResolvidos.push(resultadoDia);
    }

    return {
      dataInicio,
      dias: diasResolvidos,
      cursoresFinais: cursoresAtuais,
      exibicoesSemana
    };
  }

  // =========================================================================
  // 5 Classificações Oficiais TV Brasil (conforme legenda da grade oficial)
  // =========================================================================
  const CLASSIFICACOES = {
    TV_BRASIL: {
      id: 'tv_brasil',
      label: 'Produções TV Brasil',
      cor: '#92D050',
      corTexto: '#143808',
      bgBadge: '#eaf8dc',
      borderBadge: '#92D050'
    },
    TV_BRASIL_AOVIVO: {
      id: 'tv_brasil_aovivo',
      label: 'Produções TV Brasil Ao Vivo',
      cor: '#FFFF00',
      corTexto: '#4d4000',
      bgBadge: '#fefce8',
      borderBadge: '#eab308'
    },
    LICENCIADO: {
      id: 'licenciado',
      label: 'Conteúdos Licenciados',
      cor: '#FFFFFF',
      corTexto: '#1e293b',
      bgBadge: '#ffffff',
      borderBadge: '#cbd5e1'
    },
    RNCP: {
      id: 'rnpc',
      label: 'Produções RNCP',
      cor: '#B8CCE4',
      corTexto: '#1e3a5f',
      bgBadge: '#f0f5fa',
      borderBadge: '#8faadc'
    },
    REPRISE_MADRUGADA: {
      id: 'reprise_madrugada',
      label: 'Reprises Madrugada',
      cor: '#D9D9D9',
      corTexto: '#334155',
      bgBadge: '#f1f5f9',
      borderBadge: '#94a3b8'
    }
  };

  const EMISSORAS_RNCP_KEYWORDS = [
    'TV SAGRES', 'TVC PARÁ', 'TVC', 'TV UESB', 'UESB', 'TV UERN', 'UERN',
    'TVU RN', 'TVU', 'REDE BELA ALIANÇA', 'REDE BELA', 'TVT', 'TV ENCONTRO DAS ÁGUAS',
    'ENCONTRO DAS ÁGUAS', 'TVE ES', 'TVE', 'TV EDUCATIVA MS', 'TV EDUCATIVA',
    'TV GUARAPARI', 'TV ALERJ', 'RNCP', 'RNPC'
  ];

  function detectarClassificacao(slotOuPrograma = {}) {
    if (!slotOuPrograma) return CLASSIFICACOES.TV_BRASIL;

    const classifRaw = slotOuPrograma.classificacao || slotOuPrograma.program?.classificacao;
    if (classifRaw) {
      const chave = String(classifRaw).toUpperCase();
      if (CLASSIFICACOES[chave]) return CLASSIFICACOES[chave];
      const match = Object.values(CLASSIFICACOES).find(c => c.id === String(classifRaw).toLowerCase());
      if (match) return match;
    }

    const title = String(slotOuPrograma.title || slotOuPrograma.program?.title || slotOuPrograma.programaNome || '').toUpperCase();
    const code = String(slotOuPrograma.code || slotOuPrograma.program?.code || '').toUpperCase();
    const horario = String(slotOuPrograma.time || slotOuPrograma.horario || '');
    const tipo = String(slotOuPrograma.tipoExibicao || '');

    // 1. Ao Vivo
    if (title.includes('AO VIVO') || code.includes('AOVIVO')) {
      return CLASSIFICACOES.TV_BRASIL_AOVIVO;
    }

    // 2. Reprises da Madrugada (01:00 às 05:45)
    if (tipo === 'reprise' && horario) {
      const horaNum = parseInt(horario.split(':')[0], 10);
      if (!isNaN(horaNum) && (horaNum >= 1 && horaNum <= 5)) {
        return CLASSIFICACOES.REPRISE_MADRUGADA;
      }
    }

    // 3. RNCP
    if (EMISSORAS_RNCP_KEYWORDS.some(k => title.includes(k) || code.includes(k))) {
      return CLASSIFICACOES.RNCP;
    }

    // 4. Licenciados
    if (title.includes('SESSÃO DE CINEMA') || title.includes('FESTIVAL DE CINEMA') || title.includes('LICENCIADO')) {
      return CLASSIFICACOES.LICENCIADO;
    }

    return CLASSIFICACOES.TV_BRASIL;
  }

  // =========================================================================
  // Faixas Compostas (ex: TV Brasil Animada agrupando 23 atrações)
  // =========================================================================
  function normalizarSubprograma(sub = {}, ordem = 1) {
    return {
      id: sub.id || 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      titulo: (sub.titulo || sub.title || 'Atração Sem Título').trim(),
      temporada: (sub.temporada || '').trim(),
      episodio: (sub.episodio || '').trim(),
      duracao: sub.duracao || '00:15:00',
      ordem: typeof sub.ordem === 'number' ? sub.ordem : ordem,
      observacao: sub.observacao || ''
    };
  }

  function criarFaixaComposta(config = {}) {
    const {
      titulo = 'Faixa de Programação',
      duracaoTotal = '05:15:00',
      subprogramas = []
    } = config;

    const subsNormalizados = (subprogramas || []).map((sub, idx) => normalizarSubprograma(sub, idx + 1));

    return {
      isFaixa: true,
      tipoBloco: 'faixa',
      titulo: titulo.trim(),
      duracaoTotal,
      subprogramas: subsNormalizados
    };
  }

  function parseSubprogramasTexto(textoBruto = '') {
    if (!textoBruto || typeof textoBruto !== 'string') return [];
    const linhas = textoBruto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const resultado = [];

    for (const linha of linhas) {
      if (/^TV BRASIL ANIMADA/i.test(linha) || /^FAIXA/i.test(linha)) continue;

      let titulo = linha;
      let temporada = '';
      let episodio = '';

      const matchT = linha.match(/^(.*?)\s*-\s*(T\s*\d+(?:\s*\/\s*\d+)*)(.*)$/i);
      if (matchT) {
        titulo = matchT[1].trim();
        temporada = matchT[2].trim();
        const resto = matchT[3].trim();
        const matchEp = resto.match(/EP\s*(\d+)/i);
        if (matchEp) episodio = matchEp[1];
      }

      resultado.push(normalizarSubprograma({
        titulo,
        temporada,
        episodio,
        duracao: '00:15:00'
      }, resultado.length + 1));
    }

    return resultado;
  }

  function adicionarSubprograma(faixa, subprograma) {
    if (!faixa) return faixa;
    const subs = Array.isArray(faixa.subprogramas) ? [...faixa.subprogramas] : [];
    subs.push(normalizarSubprograma(subprograma, subs.length + 1));
    return {
      ...faixa,
      subprogramas: subs
    };
  }

  function substituirSubprograma(faixa, subprogramaId, novoSubprograma) {
    if (!faixa || !Array.isArray(faixa.subprogramas)) return faixa;
    const subs = faixa.subprogramas.map((s, idx) => {
      if (s.id === subprogramaId || s.titulo === subprogramaId) {
        return normalizarSubprograma({ ...novoSubprograma, id: s.id }, idx + 1);
      }
      return { ...s, ordem: idx + 1 };
    });
    return {
      ...faixa,
      subprogramas: subs
    };
  }

  function removerSubprograma(faixa, subprogramaId) {
    if (!faixa || !Array.isArray(faixa.subprogramas)) return faixa;
    const subs = faixa.subprogramas
      .filter(s => s.id !== subprogramaId && s.titulo !== subprogramaId)
      .map((s, idx) => ({ ...s, ordem: idx + 1 }));
    return {
      ...faixa,
      subprogramas: subs
    };
  }

  function reordenarSubprogramas(faixa, deIdx, paraIdx) {
    if (!faixa || !Array.isArray(faixa.subprogramas)) return faixa;
    const list = [...faixa.subprogramas];
    if (deIdx < 0 || deIdx >= list.length || paraIdx < 0 || paraIdx >= list.length) return faixa;
    const [item] = list.splice(deIdx, 1);
    list.splice(paraIdx, 0, item);
    return {
      ...faixa,
      subprogramas: list.map((s, i) => ({ ...s, ordem: i + 1 }))
    };
  }


  // =========================================================================
  // Etapa 3.1: Motor de Herança de Episódios Inéditos, Reprises e Blocos
  // =========================================================================

  function timeToSec(t) {
    if (!t) return 0;
    const parts = String(t).split(":").map(Number);
    if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
    return 0;
  }

  function secToTime(segundos = 0) {
    const s = Math.max(0, Math.floor(segundos));
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  }

  function normalizarBlocosEpisodio(blocos = [], duracaoTotal = "00:26:00", codigoBase = "") {
    if (Array.isArray(blocos) && blocos.length > 0) {
      return blocos.map((b, idx) => ({
        bloco: typeof b.bloco === "number" ? b.bloco : idx + 1,
        duracao: b.duracao ? String(b.duracao).trim() : "00:10:00",
        code: b.code ? String(b.code).trim() : (codigoBase ? `${codigoBase}_B${idx + 1}` : `B${idx + 1}`),
        titulo: b.titulo ? String(b.titulo).trim() : `Bloco ${idx + 1}`,
        midia: b.midia ? String(b.midia).trim() : "0OMN"
      }));
    }

    return [{
      bloco: 1,
      duracao: duracaoTotal || "00:26:00",
      code: codigoBase ? `${codigoBase}_B1` : "PROG_B1",
      titulo: "Bloco 1",
      midia: "0OMN"
    }];
  }

  function normalizarEpisodio(episodio = {}, configPadrao = {}) {
    if (!episodio || typeof episodio !== "object") {
      episodio = {};
    }

    const duracaoTotal = episodio.duracaoTotal || episodio.duracao || configPadrao.duracao || "00:26:00";
    const codigoBase = String(episodio.codigo || configPadrao.codigo || "").trim();

    return {
      id: episodio.id || `ep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      codigo: codigoBase,
      titulo: String(episodio.titulo || configPadrao.titulo || "Episódio Sem Título").trim(),
      temporada: episodio.temporada != null ? episodio.temporada : (configPadrao.temporada || null),
      episodioNumero: episodio.episodioNumero != null ? episodio.episodioNumero : (episodio.numero || configPadrao.episodioNumero || null),
      duracaoTotal,
      classificacaoIndicativa: episodio.classificacaoIndicativa || configPadrao.classificacaoIndicativa || "L",
      faixaOcupada: episodio.faixaOcupada || configPadrao.faixaOcupada || "",
      sinopse: episodio.sinopse || "",
      blocos: normalizarBlocosEpisodio(episodio.blocos, duracaoTotal, codigoBase)
    };
  }

  function vincularSlotReprise(slotReprise = {}, slotMestre = {}) {
    const vinculado = {
      ...slotReprise,
      tipoExibicao: TIPOS_SLOT.REPRISE,
      mestreSlotId: slotMestre.id || null,
      origemReprise: {
        diaSemana: Number(slotMestre.diaSemana != null ? slotMestre.diaSemana : 1),
        horario: String(slotMestre.horario || "").trim()
      },
      programaId: slotMestre.programaId || slotReprise.programaId || null,
      programaNome: slotMestre.programaNome || slotReprise.programaNome || "",
      classificacao: slotMestre.classificacao || slotReprise.classificacao || null,
      faixaOcupada: slotMestre.faixaOcupada || slotReprise.faixaOcupada || null
    };

    if (slotMestre.episodio) {
      vinculado.episodio = JSON.parse(JSON.stringify(slotMestre.episodio));
      vinculado.episodioHerdado = true;
    }

    return vinculado;
  }

  function iterarSlotsGrade(gradeSemana, callbackModificador) {
    if (!gradeSemana) return gradeSemana;

    if (Array.isArray(gradeSemana)) {
      return gradeSemana.map(callbackModificador);
    }

    if (gradeSemana.dias && Array.isArray(gradeSemana.dias)) {
      return {
        ...gradeSemana,
        dias: gradeSemana.dias.map(d => ({
          ...d,
          slots: Array.isArray(d.slots) ? d.slots.map(callbackModificador) : []
        }))
      };
    }

    const resultado = {};
    for (const [chave, slots] of Object.entries(gradeSemana)) {
      if (Array.isArray(slots)) {
        resultado[chave] = slots.map(callbackModificador);
      } else {
        resultado[chave] = slots;
      }
    }
    return resultado;
  }

  function coletarTodosSlots(gradeSemana) {
    if (!gradeSemana) return [];
    if (Array.isArray(gradeSemana)) return gradeSemana;
    if (gradeSemana.dias && Array.isArray(gradeSemana.dias)) {
      return gradeSemana.dias.flatMap(d => d.slots || []);
    }
    const todos = [];
    for (const slots of Object.values(gradeSemana)) {
      if (Array.isArray(slots)) {
        todos.push(...slots);
      }
    }
    return todos;
  }

  function propagarHerancaGradeSemana(gradeSemana) {
    const todosSlots = coletarTodosSlots(gradeSemana);

    const mestresPorId = new Map();
    const mestresPorOrigem = new Map();
    const mestresPorPrograma = new Map();

    for (const s of todosSlots) {
      if (s.tipoExibicao === TIPOS_SLOT.INEDITO) {
        if (s.id) mestresPorId.set(s.id, s);
        if (s.diaSemana != null && s.horario) {
          mestresPorOrigem.set(`${s.diaSemana}-${s.horario}`, s);
        }
        const progKey = s.programaId || s.programaNome;
        if (progKey && !mestresPorPrograma.has(progKey)) {
          mestresPorPrograma.set(progKey, s);
        }
      }
    }

    return iterarSlotsGrade(gradeSemana, (slot) => {
      if (slot.tipoExibicao !== TIPOS_SLOT.REPRISE) {
        return slot;
      }

      if (slot.bloquearHeranca) {
        return slot;
      }

      let mestre = null;
      if (slot.mestreSlotId && mestresPorId.has(slot.mestreSlotId)) {
        mestre = mestresPorId.get(slot.mestreSlotId);
      } else if (slot.origemReprise) {
        const chave = `${slot.origemReprise.diaSemana}-${slot.origemReprise.horario}`;
        if (mestresPorOrigem.has(chave)) {
          mestre = mestresPorOrigem.get(chave);
        }
      }

      if (!mestre) {
        const progKey = slot.programaId || slot.programaNome;
        if (progKey && mestresPorPrograma.has(progKey)) {
          mestre = mestresPorPrograma.get(progKey);
        }
      }

      if (!mestre) {
        return slot;
      }

      const slotAtualizado = {
        ...slot,
        isReprise: true,
        mestreSlotId: mestre.id,
        origemReprise: {
          diaSemana: Number(mestre.diaSemana != null ? mestre.diaSemana : 1),
          horario: String(mestre.horario || "").trim()
        },
        origemResumo: {
          diaSemana: mestre.diaSemana,
          horario: mestre.horario,
          programaNome: mestre.programaNome
        }
      };

      if (mestre.episodio) {
        slotAtualizado.episodio = JSON.parse(JSON.stringify(mestre.episodio));
        slotAtualizado.episodioHerdado = true;
      }

      if (mestre.classificacao && !slotAtualizado.classificacao) {
        slotAtualizado.classificacao = mestre.classificacao;
      }
      if (mestre.faixaOcupada && !slotAtualizado.faixaOcupada) {
        slotAtualizado.faixaOcupada = mestre.faixaOcupada;
      }

      return slotAtualizado;
    });
  }

  function atribuirEpisodioSlotMestre(gradeSemana, mestreSlotId, dadosEpisodio) {
    const epNormalizado = normalizarEpisodio(dadosEpisodio);

    const gradeComMestre = iterarSlotsGrade(gradeSemana, (slot) => {
      if (slot.id === mestreSlotId) {
        return {
          ...slot,
          tipoExibicao: TIPOS_SLOT.INEDITO,
          episodio: epNormalizado,
          classificacao: dadosEpisodio.classificacaoIndicativa || slot.classificacao || "L",
          faixaOcupada: dadosEpisodio.faixaOcupada || slot.faixaOcupada || ""
        };
      }
      return slot;
    });

    return propagarHerancaGradeSemana(gradeComMestre);
  }

  function desmembrarSlotEmItensRoteiro(slotResolvido, opcoes = {}) {
    if (!slotResolvido) return [];

    const duracaoBreak = opcoes.duracaoBreakPadrao || "00:03:00";
    const tipoPrograma = opcoes.tipoPrograma || "RPRO";
    const tipoBreak = opcoes.tipoBreak || "BREAK";
    const incluirBreaks = opcoes.incluirBreaks !== false;

    if (slotResolvido.episodio && Array.isArray(slotResolvido.episodio.blocos) && slotResolvido.episodio.blocos.length > 0) {
      const itens = [];
      const totalBlocos = slotResolvido.episodio.blocos.length;

      slotResolvido.episodio.blocos.forEach((b, idx) => {
        const numBloco = b.bloco || (idx + 1);
        itens.push({
          type: tipoPrograma,
          code: b.code || `${slotResolvido.episodio.codigo || "PROG"}_B${numBloco}`,
          midia: b.midia || "0OMN",
          tempo: b.duracao || "00:10:00",
          descricao: `${slotResolvido.programaNome || slotResolvido.episodio.titulo} - Bloco ${numBloco}`,
          bloco: numBloco,
          totalBlocos,
          programaId: slotResolvido.programaId || null,
          programaNome: slotResolvido.programaNome || "",
          temporada: slotResolvido.episodio.temporada || null,
          episodioNumero: slotResolvido.episodio.episodioNumero || null,
          isReprise: Boolean(slotResolvido.isReprise)
        });

        if (numBloco < totalBlocos && incluirBreaks) {
          itens.push({
            type: tipoBreak,
            code: `BREAK_${numBloco}`,
            midia: "0OMN",
            tempo: duracaoBreak,
            descricao: `Intervalo ${numBloco}`,
            ehBreak: true,
            numeroBreak: numBloco
          });
        }
      });

      return itens;
    }

    return [{
      type: tipoPrograma,
      code: slotResolvido.episodio?.codigo || slotResolvido.codigo || "PROG",
      midia: "0OMN",
      tempo: slotResolvido.episodio?.duracaoTotal || slotResolvido.duracao || "00:26:00",
      descricao: slotResolvido.programaNome || slotResolvido.episodio?.titulo || "Programa",
      bloco: 1,
      totalBlocos: 1,
      programaId: slotResolvido.programaId || null,
      programaNome: slotResolvido.programaNome || "",
      temporada: slotResolvido.episodio?.temporada || null,
      episodioNumero: slotResolvido.episodio?.episodioNumero || null,
      isReprise: Boolean(slotResolvido.isReprise)
    }];
  }

  function validarConsistenciaReprises(gradeSemana) {
    const todosSlots = coletarTodosSlots(gradeSemana);
    const mestresPorId = new Map();
    const mestresPorOrigem = new Map();
    const mestresPorPrograma = new Map();

    let totalIneditos = 0;
    let totalReprises = 0;
    let totalFixos = 0;
    let ineditosComEpisodio = 0;
    let reprisesVinculadas = 0;
    let reprisesComEpisodio = 0;

    for (const s of todosSlots) {
      if (s.tipoExibicao === TIPOS_SLOT.INEDITO) {
        totalIneditos++;
        if (s.episodio) ineditosComEpisodio++;
        if (s.id) mestresPorId.set(s.id, s);
        if (s.diaSemana != null && s.horario) {
          mestresPorOrigem.set(`${s.diaSemana}-${s.horario}`, s);
        }
        const progKey = s.programaId || s.programaNome;
        if (progKey && !mestresPorPrograma.has(progKey)) {
          mestresPorPrograma.set(progKey, s);
        }
      } else if (s.tipoExibicao === TIPOS_SLOT.REPRISE) {
        totalReprises++;
      } else {
        totalFixos++;
      }
    }

    const erros = [];
    const alertas = [];

    for (const rep of todosSlots) {
      if (rep.tipoExibicao !== TIPOS_SLOT.REPRISE) continue;

      let mestre = null;
      if (rep.mestreSlotId && mestresPorId.has(rep.mestreSlotId)) {
        mestre = mestresPorId.get(rep.mestreSlotId);
      } else if (rep.origemReprise) {
        const chave = `${rep.origemReprise.diaSemana}-${rep.origemReprise.horario}`;
        if (mestresPorOrigem.has(chave)) {
          mestre = mestresPorOrigem.get(chave);
        }
      }

      if (!mestre) {
        const progKey = rep.programaId || rep.programaNome;
        if (progKey && mestresPorPrograma.has(progKey)) {
          mestre = mestresPorPrograma.get(progKey);
        }
      }

      if (!mestre) {
        erros.push({
          tipo: "reprise_sem_mestre",
          slotId: rep.id,
          programaNome: rep.programaNome,
          horario: rep.horario,
          diaSemana: rep.diaSemana,
          mensagem: `Reprise "${rep.programaNome || rep.id}" não possui slot inédito mestre correspondente na semana.`
        });
      } else {
        reprisesVinculadas++;
        if (rep.episodio || mestre.episodio) {
          reprisesComEpisodio++;
        }

        // Checagem de cronologia (aviso se reprise precede mestre)
        if (rep.diaSemana != null && mestre.diaSemana != null) {
          const normRep = rep.diaSemana === 0 ? 7 : Number(rep.diaSemana);
          const normMestre = mestre.diaSemana === 0 ? 7 : Number(mestre.diaSemana);
          const horaRepSec = timeToSec(rep.horario);
          const horaMestreSec = timeToSec(mestre.horario);

          if (normRep < normMestre || (normRep === normMestre && horaRepSec < horaMestreSec)) {
            alertas.push({
              tipo: "reprise_precede_inedito",
              slotId: rep.id,
              mestreSlotId: mestre.id,
              mensagem: `A reprise de "${rep.programaNome || rep.id}" está agendada antes da estreia inédita na semana.`
            });
          }
        }
      }
    }

    return {
      valido: erros.length === 0,
      erros,
      alertas,
      estatisticas: {
        totalSlots: todosSlots.length,
        totalIneditos,
        totalReprises,
        totalFixos,
        reprisesVinculadas,
        reprisesComEpisodio,
        ineditosComEpisodio
      }
    };
  }

  return {
    TIPOS_SLOT,
    TIPOS_EXCECAO,
    CLASSIFICACOES,
    detectarClassificacao,
    criarFaixaComposta,
    normalizarSubprograma,
    parseSubprogramasTexto,
    adicionarSubprograma,
    substituirSubprograma,
    removerSubprograma,
    reordenarSubprogramas,
    criarSlotRecorrente,
    adicionarEpisodioFila,
    ordenarFila,
    obterProximoEpisodio,
    cadastrarExcecao,
    removerExcecao,
    obterExcecao,
    resolverGradeDoDia,
    resolverGradeSemana,
    // Etapa 3.1: Herança de Inéditos e Reprises
    timeToSec,
    secToTime,
    normalizarBlocosEpisodio,
    normalizarEpisodio,
    vincularSlotReprise,
    propagarHerancaGradeSemana,
    atribuirEpisodioSlotMestre,
    desmembrarSlotEmItensRoteiro,
    validarConsistenciaReprises
  };
});

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

  return {
    TIPOS_SLOT,
    TIPOS_EXCECAO,
    criarSlotRecorrente,
    adicionarEpisodioFila,
    ordenarFila,
    obterProximoEpisodio,
    cadastrarExcecao,
    removerExcecao,
    obterExcecao,
    resolverGradeDoDia,
    resolverGradeSemana
  };
});

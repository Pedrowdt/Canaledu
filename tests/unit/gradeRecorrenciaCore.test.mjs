import { describe, it, expect } from 'vitest';
import GradeRecorrenciaCore from '../../src/core/gradeRecorrenciaCore.js';

describe('GradeRecorrenciaCore — Regras de Recorrência, Reprises e Exceções por Data', () => {
  const {
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
  } = GradeRecorrenciaCore;

  describe('Criação e Normalização de Slots', () => {
    it('cria slot de exibição inédita padrão', () => {
      const slot = criarSlotRecorrente({
        diaSemana: 1, // Segunda
        horario: '08:00:00',
        programaNome: 'Programa A',
        tipoExibicao: TIPOS_SLOT.INEDITO
      });

      expect(slot.diaSemana).toBe(1);
      expect(slot.horario).toBe('08:00:00');
      expect(slot.tipoExibicao).toBe('inedito');
      expect(slot.origemReprise).toBeNull();
    });

    it('cria slot de reprise vinculado a um horário inédito de origem', () => {
      const slot = criarSlotRecorrente({
        diaSemana: 3, // Quarta
        horario: '12:00:00',
        programaNome: 'Programa A',
        tipoExibicao: TIPOS_SLOT.REPRISE,
        origemReprise: { diaSemana: 1, horario: '08:00:00' }
      });

      expect(slot.diaSemana).toBe(3);
      expect(slot.horario).toBe('12:00:00');
      expect(slot.tipoExibicao).toBe('reprise');
      expect(slot.origemReprise).toEqual({ diaSemana: 1, horario: '08:00:00' });
    });
  });

  describe('Fila de Episódios com Títulos Arbitrários', () => {
    it('suporta episódios sem numeração serial explícita (títulos temáticos)', () => {
      let fila = [];
      fila = adicionarEpisodioFila(fila, {
        id: 'ep-01',
        titulo: '7 de Setembro — Dia da Independência',
        codigo: 'IND_01',
        ordem: 1
      });
      fila = adicionarEpisodioFila(fila, {
        id: 'ep-02',
        titulo: 'Especial Semana da Criança',
        codigo: 'CRI_02',
        ordem: 2
      });
      fila = adicionarEpisodioFila(fila, {
        id: 'ep-03',
        titulo: 'Preservação da Amazônia e Clima',
        codigo: 'AMZ_03',
        ordem: 3
      });

      expect(fila).toHaveLength(3);
      expect(fila[0].titulo).toBe('7 de Setembro — Dia da Independência');
      expect(fila[1].titulo).toBe('Especial Semana da Criança');
      expect(fila[2].titulo).toBe('Preservação da Amazônia e Clima');
    });

    it('permite reordenar a fila mantendo a sequência de exibição', () => {
      const filaDesordenada = [
        { id: 'ep-b', titulo: 'Segundo', ordem: 2 },
        { id: 'ep-a', titulo: 'Primeiro', ordem: 1 },
        { id: 'ep-c', titulo: 'Terceiro', ordem: 3 }
      ];
      const ordenados = ordenarFila(filaDesordenada);
      expect(ordenados[0].titulo).toBe('Primeiro');
      expect(ordenados[1].titulo).toBe('Segundo');
      expect(ordenados[2].titulo).toBe('Terceiro');
    });
  });

  describe('Resolução Semanal: Inédito na Segunda, Reprise na Quarta', () => {
    const filaProgramaA = [
      { id: 'ep-1', codigo: 'PROGA_01', titulo: 'Episódio Piloto', ordem: 1 },
      { id: 'ep-2', codigo: 'PROGA_02', titulo: 'Segunda Aventura', ordem: 2 },
      { id: 'ep-3', codigo: 'PROGA_03', titulo: 'Desafio Final', ordem: 3 }
    ];

    const gradeBasePorDia = {
      // Segunda-feira (1): Inédito às 08:00
      1: [
        criarSlotRecorrente({
          diaSemana: 1,
          horario: '08:00:00',
          programaNome: 'Programa A',
          tipoExibicao: TIPOS_SLOT.INEDITO
        })
      ],
      // Quarta-feira (3): Reprise às 12:00 vinculada à Segunda 08:00
      3: [
        criarSlotRecorrente({
          diaSemana: 3,
          horario: '12:00:00',
          programaNome: 'Programa A',
          tipoExibicao: TIPOS_SLOT.REPRISE,
          origemReprise: { diaSemana: 1, horario: '08:00:00' }
        })
      ]
    };

    it('exibe o mesmo episódio na reprise da quarta-feira que passou na segunda', () => {
      const resultadoSemana1 = resolverGradeSemana({
        dataInicio: '2026-11-02', // Segunda-feira
        diasSemana: [1, 3],
        gradeBasePorDia,
        filasPorPrograma: { 'Programa A': filaProgramaA },
        cursoresIniciais: { 'Programa A': 0 }
      });

      const diaSegunda = resultadoSemana1.dias.find(d => d.diaSemana === 1);
      const diaQuarta = resultadoSemana1.dias.find(d => d.diaSemana === 3);

      expect(diaSegunda.slots[0].episodio.titulo).toBe('Episódio Piloto');
      expect(diaSegunda.slots[0].isReprise).toBe(false);

      // A quarta-feira precisa ter espelhado EXATAMENTE o mesmo episódio da segunda
      expect(diaQuarta.slots[0].episodio.titulo).toBe('Episódio Piloto');
      expect(diaQuarta.slots[0].isReprise).toBe(true);
      expect(diaQuarta.slots[0].origemReprise).toEqual({ diaSemana: 1, horario: '08:00:00' });
    });

    it('avança para o próximo episódio na semana seguinte, mantendo o espelho na reprise', () => {
      // Semana 1 executada com cursor inicial 0 -> final 1
      const resultadoSemana1 = resolverGradeSemana({
        dataInicio: '2026-11-02',
        diasSemana: [1, 3],
        gradeBasePorDia,
        filasPorPrograma: { 'Programa A': filaProgramaA },
        cursoresIniciais: { 'Programa A': 0 }
      });

      expect(resultadoSemana1.cursoresFinais['Programa A']).toBe(1);

      // Semana 2 inicia com cursor 1
      const resultadoSemana2 = resolverGradeSemana({
        dataInicio: '2026-11-09',
        diasSemana: [1, 3],
        gradeBasePorDia,
        filasPorPrograma: { 'Programa A': filaProgramaA },
        cursoresIniciais: resultadoSemana1.cursoresFinais
      });

      const diaSegunda2 = resultadoSemana2.dias.find(d => d.diaSemana === 1);
      const diaQuarta2 = resultadoSemana2.dias.find(d => d.diaSemana === 3);

      expect(diaSegunda2.slots[0].episodio.titulo).toBe('Segunda Aventura');
      expect(diaQuarta2.slots[0].episodio.titulo).toBe('Segunda Aventura');
      expect(diaQuarta2.slots[0].isReprise).toBe(true);
    });

    it('suporta múltiplos pares independentes (Seg/Qua com Ep 01 e Ter/Qui com Ep 02)', () => {
      const gradeSemanalAmpla = {
        1: [criarSlotRecorrente({ diaSemana: 1, horario: '08:00:00', programaNome: 'Programa A', tipoExibicao: 'inedito' })],
        2: [criarSlotRecorrente({ diaSemana: 2, horario: '08:00:00', programaNome: 'Programa A', tipoExibicao: 'inedito' })],
        3: [criarSlotRecorrente({ diaSemana: 3, horario: '12:00:00', programaNome: 'Programa A', tipoExibicao: 'reprise', origemReprise: { diaSemana: 1, horario: '08:00:00' } })],
        4: [criarSlotRecorrente({ diaSemana: 4, horario: '12:00:00', programaNome: 'Programa A', tipoExibicao: 'reprise', origemReprise: { diaSemana: 2, horario: '08:00:00' } })]
      };

      const resultado = resolverGradeSemana({
        dataInicio: '2026-11-02',
        diasSemana: [1, 2, 3, 4],
        gradeBasePorDia: gradeSemanalAmpla,
        filasPorPrograma: { 'Programa A': filaProgramaA },
        cursoresIniciais: { 'Programa A': 0 }
      });

      const seg = resultado.dias.find(d => d.diaSemana === 1).slots[0];
      const ter = resultado.dias.find(d => d.diaSemana === 2).slots[0];
      const qua = resultado.dias.find(d => d.diaSemana === 3).slots[0];
      const qui = resultado.dias.find(d => d.diaSemana === 4).slots[0];

      // Segunda e Terça foram inéditos e consumiram sequencialmente
      expect(seg.episodio.titulo).toBe('Episódio Piloto');
      expect(ter.episodio.titulo).toBe('Segunda Aventura');

      // Quarta reprisou a Segunda
      expect(qua.episodio.titulo).toBe('Episódio Piloto');
      expect(qua.isReprise).toBe(true);

      // Quinta reprisou a Terça
      expect(qui.episodio.titulo).toBe('Segunda Aventura');
      expect(qui.isReprise).toBe(true);
    });
  });

  describe('Exceções por Data Específica (Overrides sem alterar regra semanal)', () => {
    const filaProgramaA = [
      { id: 'ep-1', codigo: 'PROGA_01', titulo: 'Episódio Regular 01', ordem: 1 },
      { id: 'ep-2', codigo: 'PROGA_02', titulo: 'Episódio Regular 02', ordem: 2 }
    ];

    const gradeBasePorDia = {
      1: [criarSlotRecorrente({ diaSemana: 1, horario: '08:00:00', programaNome: 'Programa A', tipoExibicao: 'inedito' })],
      3: [criarSlotRecorrente({ diaSemana: 3, horario: '12:00:00', programaNome: 'Programa A', tipoExibicao: 'reprise', origemReprise: { diaSemana: 1, horario: '08:00:00' } })]
    };

    it('troca o episódio de uma reprise pontual sem alterar a grade base', () => {
      // Cadastra exceção SOMENTE para Quarta-feira 2026-11-04 às 12:00:00
      let excecoes = {};
      excecoes = cadastrarExcecao(excecoes, {
        data: '2026-11-04',
        horario: '12:00:00',
        tipoExcecao: TIPOS_EXCECAO.SUBSTITUIR_EPISODIO,
        episodioTitulo: 'Especial Quarta-Feira de Cinzas',
        motivo: 'Programação temática de feriado',
        avancarFila: false
      });

      expect(obterExcecao(excecoes, '2026-11-04', '12:00:00')).toBeTruthy();
      expect(obterExcecao(excecoes, '2026-11-11', '12:00:00')).toBeNull();

      // Resolve a Semana 1 (com a data de exceção 04/11)
      const resSemana1 = resolverGradeSemana({
        dataInicio: '2026-11-02',
        diasSemana: [1, 3],
        gradeBasePorDia,
        filasPorPrograma: { 'Programa A': filaProgramaA },
        cursoresIniciais: { 'Programa A': 0 },
        excecoesPorData: excecoes
      });

      const seg1 = resSemana1.dias.find(d => d.diaSemana === 1).slots[0];
      const qua1 = resSemana1.dias.find(d => d.diaSemana === 3).slots[0];

      expect(seg1.episodio.titulo).toBe('Episódio Regular 01');
      expect(seg1.isExcecao).toBe(false);

      // A Quarta recebeu o episódio da exceção pontual
      expect(qua1.episodio.titulo).toBe('Especial Quarta-Feira de Cinzas');
      expect(qua1.isExcecao).toBe(true);
      expect(qua1.motivoExcecao).toBe('Programação temática de feriado');

      // A regra semanal base continua intacta!
      expect(gradeBasePorDia[3][0].tipoExibicao).toBe('reprise');
      expect(gradeBasePorDia[3][0].origemReprise).toEqual({ diaSemana: 1, horario: '08:00:00' });

      // Na Semana 2 (sem exceção cadastrada para 11/11), a Quarta volta à regra normal
      const resSemana2 = resolverGradeSemana({
        dataInicio: '2026-11-09',
        diasSemana: [1, 3],
        gradeBasePorDia,
        filasPorPrograma: { 'Programa A': filaProgramaA },
        cursoresIniciais: resSemana1.cursoresFinais,
        excecoesPorData: excecoes // O mapa continua tendo apenas a exceção de 04/11
      });

      const seg2 = resSemana2.dias.find(d => d.diaSemana === 1).slots[0];
      const qua2 = resSemana2.dias.find(d => d.diaSemana === 3).slots[0];

      expect(seg2.episodio.titulo).toBe('Episódio Regular 02');
      expect(qua2.episodio.titulo).toBe('Episódio Regular 02'); // Espelhou a segunda normalmente!
      expect(qua2.isExcecao).toBe(false);
    });

    it('substitui o programa inteiro em caso de transmissão especial ou cobertura ao vivo', () => {
      let excecoes = {};
      excecoes = cadastrarExcecao(excecoes, {
        data: '2026-11-02',
        horario: '08:00:00',
        tipoExcecao: TIPOS_EXCECAO.SUBSTITUIR_PROGRAMA,
        programaNome: 'Debate Eleitoral Ao Vivo',
        episodioTitulo: 'Bloco Especial de Abertura',
        motivo: 'Cobertura Eleições',
        avancarFila: false
      });

      const res = resolverGradeDoDia({
        data: '2026-11-02',
        diaSemana: 1,
        slotsGradeBase: gradeBasePorDia[1],
        filasPorPrograma: { 'Programa A': filaProgramaA },
        cursoresProgramas: { 'Programa A': 0 },
        excecoesPorData: excecoes
      });

      const slot = res.slots[0];
      expect(slot.isExcecao).toBe(true);
      expect(slot.programaNome).toBe('Debate Eleitoral Ao Vivo');
      expect(slot.motivoExcecao).toBe('Cobertura Eleições');
      // Não avançou o cursor do Programa A porque a exibição regular não ocorreu
      expect(res.cursoresAtualizados['Programa A']).toBe(0);
    });

    it('remover a exceção restaura imediatamente a programação base', () => {
      let excecoes = {};
      excecoes = cadastrarExcecao(excecoes, {
        data: '2026-11-04',
        horario: '12:00:00',
        tipoExcecao: TIPOS_EXCECAO.SUBSTITUIR_EPISODIO,
        episodioTitulo: 'Especial Cancelado'
      });
      expect(obterExcecao(excecoes, '2026-11-04', '12:00:00')).toBeTruthy();

      excecoes = removerExcecao(excecoes, '2026-11-04', '12:00:00');
      expect(obterExcecao(excecoes, '2026-11-04', '12:00:00')).toBeNull();
    });
  });
});

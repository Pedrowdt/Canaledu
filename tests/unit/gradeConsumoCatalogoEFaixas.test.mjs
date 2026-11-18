import { describe, it, expect } from 'vitest';
import GradeEditorCore from '../../src/core/gradeEditorCore.js';

describe('GradeEditorCore — Consumo do Catálogo de Programas e Vinculação de Faixas (15 min)', () => {
  const {
    generateBaseSlots,
    assignProgramToSlot,
    gradeToBlocks,
    vincularFaixaIntervalo,
    timeToSec,
    secToTime,
  } = GradeEditorCore;

  describe('Atribuição de programas do catálogo com metadados ricos e Faixa Ocupada', () => {
    it('preserva faixaOcupada, type, code, temporada e episodio ao atribuir programa ao slot', () => {
      const slots = generateBaseSlots(6, 15); // slots de 15 minutos
      const programaCatalogo = {
        title: 'MUNDO BITA',
        code: 'BITA_001',
        tempo: '00:15:00',
        categoria: 'Infantil',
        type: 'RPRO',
        faixaOcupada: 'TV Brasil Animada',
        temporada: 'T 09',
        episodio: 'EP 05',
        bloco: 1
      };

      const atualizado = assignProgramToSlot(slots, 6, programaCatalogo, { adoptDuration: false });
      const slotAlvo = atualizado[6];

      expect(slotAlvo.program).toBeDefined();
      expect(slotAlvo.program.title).toBe('MUNDO BITA');
      expect(slotAlvo.program.code).toBe('BITA_001');
      expect(slotAlvo.program.type).toBe('RPRO');
      expect(slotAlvo.program.faixaOcupada).toBe('TV Brasil Animada');
      expect(slotAlvo.program.faixaNome).toBe('TV Brasil Animada');
      expect(slotAlvo.program.temporada).toBe('T 09');
      expect(slotAlvo.program.episodio).toBe('EP 05');
      expect(slotAlvo.faixaNome).toBe('TV Brasil Animada');
    });

    it('gradeToBlocks resolve metadados do catálogo associando faixaOcupada automaticamente', () => {
      const catalogo = [
        {
          descricao: 'SEM CENSURA',
          code: 'SMC_100',
          tempo: '02:00:00',
          categoria: 'Jornalismo',
          faixaOcupada: 'Tarde Ao Vivo',
          type: 'LIVE'
        }
      ];

      const gradeObj = {
        'SEM CENSURA': '16:00:00'
      };

      const blocks = gradeToBlocks(gradeObj, ['SEM CENSURA'], catalogo);
      const bloco = blocks.find(b => b.program && b.program.title === 'SEM CENSURA');

      expect(bloco).toBeDefined();
      expect(bloco.program.code).toBe('SMC_100');
      expect(bloco.program.faixaOcupada).toBe('Tarde Ao Vivo');
      expect(bloco.faixaNome).toBe('Tarde Ao Vivo');
      expect(bloco.program.type).toBe('LIVE');
    });
  });

  describe('vincularFaixaIntervalo — slots de 15 minutos dedicados a uma faixa', () => {
    it('divide um intervalo em slots exatos de 15 minutos com faixaNome associado', () => {
      const baseSlots = generateBaseSlots(6, 30); // Grade base de 30 min (48 slots)

      // Vincula a faixa TV Brasil Animada das 07:30 às 12:15 (4h45m = 19 slots de 15 min)
      const resultado = vincularFaixaIntervalo(baseSlots, {
        faixaNome: 'TV Brasil Animada',
        inicio: '07:30:00',
        fim: '12:15:00',
        duracaoSlotSec: 900,
        classificacao: 'licenciado'
      });

      const slotsFaixa = resultado.filter(s => s.faixaNome === 'TV Brasil Animada');
      expect(slotsFaixa.length).toBe(19);

      // Primeiro slot da faixa começa às 07:30:00 com 15 min de duração
      expect(slotsFaixa[0].time).toBe('07:30:00');
      expect(slotsFaixa[0].duration).toBe('00:15:00');
      expect(slotsFaixa[0].endTime).toBe('07:45:00');

      // Último slot da faixa termina exatamente às 12:15:00
      const ultimoSlotFaixa = slotsFaixa[18];
      expect(ultimoSlotFaixa.time).toBe('12:00:00');
      expect(ultimoSlotFaixa.duration).toBe('00:15:00');
      expect(ultimoSlotFaixa.endTime).toBe('12:15:00');

      // O slot seguinte começa exatamente às 12:15:00
      const proximoSlot = resultado[resultado.indexOf(ultimoSlotFaixa) + 1];
      expect(proximoSlot).toBeDefined();
      expect(proximoSlot.time).toBe('12:15:00');
    });

    it('preenche automaticamente os slots de 15 minutos com os programas cadastrados da faixa', () => {
      const baseSlots = generateBaseSlots(6, 30);
      const programasInfantis = [
        { title: 'ESSE E O BICHO', code: 'DES_01', tempo: '00:15:00', faixaOcupada: 'TV Brasil Animada' },
        { title: 'LIA PEDRO E O MINIMUNDO', code: 'DES_02', tempo: '00:15:00', faixaOcupada: 'TV Brasil Animada' },
        { title: 'MUNDO BITA', code: 'DES_03', tempo: '00:15:00', faixaOcupada: 'TV Brasil Animada' },
      ];

      const resultado = vincularFaixaIntervalo(baseSlots, {
        faixaNome: 'TV Brasil Animada',
        inicio: '07:30:00',
        fim: '08:15:00', // 45 minutos = 3 slots de 15 min
        duracaoSlotSec: 900,
        programasFaixa: programasInfantis,
        classificacao: 'licenciado'
      });

      const slotsFaixa = resultado.filter(s => s.faixaNome === 'TV Brasil Animada');
      expect(slotsFaixa.length).toBe(3);

      expect(slotsFaixa[0].program.title).toBe('ESSE E O BICHO');
      expect(slotsFaixa[0].program.code).toBe('DES_01');
      expect(slotsFaixa[0].time).toBe('07:30:00');

      expect(slotsFaixa[1].program.title).toBe('LIA PEDRO E O MINIMUNDO');
      expect(slotsFaixa[1].program.code).toBe('DES_02');
      expect(slotsFaixa[1].time).toBe('07:45:00');

      expect(slotsFaixa[2].program.title).toBe('MUNDO BITA');
      expect(slotsFaixa[2].program.code).toBe('DES_03');
      expect(slotsFaixa[2].time).toBe('08:00:00');
    });

    it('retorna a lista inalterada se faixaNome, início ou fim forem inválidos', () => {
      const baseSlots = generateBaseSlots(6, 30);
      const res = vincularFaixaIntervalo(baseSlots, { faixaNome: '', inicio: '07:30:00', fim: '12:00:00' });
      expect(res).toBe(baseSlots);
    });
  });
});

import { describe, it, expect } from 'vitest';
import BreakDistributor from '../../src/core/breakDistributor.js';

const { distribuirPecasNosBreaks, findCombinationForDuration, isValidadeExpired, extractTheme } = BreakDistributor;

describe('breakDistributor v2', () => {
  it('valida expiração de validade corretamente', () => {
    expect(isValidadeExpired('01/01/2020')).toBe(true);
    expect(isValidadeExpired('31/12/2099')).toBe(false);
    expect(isValidadeExpired('')).toBe(false);
  });

  it('extrai tema do programa relacionado ou título', () => {
    expect(extractTheme({ programaRelacionado: 'MASSINHAS' })).toBe('MASSINHAS');
    expect(extractTheme({ descricao: 'CHAMADA MASSINHAS - T01 EP02' })).toBe('MASSINHAS');
  });

  it('evita colocar peças com mesmo tema adjacentes quando anti-adjacência está ativa', () => {
    const roteiro = [
      { type: 'PGM', descricao: 'PGM MASSINHAS - T 01 EP 01', tempo: '00:15:00' },
      { type: '__SLOT__', descricao: '[ BREAK — chamada ]', tempo: '00:00:30' },
      { type: '__SLOT__', descricao: '[ BREAK — chamada ]', tempo: '00:00:30' }
    ];

    const pecas = [
      { code: '101', type: 'ECHM', descricao: 'CHAMADA MASSINHAS', programaRelacionado: 'MASSINHAS', tempo: '00:00:30', ativo: true },
      { code: '102', type: 'ECHM', descricao: 'CHAMADA CONTA A VIRADA', programaRelacionado: 'CONTA A VIRADA', tempo: '00:00:30', ativo: true }
    ];

    const res = distribuirPecasNosBreaks(roteiro, pecas, {
      regras: { breakAntiAdjacenciaTema: true, breakIntervaloMinChamada: 0 }
    });

    // Como o programa anterior é MASSINHAS, o primeiro slot de chamada não deve ser MASSINHAS
    expect(res.roteiro[1].code).toBe('102');
  });

  it('encontra combinação exata para preencher um gap', () => {
    const pecas = [
      { code: 'P1', tempo: '00:01:00', type: 'ECHM', ativo: true },
      { code: 'P2', tempo: '00:00:30', type: 'ECHM', ativo: true },
      { code: 'P3', tempo: '00:00:15', type: 'ECHM', ativo: true }
    ];

    const combo = findCombinationForDuration(pecas, 75);
    expect(combo).toHaveLength(2);
    expect(combo.map(p => p.code).sort()).toEqual(['P1', 'P3']);
  });

  it('respeita os dias da semana permitidos da peça e normaliza acentos (ex: sáb)', () => {
    const roteiro = [
      { type: 'PGM', descricao: 'PGM CIENCIA', tempo: '00:15:00' },
      { type: '__SLOT__', descricao: '[ BREAK — chamada ]', tempo: '00:00:30' }
    ];

    const pecas = [
      // Peça configurada apenas para sábado com acento 'sáb'
      { code: 'SAB01', type: 'ECHM', descricao: 'CHAMADA SABADO', tempo: '00:00:30', dias: ['sáb'], ativo: true },
      // Peça configurada apenas para quarta 'qua'
      { code: 'QUA01', type: 'ECHM', descricao: 'CHAMADA QUARTA', tempo: '00:00:30', dias: ['qua'], ativo: true }
    ];

    // Simula execução na quarta-feira (dow = 3)
    const resQua = distribuirPecasNosBreaks(roteiro, pecas, {
      dow: 3,
      regras: { breakIntervaloMinChamada: 0 }
    });
    expect(resQua.roteiro[1].code).toBe('QUA01');

    // Simula execução no sábado (dow = 6)
    const resSab = distribuirPecasNosBreaks(roteiro, pecas, {
      dow: 6,
      regras: { breakIntervaloMinChamada: 0 }
    });
    expect(resSab.roteiro[1].code).toBe('SAB01');

    // Simula execução na segunda-feira (dow = 1) -> nenhuma elegível
    const resSeg = distribuirPecasNosBreaks(roteiro, pecas, {
      dow: 1,
      regras: { breakIntervaloMinChamada: 0 }
    });
    expect(resSeg.resultado.totalAlocado).toBe(0);
  });

});

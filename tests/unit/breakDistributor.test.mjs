import { describe, it, expect } from 'vitest';
import BreakDistributor from '../../src/core/breakDistributor.js';

const { distribuirPecasNosBreaks, findCombinationForDuration, isValidadeExpired, extractTheme } = BreakDistributor;

describe('breakDistributor v2', () => {
  it('valida expiração de validade corretamente', () => {
    expect(isValidadeExpired('01/01/2020')).toBe(true);
    expect(isValidadeExpired('31/12/2099')).toBe(false);
    expect(isValidadeExpired('')).toBe(false);
  });
    it('prioriza chamada de estreia de hoje em relação a chamada de 3 dias depois', () => {
    const roteiro = [
      { type: 'PGM', descricao: 'PGM CIENCIA', tempo: '00:15:00' },
      { type: '__SLOT__', descricao: '[ BREAK — chamada ]', tempo: '00:00:30' }
    ];
    const pecas = [
      {
        code: 'CHM_3DIAS',
        type: 'ECHM',
        descricao: 'CHAMADA DAQUI A 3 DIAS',
        tipoFinalidade: 'estreia',
        dataEstreia: '30/10/2026',
        tempo: '00:00:30',
        ativo: true
      },
      {
        code: 'CHM_HOJE',
        type: 'ECHM',
        descricao: 'CHAMADA ESTREIA HOJE',
        tipoFinalidade: 'estreia',
        dataEstreia: '27/10/2026',
        tempo: '00:00:30',
        ativo: true
      }
    ];

    const res = BreakDistributor.distribuirPecasNosBreaks(roteiro, pecas, {
      date: '27/10/2026',
      regras: { breakIntervaloMinChamada: 0 }
    });

    expect(res.roteiro[1].code).toBe('CHM_HOJE');
  });

  it('prioriza interprograma promocional sobre calhau quando ambos empatam em exibições', () => {
    const roteiro = [
      { type: 'PGM', descricao: 'PGM HISTORIA', tempo: '00:15:00' },
      { type: '__SLOT__', descricao: '[ BREAK — interprograma ]', tempo: '00:01:00' }
    ];
    const pecas = [
      {
        code: 'INT_CALHAU',
        type: 'EINT',
        descricao: 'INTERPROGRAMA CALHAU',
        tipoFinalidade: 'calhau',
        tempo: '00:01:00',
        ativo: true
      },
      {
        code: 'INT_PROMO',
        type: 'EINT',
        descricao: 'INTERPROGRAMA PROMOCIONAL',
        tipoFinalidade: 'promocional',
        tempo: '00:01:00',
        ativo: true
      }
    ];

    const res = BreakDistributor.distribuirPecasNosBreaks(roteiro, pecas, {
      date: '27/10/2026',
      regras: { breakIntervaloMinInterprograma: 0 }
    });

    expect(res.roteiro[1].code).toBe('INT_PROMO');
  });

  it('rotatividade: reduz score com exibições acumuladas para dar oportunidade a outras peças', () => {
    const p1 = { code: 'P1', tipoFinalidade: 'promocional' }; // base 7
    const p2 = { code: 'P2', tipoFinalidade: 'calhau' };      // base 5

    // Sem exibição: P1 (7) ganha de P2 (5)
    expect(BreakDistributor.calcularScorePeca(p1, '27/10/2026', 0)).toBe(7);
    expect(BreakDistributor.calcularScorePeca(p2, '27/10/2026', 0)).toBe(5);

    // Após 1 exibição de P1: score cai para 7 - 3 = 4, logo P2 (5) assume a vez!
    expect(BreakDistributor.calcularScorePeca(p1, '27/10/2026', 1)).toBe(4);
    expect(BreakDistributor.calcularScorePeca(p1, '27/10/2026', 1)).toBeLessThan(
      BreakDistributor.calcularScorePeca(p2, '27/10/2026', 0)
    );
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

  it("executa instantaneamente sem travar a thread mesmo com centenas de pecas e sem combinacao exata", () => {
    const durs = ["00:00:15", "00:00:30", "00:00:45", "00:01:00", "00:02:00"];
    const pecas = [];
    for (let i = 0; i < 500; i++) {
      pecas.push({ code: "P" + i, tempo: durs[i % durs.length], type: "ECHM", ativo: true });
    }
    const t0 = performance.now();
    const combo = findCombinationForDuration(pecas, 173);
    const elapsed = performance.now() - t0;
    expect(combo).toBeNull();
    expect(elapsed).toBeLessThan(50);
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

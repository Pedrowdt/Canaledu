import { describe, it, expect } from 'vitest';
import { distribuirPecasNosBreaks, findCombinationForDuration, isValidadeExpired } from '../../src/core/breakDistributor.js';

describe('breakDistributor', () => {
  it('valida expiração de validade corretamente', () => {
    expect(isValidadeExpired('01/01/2020')).toBe(true);
    expect(isValidadeExpired('31/12/2099')).toBe(false);
    expect(isValidadeExpired('')).toBe(false);
  });

  it('encontra combinação exata para preencher um gap', () => {
    const pecas = [
      { code: 'P1', tempo: '00:00:30' },
      { code: 'P2', tempo: '00:01:30' },
      { code: 'P3', tempo: '00:01:00' }
    ];
    // gap de 02:00 (120s) -> P1 (30s) + P2 (90s)
    const combo = findCombinationForDuration(pecas, 120, 2);
    expect(combo).toHaveLength(2);
    expect(combo.map(p => p.code)).toEqual(['P1', 'P2']);
  });

  it('preenche slots de chamada e interprograma com rotação equilibrada e respeitando antifadiga', () => {
    const roteiro = [
      { code: '100', descricao: 'PGM A', tempo: '00:10:00', type: 'RPRO' },
      { code: '__BREAK__', descricao: '[ BREAK — chamada ]', tempo: '00:00:00', type: '__SLOT__' },
      { code: '__BREAK__', descricao: '[ BREAK — interprograma ]', tempo: '00:00:00', type: '__SLOT__' },
      { code: '101', descricao: 'PGM B', tempo: '00:10:00', type: 'RPRO' }
    ];

    const pecas = [
      { code: 'CH1', descricao: 'Chamada 1', tempo: '00:00:30', type: 'ECHM', ativo: true },
      { code: 'CH2', descricao: 'Chamada 2', tempo: '00:00:30', type: 'ECHM', ativo: true },
      { code: 'INT1', descricao: 'Interprograma 1', tempo: '00:01:00', type: 'EINT', ativo: true }
    ];

    const res = distribuirPecasNosBreaks(roteiro, pecas, { startSec: 21600 });
    expect(res.resultado.chamadasPreenchidas).toBe(1);
    expect(res.resultado.interprogramasPreenchidos).toBe(1);
    expect(res.roteiro[1].code).toBe('CH1');
    expect(res.roteiro[2].code).toBe('INT1');
  });

  it('resolve gap com peças ativas e reduz slot residual', () => {
    const roteiro = [
      { code: '__GAP__', descricao: '[ AJUSTE DE GRADE ]', tempo: '00:02:00', type: '__SLOT__' }
    ];
    const pecas = [
      { code: 'CH1', descricao: 'Chamada 1', tempo: '00:00:30', type: 'ECHM', ativo: true },
      { code: 'INT1', descricao: 'Interprograma 1', tempo: '00:01:30', type: 'EINT', ativo: true }
    ];

    const res = distribuirPecasNosBreaks(roteiro, pecas, { startSec: 21600 });
    expect(res.resultado.gapsResolvidos).toBe(1);
    expect(res.roteiro).toHaveLength(2);
    expect(res.roteiro[0].code).toBe('CH1');
    expect(res.roteiro[1].code).toBe('INT1');
  });
});

import { describe, it, expect } from 'vitest';
import BreakDistributor from '../../src/core/breakDistributor.js';

const {
  distribuirPecasNosBreaks,
  isProgramType,
  isChamadaType,
  isInterprogramaType,
  isVinhetaType,
  isComercialType
} = BreakDistributor;

describe('BreakDistributor - Suporte Multi-Emissora (Fase 2)', () => {
  it('classifica corretamente os tipos de cada emissora', () => {
    // Programas
    expect(isProgramType('PGM')).toBe(true);
    expect(isProgramType('RPRO')).toBe(true);
    expect(isProgramType('GPRO')).toBe(true);
    expect(isProgramType('IPRO')).toBe(true);
    expect(isProgramType('GCHM')).toBe(false);

    // Chamadas
    expect(isChamadaType('ECHM')).toBe(true);
    expect(isChamadaType('ECHE')).toBe(true);
    expect(isChamadaType('GCHM')).toBe(true);
    expect(isChamadaType('CH')).toBe(true);
    expect(isChamadaType('CHAMADA_QUENTE')).toBe(true);

    // Interprogramas / Promos / Institucionais / Governo
    expect(isInterprogramaType('EINT')).toBe(true);
    expect(isInterprogramaType('EINS')).toBe(true);
    expect(isInterprogramaType('GGV')).toBe(true);
    expect(isInterprogramaType('GINS')).toBe(true);
    expect(isInterprogramaType('PROMO')).toBe(true);
    expect(isInterprogramaType('INTERPRO')).toBe(true);
    expect(isInterprogramaType('INTERPROGRAMA')).toBe(true);
    expect(isInterprogramaType('PROGRAMAETE')).toBe(true);

    // Vinhetas
    expect(isVinhetaType('EVNH')).toBe(true);
    expect(isVinhetaType('GVNH')).toBe(true);
    expect(isVinhetaType('VH')).toBe(true);
    expect(isVinhetaType('VINHETA')).toBe(true);

    // Comerciais
    expect(isComercialType('ECOM')).toBe(true);
    expect(isComercialType('RCOM')).toBe(true);
    expect(isComercialType('RPOL')).toBe(true);
  });

  describe('Canal Gov (GPRO, GCHM, GGV, GINS, GVNH)', () => {
    it('preenche slots de chamada com GCHM e interprograma/governo com GGV/GINS', () => {
      const roteiro = [
        { type: 'GPRO', descricao: 'PGM VOZ DO BRASIL - BL 01', tempo: '00:25:00' },
        { type: '__SLOT__', descricao: '[ BREAK — chamada ]', tempo: '00:00:30' },
        { type: '__SLOT__', descricao: '[ BREAK — interprograma ]', tempo: '00:01:00' },
        { type: 'GPRO', descricao: 'PGM VOZ DO BRASIL - BL 02', tempo: '00:25:00' }
      ];

      const pecasGov = [
        { code: '11814', type: 'GCHM', descricao: 'CHAMADA BRASIL EM DIA', tempo: '00:00:30', ativo: true, peso: 8 },
        { code: '11820', type: 'GGV', descricao: 'GOVERNO VACINACAO', tempo: '00:01:00', ativo: true, peso: 7 },
        { code: '11825', type: 'GINS', descricao: 'INSTITUCIONAL EBC', tempo: '00:01:00', ativo: true, peso: 5 }
      ];

      const res = distribuirPecasNosBreaks(roteiro, pecasGov, {
        regras: { breakIntervaloMinChamada: 0, breakIntervaloMinInterprograma: 0 }
      });

      expect(res.resultado.totalAlocado).toBe(2);
      expect(res.resultado.chamadasPreenchidas).toBe(1);
      expect(res.resultado.interprogramasPreenchidos).toBe(1);
      expect(res.roteiro[1].code).toBe('11814'); // GCHM
      expect(res.roteiro[1].type).toBe('GCHM');
      expect(res.roteiro[2].code).toBe('11820'); // GGV (maior peso que GINS)
      expect(res.roteiro[2].type).toBe('GGV');
    });

    it('respeita anti-adjacência de tema entre programa GPRO e chamada GCHM', () => {
      const roteiro = [
        { type: 'GPRO', descricao: 'GPRO BRASIL EM DIA - BL 01', tempo: '00:20:00' },
        { type: '__SLOT__', descricao: '[ BREAK — chamada ]', tempo: '00:00:30' }
      ];

      const pecas = [
        { code: 'CH_MESMO_TEMA', type: 'GCHM', descricao: 'CHAMADA BRASIL EM DIA', programaRelacionado: 'BRASIL EM DIA', tempo: '00:00:30', ativo: true },
        { code: 'CH_OUTRO_TEMA', type: 'GCHM', descricao: 'CHAMADA BOM DIA MINISTRO', programaRelacionado: 'BOM DIA MINISTRO', tempo: '00:00:30', ativo: true }
      ];

      const res = distribuirPecasNosBreaks(roteiro, pecas, {
        regras: { breakAntiAdjacenciaTema: true, breakIntervaloMinChamada: 0 }
      });

      // Não pode alocar a chamada do mesmo programa vizinho
      expect(res.roteiro[1].code).toBe('CH_OUTRO_TEMA');
    });
  });

  describe('TV Brasil Internacional (IPRO, CH, PROMO, INTERPRO, VH, CI)', () => {
    it('aloca peças com types da Internacional (CH, PROMO, INTERPRO)', () => {
      const roteiro = [
        { type: 'IPRO', descricao: 'IPRO NOTICIA MUNDO - BL 01', tempo: '00:26:00' },
        { type: '__SLOT__', descricao: '[ BREAK — chamada ]', tempo: '00:00:30' },
        { type: '__SLOT__', descricao: '[ BREAK — interprograma ]', tempo: '00:01:00' }
      ];

      const pecasInternacional = [
        { code: 'i4001', type: 'CH', descricao: 'CHAMADA SEM CENSURA INTERNACIONAL', tempo: '00:00:30', ativo: true, peso: 9 },
        { code: 'i4002', type: 'PROMO', descricao: 'PROMO MUSICA DO BRASIL', tempo: '00:01:00', ativo: true, peso: 8 },
        { code: 'i3001', type: 'VH', descricao: 'VH VOLTAMOS JA INTERNACIONAL', tempo: '00:00:05', ativo: true }
      ];

      const res = distribuirPecasNosBreaks(roteiro, pecasInternacional, {
        regras: { breakIntervaloMinChamada: 0, breakIntervaloMinInterprograma: 0 }
      });

      expect(res.resultado.totalAlocado).toBe(2);
      expect(res.roteiro[1].code).toBe('i4001'); // CH
      expect(res.roteiro[2].code).toBe('i4002'); // PROMO
    });
  });

  describe('TV Brasil Rede (RPRO, CHAMADA_QUENTE, INTERPROGRAMA, PROMO)', () => {
    it('preenche gaps utilizando combinações exatas de chamadas/promos da Rede', () => {
      const roteiro = [
        { type: 'RPRO', descricao: 'PGM SEM CENSURA - BL 01', tempo: '00:25:00' },
        { code: '__GAP__', type: '__GAP__', descricao: '[ AJUSTE DE GRADE ]', tempo: '00:01:30' },
        { type: 'RPRO', descricao: 'PGM SEM CENSURA - BL 02', tempo: '00:25:00' }
      ];

      const pecasRede = [
        { code: '91001', type: 'PROMO', descricao: 'PROMO FAIXA CINE', tempo: '00:01:00', ativo: true, peso: 7 },
        { code: '92001', type: 'CH', descricao: 'CHAMADA REPORTER BRASIL', tempo: '00:00:30', ativo: true, peso: 8 },
        { code: '92002', type: 'CHAMADA_QUENTE', descricao: 'CHAMADA ESPECIAL', tempo: '00:00:15', ativo: true, peso: 4 }
      ];

      const res = distribuirPecasNosBreaks(roteiro, pecasRede, {
        regras: { breakPreencherGaps: true }
      });

      expect(res.resultado.gapsResolvidos).toBe(1);
      // O gap de 1m30s foi preenchido por 91001 (1m) + 92001 (30s)
      const alocadosCodes = res.resultado.alocacoes.map(a => a.code);
      expect(alocadosCodes).toContain('91001');
      expect(alocadosCodes).toContain('92001');
    });
  });
});

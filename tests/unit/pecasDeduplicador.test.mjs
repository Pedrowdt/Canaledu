import { describe, it, expect } from 'vitest';
import PecasDeduplicador from '../../src/core/pecasDeduplicador.js';

describe('PecasDeduplicador', () => {
  it('normaliza texto removendo acentos, pontuação e excesso de espaços', () => {
    const entrada = '  CHAMADA - Jornal da Educação (HD)!  ';
    expect(PecasDeduplicador.normalizarTexto(entrada)).toBe('chamada jornal da educacao hd');
  });

  it('normaliza código removendo espaços e padronizando em maiúsculas', () => {
    expect(PecasDeduplicador.normalizarCode(' prog_01 ')).toBe('PROG_01');
    expect(PecasDeduplicador.normalizarCode(12345)).toBe('12345');
    expect(PecasDeduplicador.normalizarCode(null)).toBe('');
  });

  describe('Deduplicação por Descrição (Aba Peças)', () => {
    it('encontra duplicados mesmo com pequenas variações de caixa e símbolos', () => {
      const lista = [
        { code: 'CH_01', descricao: 'Chamada Especial' },
        { code: 'CH_02', descricao: 'chamada especial' },
        { code: 'CH_03', descricao: 'Outro Programa' },
        { code: 'CH_04', descricao: 'CHAMADA: ESPECIAL!' },
      ];

      const grupos = PecasDeduplicador.encontrarDuplicados(lista, 'descricao');
      expect(grupos).toHaveLength(1);
      expect(grupos[0].chave).toBe('chamada especial');
      expect(grupos[0].itens).toHaveLength(3);
      expect(grupos[0].itens.map((p) => p.code)).toEqual(['CH_01', 'CH_02', 'CH_04']);
    });

    it('ignora peças com descrição vazia', () => {
      const lista = [
        { code: 'CH_01', descricao: '' },
        { code: 'CH_02', descricao: '   ' },
      ];
      expect(PecasDeduplicador.encontrarDuplicados(lista, 'descricao')).toHaveLength(0);
    });
  });

  describe('Deduplicação por Código Idêntico (Aba Programas)', () => {
    it('NÃO considera blocos de programas (bl01, bl02) como duplicados quando seus códigos são distintos', () => {
      const programas = [
        { code: 'PGM_01_BL01', descricao: 'SEMANA DE ARTE MODERNA' },
        { code: 'PGM_01_BL02', descricao: 'SEMANA DE ARTE MODERNA' },
        { code: 'PGM_01_BL03', descricao: 'SEMANA DE ARTE MODERNA' },
        { code: 'PGM_02_BL01', descricao: 'JORNAL DA NOITE' },
        { code: 'PGM_02_BL02', descricao: 'JORNAL DA NOITE' },
      ];

      // Com criterio 'code', cada bloco possui código próprio e NÃO deve ser marcado como duplicado
      const grupos = PecasDeduplicador.encontrarDuplicados(programas, 'code');
      expect(grupos).toHaveLength(0);
    });

    it('identifica como duplicado apenas quando há programas com o mesmo código', () => {
      const programas = [
        { code: 'PGM_100', descricao: 'Telecurso Bloco 1 (Versão A)', rowVersion: 1 },
        { code: 'pgm_100', descricao: 'Telecurso Bloco 1 (Versão B)', rowVersion: 2 },
        { code: 'PGM_200', descricao: 'Telecurso Bloco 2' },
      ];

      const grupos = PecasDeduplicador.encontrarDuplicados(programas, 'code');
      expect(grupos).toHaveLength(1);
      expect(grupos[0].chave).toBe('PGM_100');
      expect(grupos[0].itens).toHaveLength(2);

      // Descarte com manter_recente descarta a versão antiga
      const paraDescarte = PecasDeduplicador.selecionarParaAcao(grupos, 'manter_recente');
      expect(paraDescarte).toEqual(['PGM_100']);
    });
  });

  describe('Ordenação e Seleção de Ação', () => {
    it('compara códigos numericamente e alfanumericamente', () => {
      expect(PecasDeduplicador.compararCodes('10', '2')).toBeGreaterThan(0);
      expect(PecasDeduplicador.compararCodes('89020', '89050')).toBeLessThan(0);
      expect(PecasDeduplicador.compararCodes('CE65565', 'CE66331')).toBeLessThan(0);
      expect(PecasDeduplicador.compararCodes('', '100')).toBeLessThan(0);
    });

    it('seleciona itens para descarte mantendo a peça com o MAIOR code (padrão)', () => {
      const grupos = [
        {
          chave: 'vinheta educacao',
          itens: [
            { code: '89020' },
            { code: '89050' },
            { code: '89010' },
          ],
        },
      ];

      // Por padrão (ou com 'manter_maior_code'), 89050 é preservada, e 89010 e 89020 são sugeridas para ação
      const paraAcao = PecasDeduplicador.selecionarParaAcao(grupos);
      expect(paraAcao.sort()).toEqual(['89010', '89020']);
    });

    it('seleciona itens mantendo o maior code alfanumérico', () => {
      const grupos = [
        {
          chave: 'vinheta ce',
          itens: [
            { code: 'CE65565' },
            { code: 'CE66331' },
          ],
        },
      ];

      const paraAcao = PecasDeduplicador.selecionarParaAcao(grupos, 'manter_maior_code');
      expect(paraAcao).toEqual(['CE65565']);
    });

    it('mantém suporte a manter_recente por rowVersion se solicitado', () => {
      const grupos = [
        {
          chave: 'vinheta canal',
          itens: [
            { code: 'V1', rowVersion: 1 },
            { code: 'V2', rowVersion: 3 },
            { code: 'V3', rowVersion: 2 },
          ],
        },
      ];

      const paraAcao = PecasDeduplicador.selecionarParaAcao(grupos, 'manter_recente');
      expect(paraAcao.sort()).toEqual(['V1', 'V3']);
    });
  });
});

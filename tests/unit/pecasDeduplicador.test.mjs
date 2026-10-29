import { describe, it, expect } from 'vitest';
import PecasDeduplicador from '../../src/core/pecasDeduplicador.js';

describe('PecasDeduplicador', () => {
  it('normaliza texto removendo acentos, pontuação e excesso de espaços', () => {
    const entrada = '  CHAMADA - Jornal da Educação (HD)!  ';
    expect(PecasDeduplicador.normalizarTexto(entrada)).toBe('chamada jornal da educacao hd');
  });

  it('encontra duplicados mesmo com pequenas variações de caixa e símbolos', () => {
    const lista = [
      { code: 'CH_01', descricao: 'Chamada Especial' },
      { code: 'CH_02', descricao: 'chamada especial' },
      { code: 'CH_03', descricao: 'Outro Programa' },
      { code: 'CH_04', descricao: 'CHAMADA: ESPECIAL!' },
    ];

    const grupos = PecasDeduplicador.encontrarDuplicados(lista);
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
    expect(PecasDeduplicador.encontrarDuplicados(lista)).toHaveLength(0);
  });

  it('seleciona itens para descarte mantendo a peça mais recente', () => {
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
    // V2 tem rowVersion 3 (mais recente), logo V1 e V3 devem ser marcadas
    expect(paraAcao.sort()).toEqual(['V1', 'V3']);
  });
});

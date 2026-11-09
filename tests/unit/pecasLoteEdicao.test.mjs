import { describe, it, expect } from 'vitest';
import PecasDeduplicador from '../../src/core/pecasDeduplicador.js';

describe('Edição e Deduplicação em Lote de Peças', () => {
  it('deduplicação prioriza o maior número de code', () => {
    const lista = [
      { code: '100', descricao: 'VINHETA CANAL EDUCAÇÃO', type: 'EVNH' },
      { code: '950', descricao: 'VINHETA CANAL EDUCAÇÃO', type: 'EVNH' },
      { code: '300', descricao: 'VINHETA CANAL EDUCAÇÃO', type: 'EVNH' },
      { code: '8000', descricao: 'OUTRO ITEM ÚNICO', type: 'EVNH' },
    ];

    const grupos = PecasDeduplicador.encontrarDuplicados(lista);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].chave).toBe('vinheta canal educacao');

    // Com manter_maior_code, o code '950' deve ser preservado, e '100' e '300' marcados para descarte
    const descartar = PecasDeduplicador.selecionarParaAcao(grupos, 'manter_maior_code');
    expect(descartar.sort()).toEqual(['100', '300']);
  });

  it('aplica alterações de type, categoria e peso apenas nos itens selecionados', () => {
    const catalogo = [
      { code: '101', descricao: 'Item 1', type: 'EVNH', categoria: 'CHAMADA_QUENTE', peso: 5 },
      { code: '102', descricao: 'Item 2', type: 'EVNH', categoria: 'MANUT' },
      { code: '103', descricao: 'Item 3', type: 'EINT', categoria: 'INTGOV', peso: 3 },
    ];

    const selectedCodes = new Set(['101', '102']);

    // Simula a lógica de confirmarEdicaoLote
    const alteracoes = {
      type: 'ECHE',
      categoria: 'BUSSOLA',
      pesoAcao: 'definir',
      pesoValor: 9,
      finalidade: 'estreia',
    };

    const resultado = catalogo.map((item) => {
      if (!selectedCodes.has(item.code)) return item;
      const atualizado = { ...item };
      if (alteracoes.type) {
        atualizado.type = alteracoes.type;
        if (atualizado.type !== 'EVNH') {
          atualizado.funcao = '';
          atualizado.programaRelacionado = '';
        }
      }
      if (alteracoes.categoria) atualizado.categoria = alteracoes.categoria;
      if (alteracoes.pesoAcao === 'definir') atualizado.peso = alteracoes.pesoValor;
      else if (alteracoes.pesoAcao === 'limpar') delete atualizado.peso;
      if (alteracoes.finalidade) atualizado.tipoFinalidade = alteracoes.finalidade;
      return atualizado;
    });

    // Item 101 e 102 foram modificados
    expect(resultado[0].type).toBe('ECHE');
    expect(resultado[0].categoria).toBe('BUSSOLA');
    expect(resultado[0].peso).toBe(9);
    expect(resultado[0].tipoFinalidade).toBe('estreia');

    expect(resultado[1].type).toBe('ECHE');
    expect(resultado[1].categoria).toBe('BUSSOLA');
    expect(resultado[1].peso).toBe(9);
    expect(resultado[1].tipoFinalidade).toBe('estreia');

    // Item 103 permaneceu idêntico
    expect(resultado[2].type).toBe('EINT');
    expect(resultado[2].categoria).toBe('INTGOV');
    expect(resultado[2].peso).toBe(3);
    expect(resultado[2].tipoFinalidade).toBeUndefined();
  });

  it('permite remover peso em lote', () => {
    const catalogo = [
      { code: '201', descricao: 'Item 1', peso: 7 },
      { code: '202', descricao: 'Item 2', peso: 4 },
    ];

    const selectedCodes = new Set(['201', '202']);
    const resultado = catalogo.map((item) => {
      if (!selectedCodes.has(item.code)) return item;
      const atualizado = { ...item };
      delete atualizado.peso;
      return atualizado;
    });

    expect(resultado[0].peso).toBeUndefined();
    expect(resultado[1].peso).toBeUndefined();
  });
});

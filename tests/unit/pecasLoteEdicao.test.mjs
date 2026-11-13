import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import PecasDeduplicador from '../../src/core/pecasDeduplicador.js';

const appSrc = readFileSync(new URL('../../pecas-programas.js', import.meta.url), 'utf8');

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

  it('altera função e programa relacionado nos itens selecionados usando a lógica real da tela', () => {
    const elements = new Map();
    const makeEl = (id) => ({ id, value: '', textContent: '', innerHTML: '', style: {}, checked: false, classList: { add(){}, remove(){}, toggle(){} }, focus(){}, addEventListener(){} });
    const document = {
      getElementById(id) { if (!elements.has(id)) elements.set(id, makeEl(id)); return elements.get(id); },
      querySelectorAll() { return []; },
    };
    const g = { addEventListener(){}, removeEventListener(){}, toast(){} }; g.window = g;
    const factory = new Function('window','globalThis','document','localStorage','console','setTimeout','clearTimeout','alert', `${appSrc}\nreturn {
      confirmarEdicaoLote,
      __setPecas: (v) => { pecas = v; },
      __getPecas: () => pecas,
      __setSelectedCodes: (v) => { selectedCodes = new Set(v); },
      __setRender: (f) => { render = f; },
      __setScheduleSync: (f) => { scheduleSync = f; },
    };`);
    const app = factory(g, g, document, {getItem:()=>null,setItem(){},removeItem(){}}, console, setTimeout, clearTimeout, () => {});
    app.__setPecas([
      { code: 'VH01', type: 'EVNH', funcao: 'outro' },
      { code: 'VH02', type: 'EVNH', funcao: 'outro' },
      { code: 'VH03', type: 'EVNH', funcao: 'classificacao_indicativa' },
    ]);
    app.__setSelectedCodes(['VH01', 'VH02']); app.__setRender(() => {}); app.__setScheduleSync(() => {});
    elements.set('batch-f-funcao', Object.assign(makeEl('batch-f-funcao'), { value: 'vh_daqui_a_pouco' }));
    elements.set('batch-f-programa-relacionado', Object.assign(makeEl('batch-f-programa-relacionado'), { value: 'PALALOOS' }));
    app.confirmarEdicaoLote();
    expect(app.__getPecas()[0]).toMatchObject({ funcao: 'vh_daqui_a_pouco', programaRelacionado: 'PALALOOS' });
    expect(app.__getPecas()[1]).toMatchObject({ funcao: 'vh_daqui_a_pouco', programaRelacionado: 'PALALOOS' });
    expect(app.__getPecas()[2]).toMatchObject({ funcao: 'classificacao_indicativa' });
  });

  it('permite limpar função e programa relacionado em lote', () => {
    const elements = new Map();
    const makeEl = (id) => ({ id, value: '', textContent: '', innerHTML: '', style: {}, checked: false, classList: { add(){}, remove(){}, toggle(){} }, focus(){}, addEventListener(){} });
    const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, makeEl(id)); return elements.get(id); }, querySelectorAll() { return []; } };
    const g = { addEventListener(){}, removeEventListener(){}, toast(){} }; g.window = g;
    const factory = new Function('window','globalThis','document','localStorage','console','setTimeout','clearTimeout','alert', `${appSrc}\nreturn {
      confirmarEdicaoLote,
      __setPecas: (v) => { pecas = v; },
      __getPecas: () => pecas,
      __setSelectedCodes: (v) => { selectedCodes = new Set(v); },
      __setRender: (f) => { render = f; },
      __setScheduleSync: (f) => { scheduleSync = f; },
    };`);
    const app = factory(g, g, document, {getItem:()=>null,setItem(){},removeItem(){}}, console, setTimeout, clearTimeout, () => {});
    app.__setPecas([{ code: 'VH01', type: 'EVNH', funcao: 'vh_a_seguir', programaRelacionado: 'PALALOOS' }]);
    app.__setSelectedCodes(['VH01']); app.__setRender(() => {}); app.__setScheduleSync(() => {});
    elements.set('batch-f-funcao', Object.assign(makeEl('batch-f-funcao'), { value: '__limpar__' }));
    app.confirmarEdicaoLote();
    expect(app.__getPecas()[0]).toMatchObject({ funcao: '', programaRelacionado: '' });
  });
});

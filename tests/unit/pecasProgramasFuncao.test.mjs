// MVP-CADASTRO.md, Fase 1: campos novos no formulário de Peças e Programas —
// `funcao`/`programa_relacionado` para peças type=EVNH, e
// `programa_titulo`/`temporada`/`episodio`/`bloco` calculados automaticamente
// para programas. Mesmo padrão de extração dos outros testes deste arquivo
// (new Function + mocks mínimos de DOM).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../pecas-programas.js', import.meta.url), 'utf8');

function makeFakeElement(id) {
  return {
    id,
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
  };
}

function loadApp() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeFakeElement(id));
      return elements.get(id);
    },
    querySelectorAll: () => [],
  };
  const g = { addEventListener() {}, removeEventListener() {} };
  g.window = g;
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const factory = new Function(
    'window', 'globalThis', 'document', 'localStorage', 'console', 'setTimeout', 'clearTimeout', 'alert',
    `${src}\nreturn {
      saveItem, openModal, toggleFuncaoFields, toggleProgramaRelacionadoField,
      baseProgramTitle, parseEpisodioInfo,
      __test_setActiveTab: (t) => { activeTab = t; },
      __test_setPecas: (v) => { pecas = v; },
      __test_setProgramas: (v) => { programas = v; },
      __test_getPecas: () => pecas,
      __test_getProgramas: () => programas,
    };`
  );
  const app = factory.call(g, g.window, g, document, localStorage, console, setTimeout, clearTimeout, () => {});
  return { app, elements };
}

function set(elements, id, value) {
  elements.set(id, { ...(elements.get(id) || {}), id, value });
}

describe('saveItem() — peças (funcao/programa_relacionado)', () => {
  it('grava funcao/programa_relacionado quando type=EVNH', () => {
    const { app, elements } = loadApp();
    app.__test_setActiveTab('pecas');
    app.__test_setPecas([]);
    set(elements, 'f-code', 'VH001');
    set(elements, 'f-desc', 'VH DAQUI A POUCO PALALOOS');
    set(elements, 'f-tempo', '00:00:08');
    set(elements, 'f-midia', '0OMN');
    set(elements, 'f-type', 'EVNH');
    set(elements, 'f-cat', 'CHAMADA_QUENTE');
    set(elements, 'f-validade', '');
    set(elements, 'f-obs', '');
    set(elements, 'f-hini', '');
    set(elements, 'f-hfim', '');
    set(elements, 'f-freq', '');
    set(elements, 'f-funcao', 'vh_daqui_a_pouco');
    set(elements, 'f-programa-relacionado', 'PALALOOS');
    elements.set('f-showh', { id: 'f-showh', checked: false });

    app.saveItem();

    const salva = app.__test_getPecas().find((p) => p.code === 'VH001');
    expect(salva.funcao).toBe('vh_daqui_a_pouco');
    expect(salva.programaRelacionado).toBe('PALALOOS');
  });

  it('não grava funcao/programa_relacionado quando type não é EVNH (mesmo se os campos tiverem valor de uma edição anterior)', () => {
    const { app, elements } = loadApp();
    app.__test_setActiveTab('pecas');
    app.__test_setPecas([]);
    set(elements, 'f-code', 'CH001');
    set(elements, 'f-desc', 'CHAMADA X');
    set(elements, 'f-tempo', '00:00:30');
    set(elements, 'f-midia', '0OMN');
    set(elements, 'f-type', 'ECHE'); // não é EVNH
    set(elements, 'f-cat', 'CHAMADA_QUENTE');
    set(elements, 'f-funcao', 'vh_daqui_a_pouco'); // resíduo de uma edição anterior
    set(elements, 'f-programa-relacionado', 'PALALOOS');
    elements.set('f-showh', { id: 'f-showh', checked: false });

    app.saveItem();

    const salva = app.__test_getPecas().find((p) => p.code === 'CH001');
    expect(salva.funcao).toBe('');
    expect(salva.programaRelacionado).toBe('');
  });

  it('funcao sem "programa relacionado" (ex.: classificacao_indicativa) não grava programa_relacionado mesmo se o campo tiver texto', () => {
    const { app, elements } = loadApp();
    app.__test_setActiveTab('pecas');
    app.__test_setPecas([]);
    set(elements, 'f-code', 'CI001');
    set(elements, 'f-desc', 'VH CLASSIFICACAO INDICATIVA 10 ANOS');
    set(elements, 'f-tempo', '00:00:05');
    set(elements, 'f-type', 'EVNH');
    set(elements, 'f-cat', 'CHAMADA_QUENTE');
    set(elements, 'f-funcao', 'classificacao_indicativa');
    set(elements, 'f-programa-relacionado', 'ALGO QUE NAO DEVERIA SER SALVO');
    elements.set('f-showh', { id: 'f-showh', checked: false });

    app.saveItem();

    const salva = app.__test_getPecas().find((p) => p.code === 'CI001');
    expect(salva.funcao).toBe('classificacao_indicativa');
    expect(salva.programaRelacionado).toBe('');
  });
});

describe('saveItem() — programas (programa_titulo/temporada/episodio/bloco automáticos)', () => {
  it('calcula os 4 campos a partir da descrição, sem precisar digitar de novo', () => {
    const { app, elements } = loadApp();
    app.__test_setActiveTab('programas');
    app.__test_setProgramas([]);
    set(elements, 'f-code', 'PALALOOS_T01EP03');
    set(elements, 'f-desc', 'PGM PALALOOS - T01 EP03 - BL02');
    set(elements, 'f-tempo', '00:26:00');
    set(elements, 'f-type', 'RPRO');

    app.saveItem();

    const salvo = app.__test_getProgramas().find((p) => p.code === 'PALALOOS_T01EP03');
    expect(salvo.programaTitulo).toBe('PALALOOS');
    expect(salvo.temporada).toBe(1);
    expect(salvo.episodio).toBe(3);
    expect(salvo.bloco).toBe(2);
  });

  it('partes ausentes na descrição ficam null, não 0', () => {
    const { app, elements } = loadApp();
    app.__test_setActiveTab('programas');
    app.__test_setProgramas([]);
    set(elements, 'f-code', 'AVULSO');
    set(elements, 'f-desc', 'PROGRAMA SEM PADRAO DE EPISODIO');
    set(elements, 'f-tempo', '00:10:00');
    set(elements, 'f-type', 'RPRO');

    app.saveItem();

    const salvo = app.__test_getProgramas().find((p) => p.code === 'AVULSO');
    expect(salvo.programaTitulo).toBe('PROGRAMA SEM PADRAO DE EPISODIO'); // só o prefixo "PGM " é removido, não "PROGRAMA"
    expect(salvo.temporada).toBeNull();
    expect(salvo.episodio).toBeNull();
    expect(salvo.bloco).toBeNull();
  });
});

describe('toggleFuncaoFields / toggleProgramaRelacionadoField — visibilidade condicional', () => {
  it('funcao-fields só aparece para type=EVNH', () => {
    const { app, elements } = loadApp();
    app.__test_setProgramas([]);
    set(elements, 'f-type', 'ECHE');
    app.toggleFuncaoFields();
    expect(elements.get('funcao-fields').style.display).toBe('none');

    set(elements, 'f-type', 'EVNH');
    elements.set('f-funcao', { id: 'f-funcao', value: '' });
    app.toggleFuncaoFields();
    expect(elements.get('funcao-fields').style.display).toBe('block');
  });

  it('programa-relacionado-field só aparece para funções que referenciam um programa', () => {
    const { app, elements } = loadApp();
    elements.set('f-funcao', { id: 'f-funcao', value: 'classificacao_indicativa' });
    app.toggleProgramaRelacionadoField();
    expect(elements.get('programa-relacionado-field').style.display).toBe('none');

    elements.set('f-funcao', { id: 'f-funcao', value: 'vh_daqui_a_pouco' });
    app.toggleProgramaRelacionadoField();
    expect(elements.get('programa-relacionado-field').style.display).toBe('block');
  });
});

describe('openModal() — restaura funcao/programa_relacionado ao editar uma peça existente', () => {
  it('preenche os campos do formulário com os valores salvos', () => {
    const { app, elements } = loadApp();
    app.__test_setActiveTab('pecas');
    app.__test_setPecas([{
      id: 'x1', code: 'VH001', descricao: 'VH DAQUI A POUCO PALALOOS', tempo: '00:00:08',
      type: 'EVNH', categoria: 'CHAMADA_QUENTE', funcao: 'vh_daqui_a_pouco', programaRelacionado: 'PALALOOS',
    }]);

    app.openModal('x1');

    expect(elements.get('f-funcao').value).toBe('vh_daqui_a_pouco');
    expect(elements.get('f-programa-relacionado').value).toBe('PALALOOS');
  });
});

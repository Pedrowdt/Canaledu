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
      toggleBatchProgramaRelacionadoField,
      FUNCOES_COM_PROGRAMA, FUNCAO_LABEL,
      __test_setActiveTab: (t) => { activeTab = t; },
      __test_setPecas: (v) => { pecas = v; },
      __test_getPecas: () => pecas,
    };`
  );
  const app = factory.call(g, g.window, g, document, localStorage, console, setTimeout, clearTimeout, () => {});
  return { app, elements };
}

function set(elements, id, value) {
  elements.set(id, { ...(elements.get(id) || {}), id, value });
}

describe('Migration 022 — Novas Funções de Vinheta na UI', () => {
  it('contém todas as novas funções de vinheta mapeadas nos roteiros EBC', () => {
    const { app } = loadApp();
    const esperadas = [
      'vh_vai_comecar',
      'vh_voltamos_ja',
      'vh_voltamos_com',
      'vh_realizacao',
      'vh_ainda_hoje',
    ];
    for (const f of esperadas) {
      expect(app.FUNCAO_LABEL[f]).toBeDefined();
      expect(app.FUNCAO_LABEL[f].length).toBeGreaterThan(2);
    }
  });

  it('identifica corretamente funções vinculadas a programa', () => {
    const { app } = loadApp();
    expect(app.FUNCOES_COM_PROGRAMA.has('vh_vai_comecar')).toBe(true);
    expect(app.FUNCOES_COM_PROGRAMA.has('vh_voltamos_ja')).toBe(true);
    expect(app.FUNCOES_COM_PROGRAMA.has('vh_voltamos_com')).toBe(true);
    expect(app.FUNCOES_COM_PROGRAMA.has('vh_ainda_hoje')).toBe(true);
    expect(app.FUNCOES_COM_PROGRAMA.has('vh_realizacao')).toBe(false);
  });

  it('exibe programa-relacionado para vh_voltamos_ja e oculta para vh_realizacao', () => {
    const { app, elements } = loadApp();

    elements.set('f-funcao', { id: 'f-funcao', value: 'vh_voltamos_ja' });
    app.toggleProgramaRelacionadoField();
    expect(elements.get('programa-relacionado-field').style.display).toBe('block');

    elements.set('f-funcao', { id: 'f-funcao', value: 'vh_realizacao' });
    app.toggleProgramaRelacionadoField();
    expect(elements.get('programa-relacionado-field').style.display).toBe('none');
  });

  it('salva peça com vh_voltamos_com e respectivo programa relacionado', () => {
    const { app, elements } = loadApp();
    app.__test_setActiveTab('pecas');
    app.__test_setPecas([]);

    set(elements, 'f-code', 'i3387');
    set(elements, 'f-desc', 'VH VOLTAMOS COM AGRO NACIONAL');
    set(elements, 'f-tempo', '00:00:05');
    set(elements, 'f-midia', '0OMN');
    set(elements, 'f-type', 'EVNH');
    set(elements, 'f-cat', 'OUTROS');
    set(elements, 'f-funcao', 'vh_voltamos_com');
    set(elements, 'f-programa-relacionado', 'AGRO NACIONAL');
    elements.set('f-showh', { id: 'f-showh', checked: false });

    app.saveItem();

    const salva = app.__test_getPecas().find(p => p.code === 'i3387');
    expect(salva).toBeDefined();
    expect(salva.funcao).toBe('vh_voltamos_com');
    expect(salva.programaRelacionado).toBe('AGRO NACIONAL');
  });

  it('salva peça vh_realizacao sem programa relacionado', () => {
    const { app, elements } = loadApp();
    app.__test_setActiveTab('pecas');
    app.__test_setPecas([]);

    set(elements, 'f-code', '11814');
    set(elements, 'f-desc', 'VH REALIZACAO GOV');
    set(elements, 'f-tempo', '00:00:05');
    set(elements, 'f-midia', '0OMN');
    set(elements, 'f-type', 'EVNH');
    set(elements, 'f-cat', 'OUTROS');
    set(elements, 'f-funcao', 'vh_realizacao');
    elements.set('f-showh', { id: 'f-showh', checked: false });

    app.saveItem();

    const salva = app.__test_getPecas().find(p => p.code === '11814');
    expect(salva).toBeDefined();
    expect(salva.funcao).toBe('vh_realizacao');
    expect(salva.programaRelacionado).toBe('');
  });
});

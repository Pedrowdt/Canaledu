import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const srcPecasProgramas = readFileSync(new URL('../../pecas-programas.js', import.meta.url), 'utf8');
const srcAppSemBoot = readFileSync(new URL('../../app.js', import.meta.url), 'utf8').replace(/\ninit\(\);\s*$/, '\n');

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
    focus() {},
    select() {},
  };
}

function loadPecasProgramasApp() {
  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, makeFakeElement(id));
    return elements.get(id);
  };
  const document = {
    getElementById: getEl,
    querySelectorAll: () => [],
  };
  const g = { addEventListener() {}, removeEventListener() {} };
  g.window = g;
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  let alertMessages = [];
  const alertFn = (msg) => { alertMessages.push(msg); };

  const factory = new Function(
    'window', 'globalThis', 'document', 'localStorage', 'console', 'setTimeout', 'clearTimeout', 'alert',
    `${srcPecasProgramas}\nreturn {
      saveItem, openModal, closeModal, checkDuplicateCode,
      __test_setActiveTab: (t) => { activeTab = t; },
      __test_setPecas: (v) => { pecas = v; },
      __test_setProgramas: (v) => { programas = v; },
      __test_getPecas: () => pecas,
      __test_getProgramas: () => programas,
      __test_getEditingId: () => editingId,
    };`
  );
  const app = factory.call(g, g.window, g, document, localStorage, console, setTimeout, clearTimeout, alertFn);
  return { app, elements, getEl, alertMessages };
}

function loadRoteiroApp() {
  const elements = new Map();
  const fakeEl = { style: {}, classList: { add() {}, remove() {}, toggle() {} }, textContent: '', innerHTML: '', value: '', appendChild() {}, focus() {}, select() {} };
  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, makeFakeElement(id));
    return elements.get(id);
  };
  const document = {
    querySelectorAll: () => [],
    querySelector: () => fakeEl,
    getElementById: getEl,
    createElement: () => fakeEl,
    body: fakeEl,
  };
  const g = { addEventListener() {}, removeEventListener() {} };
  g.window = g;
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  let alertMessages = [];
  let toastMessages = [];
  const alertFn = (msg) => { alertMessages.push(msg); };
  const toastFn = (msg, type) => { toastMessages.push({ msg, type }); };
  const confirmFn = () => false;

  const factory = new Function(
    'window', 'globalThis', 'localStorage', 'document', 'confirm', 'alert', 'toast',
    `${srcAppSemBoot}\nreturn {
      saveNewPeca, saveEditPeca, saveNewProg,
      checkNewPecaDuplicate, checkEditPecaDuplicate, checkNewProgDuplicate,
      addPecaModal, editPecaModal, addProgModal, closeModal,
      __test_getState: () => state,
    };`
  );
  const app = factory.call(g, g.window, g, localStorage, document, confirmFn, alertFn, toastFn);
  return { app, elements, getEl, alertMessages, toastMessages };
}

describe('Tela Peças e Programas (Cadastro) — bloqueio e aviso de duplicidade', () => {
  it('checkDuplicateCode identifica duplicidade sem distinção de maiúsculas/minúsculas e atualiza o aviso visual', () => {
    const { app, getEl } = loadPecasProgramasApp();
    app.__test_setActiveTab('pecas');
    app.__test_setPecas([
      { id: 'p1', code: '89026', descricao: 'Chamada Especial' }
    ]);

    const codeEl = getEl('f-code');
    const warnEl = getEl('f-code-warn');

    codeEl.value = ' 89026 ';
    const dup = app.checkDuplicateCode();
    expect(dup).not.toBeNull();
    expect(dup.id).toBe('p1');
    expect(warnEl.style.display).toBe('block');
    expect(warnEl.textContent).toContain('Código já cadastrado');
    expect(codeEl.style.borderColor).toBe('#ef4444');

    codeEl.value = '89027';
    const noDup = app.checkDuplicateCode();
    expect(noDup).toBeNull();
    expect(warnEl.style.display).toBe('none');
    expect(codeEl.style.borderColor).toBe('');
  });

  it('saveItem() bloqueia cadastro de nova peça com code duplicado e exibe alert', () => {
    const { app, getEl, alertMessages } = loadPecasProgramasApp();
    app.__test_setActiveTab('pecas');
    app.__test_setPecas([
      { id: 'p1', code: 'VH100', descricao: 'Vinheta Abertura' }
    ]);

    getEl('f-code').value = 'vh100';
    getEl('f-desc').value = 'Segunda Vinheta';
    getEl('f-tempo').value = '00:00:10';
    getEl('f-type').value = 'EVNH';

    app.saveItem();

    expect(app.__test_getPecas()).toHaveLength(1);
    expect(alertMessages).toHaveLength(1);
    expect(alertMessages[0]).toContain('Código duplicado');
    expect(alertMessages[0]).toContain('Vinheta Abertura');
  });

  it('saveItem() permite salvar edição mantendo o próprio code, mas bloqueia se colidir com outro item', () => {
    const { app, getEl, alertMessages } = loadPecasProgramasApp();
    app.__test_setActiveTab('pecas');
    app.__test_setPecas([
      { id: 'p1', code: 'VH100', descricao: 'Vinheta 1' },
      { id: 'p2', code: 'VH200', descricao: 'Vinheta 2' }
    ]);

    app.openModal('p1');
    getEl('f-code').value = 'VH100';
    getEl('f-desc').value = 'Vinheta 1 Renomeada';
    app.saveItem();

    expect(alertMessages).toHaveLength(0);
    expect(app.__test_getPecas().find(p => p.id === 'p1').descricao).toBe('Vinheta 1 Renomeada');

    app.openModal('p1');
    getEl('f-code').value = 'VH200';
    app.saveItem();

    expect(alertMessages).toHaveLength(1);
    expect(alertMessages[0]).toContain('Código duplicado');
    expect(alertMessages[0]).toContain('Vinheta 2');
    expect(app.__test_getPecas().find(p => p.id === 'p1').code).toBe('VH100');
  });

  it('bloqueia duplicidade também na aba de Programas', () => {
    const { app, getEl, alertMessages } = loadPecasProgramasApp();
    app.__test_setActiveTab('programas');
    app.__test_setProgramas([
      { id: 'prog1', code: 'PGM01', descricao: 'Telecurso' }
    ]);

    getEl('f-code').value = 'PGM01';
    getEl('f-desc').value = 'Telecurso Reprise';
    app.saveItem();

    expect(app.__test_getProgramas()).toHaveLength(1);
    expect(alertMessages).toHaveLength(1);
    expect(alertMessages[0]).toContain('um programa cadastrado');
  });
});

describe('Tela do Roteiro (Banco Permanente) — bloqueio e aviso de duplicidade', () => {
  it('saveNewPeca() bloqueia adição de peça com código já existente no state.pecas', () => {
    const { app, getEl, alertMessages } = loadRoteiroApp();
    const state = app.__test_getState();
    state.pecas = [
      { code: 'PEC01', descricao: 'Peça Existente', tempo: '00:00:30', type: 'ECHM' }
    ];

    getEl('np-code').value = 'pec01';
    getEl('np-desc').value = 'Tentativa Duplicada';
    app.saveNewPeca();

    expect(state.pecas).toHaveLength(1);
    expect(alertMessages).toHaveLength(1);
    expect(alertMessages[0]).toContain('Código duplicado');
    expect(alertMessages[0]).toContain('Peça Existente');
  });

  it('saveEditPeca() bloqueia alteração para código de outra peça existente', () => {
    const { app, getEl, alertMessages } = loadRoteiroApp();
    const state = app.__test_getState();
    state.pecas = [
      { code: 'PEC01', descricao: 'Peça 1', tempo: '00:00:30', type: 'ECHM' },
      { code: 'PEC02', descricao: 'Peça 2', tempo: '00:00:30', type: 'ECHM' }
    ];

    getEl('ep-idx').value = '0';
    getEl('ep-code').value = 'PEC02';
    getEl('ep-desc').value = 'Tentando mudar code para PEC02';
    app.saveEditPeca();

    expect(alertMessages).toHaveLength(1);
    expect(alertMessages[0]).toContain('Código duplicado');
    expect(state.pecas[0].code).toBe('PEC01');
  });

  it('saveNewProg() bloqueia adição de programa com código duplicado', () => {
    const { app, getEl, alertMessages } = loadRoteiroApp();
    const state = app.__test_getState();
    state.programas = [
      { code: 'PROG01', descricao: 'Programa Existente', tempo: '00:25:00', type: 'RPRO' }
    ];

    getEl('npp-code').value = 'prog01';
    getEl('npp-desc').value = 'Outro programa com mesmo code';
    app.saveNewProg();

    expect(state.programas).toHaveLength(1);
    expect(alertMessages).toHaveLength(1);
    expect(alertMessages[0]).toContain('Código duplicado');
    expect(alertMessages[0]).toContain('Programa Existente');
  });
});

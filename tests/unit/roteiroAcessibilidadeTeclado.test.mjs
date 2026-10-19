import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const srcSemBoot = src.replace(/\ninit\(\);\s*$/, '\n');

function createDOM() {
  const elements = new Map();

  function makeEl(tag = 'div') {
    const classListSet = new Set();
    const attrs = new Map();
    const el = {
      tagName: tag.toUpperCase(),
      style: {},
      textContent: '',
      innerHTML: '',
      scrollIntoViewCalls: 0,
      focusCalls: 0,
      classList: {
        add: (...c) => c.forEach(x => classListSet.add(x)),
        remove: (...c) => c.forEach(x => classListSet.delete(x)),
        toggle: (c, force) => {
          if (force === undefined) {
            if (classListSet.has(c)) classListSet.delete(c);
            else classListSet.add(c);
          } else if (force) classListSet.add(c);
          else classListSet.delete(c);
        },
        contains: (c) => classListSet.has(c),
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => attrs.get(k) || null,
      scrollIntoView: () => { el.scrollIntoViewCalls++; },
      focus: () => { el.focusCalls++; },
      closest: (sel) => {
        if (sel === '.act-btn' && classListSet.has('act-btn')) return el;
        if (sel === '.drag-handle' && classListSet.has('drag-handle')) return el;
        return null;
      }
    };
    return el;
  }

  const tbody = makeEl('tbody');
  const btnAdd = makeEl('button');
  btnAdd.setAttribute('onclick', 'addItemModal()');
  const panelRoteiro = makeEl('div');
  panelRoteiro.id = 'panel-roteiro';

  const doc = {
    activeElement: null,
    querySelectorAll: (sel) => {
      if (sel === '#roteiro-tbody tr[data-index]') {
        return tbody.children || [];
      }
      if (sel === '.modal-overlay') {
        return [];
      }
      return [];
    },
    querySelector: (sel) => {
      if (sel === '[onclick="addItemModal()"]') return btnAdd;
      if (sel === '#roteiro-tbody') return tbody;
      return null;
    },
    getElementById: (id) => {
      if (id === 'panel-roteiro') return panelRoteiro;
      if (id === 'total-items' || id === 'total-dur') return makeEl('span');
      return makeEl('div');
    },
    createElement: (tag) => makeEl(tag),
    addEventListener: () => {},
  };

  return { doc, tbody, btnAdd, panelRoteiro, makeEl };
}

function loadHarness(dom) {
  const store = new Map();
  const ls = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const g = { addEventListener() {}, removeEventListener() {} };
  g.window = g;

  const factory = new Function(
    'window',
    'globalThis',
    'localStorage',
    'document',
    'confirm',
    `${srcSemBoot}\nreturn {
      selectRow,
      updateRowSelectionDOM,
      navigateSelectedRow,
      moveSelectedRow,
      handleRoteiroKeydown,
      renderRoteiro,
      __test_getState: () => state,
      __test_setState: (v) => { Object.assign(state, v); },
    };`
  );

  return factory(g, g, ls, dom.doc, () => false);
}

describe('Acessibilidade e Navegação por Teclado no Roteiro', () => {
  it('seleciona linha e atualiza classes e atributos ARIA no DOM', () => {
    const dom = createDOM();
    const app = loadHarness(dom);

    const row0 = dom.makeEl('tr');
    row0.setAttribute('data-index', '0');
    const row1 = dom.makeEl('tr');
    row1.setAttribute('data-index', '1');
    dom.tbody.children = [row0, row1];

    app.__test_setState({
      roteiro: [{ code: 'A', tempo: '00:01:00' }, { code: 'B', tempo: '00:02:00' }],
      selectedRow: null
    });

    app.selectRow(0);
    expect(app.__test_getState().selectedRow).toBe(0);
    expect(row0.classList.contains('row-selected')).toBe(true);
    expect(row0.getAttribute('aria-selected')).toBe('true');
    expect(row0.getAttribute('tabindex')).toBe('0');
    expect(row1.classList.contains('row-selected')).toBe(false);
    expect(row1.getAttribute('aria-selected')).toBe('false');
    expect(dom.btnAdd.textContent).toBe('+ Inserir após #1');

    // Desmarcar ao clicar novamente na mesma linha
    app.selectRow(0);
    expect(app.__test_getState().selectedRow).toBe(null);
    expect(row0.classList.contains('row-selected')).toBe(false);
    expect(dom.btnAdd.textContent).toBe('+ Adicionar peça');
  });

  it('não altera seleção ao clicar em botão de ação ou drag-handle', () => {
    const dom = createDOM();
    const app = loadHarness(dom);

    const fakeBtn = dom.makeEl('button');
    fakeBtn.classList.add('act-btn');
    const fakeEvent = { target: fakeBtn };

    app.__test_setState({
      roteiro: [{ code: 'A', tempo: '00:01:00' }],
      selectedRow: null
    });

    app.selectRow(0, fakeEvent);
    expect(app.__test_getState().selectedRow).toBe(null);
  });

  it('navega linhas com navigateSelectedRow respeitando limites', () => {
    const dom = createDOM();
    const app = loadHarness(dom);

    app.__test_setState({
      roteiro: [
        { code: 'A', tempo: '00:01:00' },
        { code: 'B', tempo: '00:02:00' },
        { code: 'C', tempo: '00:03:00' }
      ],
      selectedRow: null
    });

    // Sem seleção prévia, Seta para Baixo (delta +1) vai para o primeiro item (0)
    app.navigateSelectedRow(1);
    expect(app.__test_getState().selectedRow).toBe(0);

    // Próxima linha
    app.navigateSelectedRow(1);
    expect(app.__test_getState().selectedRow).toBe(1);

    // Próxima linha
    app.navigateSelectedRow(1);
    expect(app.__test_getState().selectedRow).toBe(2);

    // Fim da lista: mantém o último índice
    app.navigateSelectedRow(1);
    expect(app.__test_getState().selectedRow).toBe(2);

    // Seta para Cima (delta -1)
    app.navigateSelectedRow(-1);
    expect(app.__test_getState().selectedRow).toBe(1);

    // Topo da lista: mantém 0
    app.navigateSelectedRow(-1);
    app.navigateSelectedRow(-1);
    expect(app.__test_getState().selectedRow).toBe(0);
  });

  it('reordena linha via teclado (moveSelectedRow com Alt+Seta)', () => {
    const dom = createDOM();
    const app = loadHarness(dom);

    app.__test_setState({
      currentDate: new Date(2026, 9, 17),
      roteiro: [
        { code: 'P01', tempo: '00:01:00', type: 'PECA' },
        { code: 'P02', tempo: '00:02:00', type: 'PECA' },
        { code: 'P03', tempo: '00:03:00', type: 'PECA' }
      ],
      selectedRow: 0
    });

    // Mover item 0 para baixo (para posição 1)
    app.moveSelectedRow(1);
    const s1 = app.__test_getState();
    expect(s1.roteiro.map(x => x.code)).toEqual(['P02', 'P01', 'P03']);
    expect(s1.selectedRow).toBe(1);

    // Mover item 1 para baixo (para posição 2)
    app.moveSelectedRow(1);
    const s2 = app.__test_getState();
    expect(s2.roteiro.map(x => x.code)).toEqual(['P02', 'P03', 'P01']);
    expect(s2.selectedRow).toBe(2);

    // Tentativa de mover além do final não altera a lista
    app.moveSelectedRow(1);
    const s3 = app.__test_getState();
    expect(s3.roteiro.map(x => x.code)).toEqual(['P02', 'P03', 'P01']);
    expect(s3.selectedRow).toBe(2);

    // Mover de volta para cima
    app.moveSelectedRow(-1);
    const s4 = app.__test_getState();
    expect(s4.roteiro.map(x => x.code)).toEqual(['P02', 'P01', 'P03']);
    expect(s4.selectedRow).toBe(1);
  });

  it('handleRoteiroKeydown ignora eventos em inputs e trata atalhos corretamente', () => {
    const dom = createDOM();
    const app = loadHarness(dom);

    app.__test_setState({
      currentDate: new Date(2026, 9, 17),
      roteiro: [
        { code: 'P01', tempo: '00:01:00' },
        { code: 'P02', tempo: '00:02:00' }
      ],
      selectedRow: 0
    });

    // Se estiver digitando num input, nada muda
    let prevented = false;
    const inputEv = {
      target: { tagName: 'INPUT' },
      key: 'ArrowDown',
      preventDefault: () => { prevented = true; }
    };
    app.handleRoteiroKeydown(inputEv);
    expect(app.__test_getState().selectedRow).toBe(0);
    expect(prevented).toBe(false);

    // ArrowDown no container navega para o próximo item
    const downEv = {
      target: dom.doc.body,
      key: 'ArrowDown',
      preventDefault: () => { prevented = true; }
    };
    app.handleRoteiroKeydown(downEv);
    expect(app.__test_getState().selectedRow).toBe(1);
    expect(prevented).toBe(true);

    // Escape desmarca
    const escEv = {
      target: dom.doc.body,
      key: 'Escape',
      preventDefault: () => {}
    };
    app.handleRoteiroKeydown(escEv);
    expect(app.__test_getState().selectedRow).toBe(null);

    // Home seleciona primeiro item
    const homeEv = {
      target: dom.doc.body,
      key: 'Home',
      preventDefault: () => {}
    };
    app.handleRoteiroKeydown(homeEv);
    expect(app.__test_getState().selectedRow).toBe(0);

    // End seleciona último item
    const endEv = {
      target: dom.doc.body,
      key: 'End',
      preventDefault: () => {}
    };
    app.handleRoteiroKeydown(endEv);
    expect(app.__test_getState().selectedRow).toBe(1);
  });
});

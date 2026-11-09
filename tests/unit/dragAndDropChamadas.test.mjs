import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const srcSemBoot = src.replace(/\ninit\(\);\s*$/, '\n');

function loadAppEnv() {
  const g = { addEventListener() {}, removeEventListener() {} };
  g.window = g;
  const ls = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const fakeEl = {
    style: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
      toggle(c) {},
    },
    textContent: '',
    innerHTML: '',
    value: '',
    appendChild() {},
    setAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    parentNode: { insertBefore() {} },
  };
  const document = {
    querySelectorAll: () => [],
    querySelector: () => fakeEl,
    getElementById: () => fakeEl,
    createElement: () => ({ ...fakeEl, classList: { _classes: new Set(), add(c) { this._classes.add(c); }, remove(c) { this._classes.delete(c); }, contains(c) { return this._classes.has(c); } } }),
    body: fakeEl,
  };
  const confirm = () => true;

  const factory = new Function(
    'window',
    'globalThis',
    'localStorage',
    'document',
    'confirm',
    `${srcSemBoot}\nreturn {
      findPeca, dragStart, dragOver, dragLeave, dragDrop, dragEnd, dragFromSidebar, renderRoteiro,
      __test_getState: () => state,
      __test_setState: (v) => { Object.assign(state, v); },
      __test_getDragIdx: () => dragIdx,
      __test_setDragIdx: (v) => { dragIdx = v; },
    };`
  );
  return factory.call(g, g.window, g, ls, document, confirm);
}

describe('Drag and Drop de Chamadas e Peças no Roteiro', () => {
  let app;
  let state;

  beforeEach(() => {
    app = loadAppEnv();
    state = app.__test_getState();
    state.roteiro = [];
    state.pecas = [
      { code: '1001', descricao: 'CHAMADA FIXA CADASTRO', tempo: '00:00:30', type: 'ECHE' },
      { code: 2002, descricao: 'CHAMADA CODIGO NUMERICO', tempo: '00:00:20', type: 'ECHM' }
    ];
    state.programas = [
      { code: 'PGM01', descricao: 'PROGRAMA TESTE', tempo: '00:30:00', type: 'RPRO' }
    ];
    state.pecasDia = [
      { code: 'DIA99', descricao: 'CHAMADA QUENTE DO DIA', tempo: '00:00:45', type: 'ECHE', usado: 0, qtd: 2 }
    ];
    state.currentDate = new Date(2026, 10, 9); // Segunda-feira
  });

  describe('findPeca — busca tolerante e inclusão de Peças do Dia', () => {
    it('encontra chamada cadastrada no banco fixo de peças', () => {
      const peca = app.findPeca('1001');
      expect(peca).not.toBeNull();
      expect(peca.descricao).toBe('CHAMADA FIXA CADASTRO');
    });

    it('encontra programa cadastrado', () => {
      const pgm = app.findPeca('PGM01');
      expect(pgm).not.toBeNull();
      expect(pgm.descricao).toBe('PROGRAMA TESTE');
    });

    it('encontra chamada que existe apenas em state.pecasDia', () => {
      const pecaDia = app.findPeca('DIA99');
      expect(pecaDia).not.toBeNull();
      expect(pecaDia.descricao).toBe('CHAMADA QUENTE DO DIA');
    });

    it('encontra código numérico quando passado como string e vice-versa', () => {
      expect(app.findPeca('2002')).not.toBeNull();
      expect(app.findPeca(2002)).not.toBeNull();
    });

    it('ignora espaços em branco ao redor do código', () => {
      expect(app.findPeca('  1001  ')).not.toBeNull();
      expect(app.findPeca(' DIA99 ')).not.toBeNull();
    });

    it('retorna null para código inexistente ou nulo', () => {
      expect(app.findPeca('NAO_EXISTE')).toBeNull();
      expect(app.findPeca('')).toBeNull();
      expect(app.findPeca(null)).toBeNull();
    });
  });

  describe('dragFromSidebar — inicialização do arrasto', () => {
    it('define source, peca-code e text/plain no dataTransfer para suporte cross-browser', () => {
      const dataStore = {};
      const fakeEvent = {
        dataTransfer: {
          effectAllowed: '',
          setData: (k, v) => { dataStore[k] = v; },
        }
      };

      app.dragFromSidebar(fakeEvent, 'DIA99');

      expect(fakeEvent.dataTransfer.effectAllowed).toBe('copy');
      expect(dataStore['source']).toBe('sidebar');
      expect(dataStore['peca-code']).toBe('DIA99');
      expect(dataStore['text/plain']).toBe('DIA99');
    });
  });

  describe('dragDrop — soltura da chamada no roteiro', () => {
    function makeDropEvent(source, code) {
      const dataStore = {
        'source': source,
        'peca-code': code,
        'text/plain': code,
      };
      const classes = new Set(['drag-over']);
      return {
        preventDefault: () => {},
        currentTarget: {
          classList: {
            remove: (c) => classes.delete(c),
            contains: (c) => classes.has(c),
          }
        },
        dataTransfer: {
          getData: (k) => dataStore[k] || null,
        }
      };
    }

    it('ao soltar uma chamada sobre um slot [ BREAK — chamada ], substitui o slot', () => {
      state.roteiro = [
        { code: 'PGM01', descricao: 'BLOCO 1', tempo: '00:15:00', type: 'RPRO' },
        { code: '__BREAK__', descricao: '[ BREAK — chamada ]', tempo: '00:00:00', type: '__SLOT__' },
        { code: 'PGM01', descricao: 'BLOCO 2', tempo: '00:15:00', type: 'RPRO' },
      ];

      const event = makeDropEvent('sidebar', 'DIA99');
      app.dragDrop(event, 1);

      expect(state.roteiro).toHaveLength(3);
      expect(state.roteiro[1].code).toBe('DIA99');
      expect(state.roteiro[1].descricao).toBe('CHAMADA QUENTE DO DIA');
      expect(state.roteiro[1].type).toBe('ECHE');
      // Garante que campos voláteis das peças do dia foram removidos do roteiro
      expect(state.roteiro[1].usado).toBeUndefined();
      expect(state.roteiro[1].qtd).toBeUndefined();
    });

    it('ao soltar uma chamada da Peças do Dia, incrementa o contador usado no painel diário', () => {
      state.roteiro = [
        { code: 'PGM01', descricao: 'BLOCO 1', tempo: '00:15:00', type: 'RPRO' },
      ];

      expect(state.pecasDia[0].usado).toBe(0);

      const event = makeDropEvent('sidebar', 'DIA99');
      app.dragDrop(event, 0);

      expect(state.pecasDia[0].usado).toBe(1);
      expect(state.roteiro[0].code).toBe('DIA99');
    });

    it('ao soltar sobre uma linha normal, insere antes da linha', () => {
      state.roteiro = [
        { code: 'PGM01', descricao: 'BLOCO 1', tempo: '00:15:00', type: 'RPRO' },
        { code: 'PGM01', descricao: 'BLOCO 2', tempo: '00:15:00', type: 'RPRO' },
      ];

      const event = makeDropEvent('sidebar', '1001');
      app.dragDrop(event, 1);

      expect(state.roteiro).toHaveLength(3);
      expect(state.roteiro[1].code).toBe('1001');
      expect(state.roteiro[2].descricao).toBe('BLOCO 2');
    });

    it('reordena linhas arrastadas dentro do roteiro e limpa dragIdx', () => {
      state.roteiro = [
        { code: 'ITEM_A', descricao: 'Item A', tempo: '00:01:00', type: 'ECHE' },
        { code: 'ITEM_B', descricao: 'Item B', tempo: '00:02:00', type: 'ECHE' },
        { code: 'ITEM_C', descricao: 'Item C', tempo: '00:03:00', type: 'ECHE' },
      ];

      app.__test_setDragIdx(0); // Arrastando ITEM_A
      const event = makeDropEvent('roteiro', null);
      app.dragDrop(event, 2); // Soltando na posição do ITEM_C

      expect(state.roteiro.map(r => r.code)).toEqual(['ITEM_B', 'ITEM_C', 'ITEM_A']);
      expect(app.__test_getDragIdx()).toBeNull();
    });
  });

  describe('dragEnd — cancelamento e reset de estado', () => {
    it('reseta dragIdx para null após cancelamento de arrasto', () => {
      app.__test_setDragIdx(3);
      app.dragEnd({});
      expect(app.__test_getDragIdx()).toBeNull();
    });
  });

  describe('renderRoteiro — presença de manipuladores nos slots', () => {
    it('inclui manipuladores de drag nos slots e reseta o estado no dragend', () => {
      expect(src).toContain('if (isSlot) {');
      expect(src).toContain('ondragover=\"dragOver(event,${i})\"');
      expect(src).toContain('ondrop=\"dragDrop(event,${i})\"');
      expect(src).toContain('ondragend=\"dragEnd(event)\"');
    });
  });
});

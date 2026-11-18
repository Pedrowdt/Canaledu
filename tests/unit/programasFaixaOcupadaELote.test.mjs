import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import CsvImportador from '../../src/core/csvImportador.js';

const appSrc = readFileSync(new URL('../../pecas-programas.js', import.meta.url), 'utf8');

function makeFakeElement(id) {
  return {
    id,
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    focus() {},
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
    querySelectorAll: (selector) => {
      if (selector === '#dias-wrap .dia-btn' || selector === '#assinatura-wrap .dia-btn') {
        return [];
      }
      return [];
    },
  };
  const g = { addEventListener() {}, removeEventListener() {}, toast() {} };
  g.window = g;
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const factory = new Function(
    'window', 'globalThis', 'document', 'localStorage', 'console', 'setTimeout', 'clearTimeout', 'alert',
    `${appSrc}\nreturn {
      saveItem, openModal, closeModal,
      openBatchModal, closeBatchModal, toggleBatchFaixaInput, confirmarEdicaoLote,
      __test_setActiveTab: (t) => { activeTab = t; },
      __test_setPecas: (v) => { pecas = v; },
      __test_setProgramas: (v) => { programas = v; },
      __test_getPecas: () => pecas,
      __test_getProgramas: () => programas,
      __test_setSelectedCodes: (v) => { selectedCodes = new Set(v); },
      __test_getSelectedCodes: () => selectedCodes,
      __test_setRender: (f) => { render = f; },
      __test_setScheduleSync: (f) => { scheduleSync = f; },
    };`
  );
  const app = factory(g, g, document, localStorage, console, setTimeout, clearTimeout, () => {});
  return {
    app,
    document,
    setVal: (id, val) => {
      const el = document.getElementById(id);
      el.value = val;
      return el;
    },
    getVal: (id) => document.getElementById(id).value,
  };
}

describe('Cadastro de Programas — Faixa Ocupada', () => {
  let ctx;
  beforeEach(() => {
    ctx = loadApp();
    ctx.app.__test_setRender(() => {});
    ctx.app.__test_setScheduleSync(() => {});
    ctx.app.__test_setActiveTab('programas');
  });

  it('salva o campo faixaOcupada ao cadastrar um programa', () => {
    ctx.setVal('f-code', 'PRG001');
    ctx.setVal('f-desc', 'TV BRASIL ANIMADA - BLOCO 1');
    ctx.setVal('f-tempo', '00:15:00');
    ctx.setVal('f-type', 'RPRO');
    ctx.setVal('f-faixa-ocupada', 'TV Brasil Animada');

    ctx.app.saveItem();

    const progs = ctx.app.__test_getProgramas();
    expect(progs).toHaveLength(1);
    expect(progs[0].code).toBe('PRG001');
    expect(progs[0].descricao).toBe('TV BRASIL ANIMADA - BLOCO 1');
    expect(progs[0].faixaOcupada).toBe('TV Brasil Animada');
  });

  it('carrega faixaOcupada existente no formulário ao abrir openModal', () => {
    ctx.app.__test_setProgramas([
      { id: 'uuid-1', code: 'PRG001', descricao: 'Programa Matutino', faixaOcupada: 'Manhã das 08h às 12h', tempo: '00:30:00', type: 'RPRO' },
    ]);

    ctx.app.openModal('uuid-1');

    expect(ctx.getVal('f-code')).toBe('PRG001');
    expect(ctx.getVal('f-faixa-ocupada')).toBe('Manhã das 08h às 12h');
  });
});

describe('Alteração em Lote de Programas — Faixa Ocupada e Type', () => {
  let ctx;
  beforeEach(() => {
    ctx = loadApp();
    ctx.app.__test_setRender(() => {});
    ctx.app.__test_setScheduleSync(() => {});
    ctx.app.__test_setActiveTab('programas');
  });

  it('aplica alteração de faixa ocupada em lote apenas aos programas selecionados', () => {
    ctx.app.__test_setProgramas([
      { id: '1', code: 'P01', descricao: 'Prog 1', type: 'RPRO', faixaOcupada: '' },
      { id: '2', code: 'P02', descricao: 'Prog 2', type: 'RPRO', faixaOcupada: 'Antiga' },
      { id: '3', code: 'P03', descricao: 'Prog 3', type: 'RPRO', faixaOcupada: 'Outra' },
    ]);
    ctx.app.__test_setSelectedCodes(['P01', 'P02']);

    ctx.setVal('batch-f-type', '');
    ctx.setVal('batch-f-faixa-acao', 'definir');
    ctx.setVal('batch-f-faixa-valor', 'TV Brasil Animada');

    ctx.app.confirmarEdicaoLote();

    const progs = ctx.app.__test_getProgramas();
    expect(progs[0].faixaOcupada).toBe('TV Brasil Animada');
    expect(progs[1].faixaOcupada).toBe('TV Brasil Animada');
    expect(progs[2].faixaOcupada).toBe('Outra'); // Não selecionado, permanece intocado
  });

  it('permite limpar/remover a faixa ocupada em lote', () => {
    ctx.app.__test_setProgramas([
      { id: '1', code: 'P01', descricao: 'Prog 1', type: 'RPRO', faixaOcupada: 'Faixa das 16h' },
      { id: '2', code: 'P02', descricao: 'Prog 2', type: 'RPRO', faixaOcupada: 'Faixa das 16h' },
    ]);
    ctx.app.__test_setSelectedCodes(['P01', 'P02']);

    ctx.setVal('batch-f-type', '');
    ctx.setVal('batch-f-faixa-acao', 'limpar');

    ctx.app.confirmarEdicaoLote();

    const progs = ctx.app.__test_getProgramas();
    expect(progs[0].faixaOcupada).toBe('');
    expect(progs[1].faixaOcupada).toBe('');
  });

  it('permite alterar type e faixa ocupada conjuntamente em lote', () => {
    ctx.app.__test_setProgramas([
      { id: '1', code: 'P01', descricao: 'Prog 1', type: 'RPRO', faixaOcupada: '' },
    ]);
    ctx.app.__test_setSelectedCodes(['P01']);

    ctx.setVal('batch-f-type', 'EINT');
    ctx.setVal('batch-f-faixa-acao', 'definir');
    ctx.setVal('batch-f-faixa-valor', 'Interprogramas Tarde');

    ctx.app.confirmarEdicaoLote();

    const progs = ctx.app.__test_getProgramas();
    expect(progs[0].type).toBe('EINT');
    expect(progs[0].faixaOcupada).toBe('Interprogramas Tarde');
  });
});

describe('Importador CSV / XLSX — Coluna Faixa Ocupada', () => {
  it('detecta coluna FAIXA OCUPADA no cabeçalho do arquivo', () => {
    const headers = ['Code', 'Descrição', 'Tempo', 'Type', 'Faixa Ocupada'];
    const colunas = CsvImportador.detectarColunas(headers);
    expect(colunas.code).toBe(0);
    expect(colunas.desc).toBe(1);
    expect(colunas.tempo).toBe(2);
    expect(colunas.type).toBe(3);
    expect(colunas.faixa).toBe(4);
  });

  it('detecta variações de cabeçalho como FAIXA e SLOT', () => {
    expect(CsvImportador.detectarColunas(['COD', 'TITULO', 'DURACAO', 'FAIXA']).faixa).toBe(3);
    expect(CsvImportador.detectarColunas(['COD', 'TITULO', 'DURACAO', 'SLOT']).faixa).toBe(3);
    expect(CsvImportador.detectarColunas(['COD', 'TITULO', 'DURACAO', 'HORARIO']).faixa).toBe(3);
  });

  it('extrai faixaOcupada ao importar programas (isPecas = false)', () => {
    const rows = [
      ['Code', 'Programa', 'Tempo', 'Tipo', 'Faixa Ocupada'],
      ['PRG101', 'DESENHO ANIMADO EP 1', '00:15:00', 'RPRO', 'TV Brasil Animada'],
      ['PRG102', 'DESENHO ANIMADO EP 2', '00:15:00', 'RPRO', 'TV Brasil Animada'],
    ];

    const res = CsvImportador.analisarImportacao({
      rows,
      itensExistentes: [],
      isPecas: false,
    });

    expect(res.valido).toBe(true);
    expect(res.totalNovos).toBe(2);
    expect(res.novosItens[0].faixaOcupada).toBe('TV Brasil Animada');
    expect(res.novosItens[1].faixaOcupada).toBe('TV Brasil Animada');
    expect(res.amostra[0].faixaOcupada).toBe('TV Brasil Animada');
  });

  it('define faixaOcupada vazia quando a coluna não estiver presente no arquivo', () => {
    const rows = [
      ['Code', 'Programa', 'Tempo', 'Tipo'],
      ['PRG201', 'JORNAL DA NOITE', '00:30:00', 'RPRO'],
    ];

    const res = CsvImportador.analisarImportacao({
      rows,
      itensExistentes: [],
      isPecas: false,
    });

    expect(res.valido).toBe(true);
    expect(res.novosItens[0].faixaOcupada).toBe('');
  });
});

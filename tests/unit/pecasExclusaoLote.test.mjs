import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const appSrc = readFileSync(new URL('../../pecas-programas.js', import.meta.url), 'utf8');

describe('Exclusão e Ações em Lote na tela de Peças e Programas', () => {
  function makeHarness(initialPecas = [], initialProgramas = []) {
    const elements = new Map();
    const makeEl = (id) => ({
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      style: {},
      checked: false,
      classList: { add() {}, remove() {}, toggle() {} },
      focus() {},
      addEventListener() {},
    });

    const doc = {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, makeEl(id));
        return elements.get(id);
      },
      querySelectorAll() {
        return [];
      },
    };

    const g = { addEventListener() {}, removeEventListener() {}, toast() {} };
    g.window = g;

    let syncScheduled = false;
    let deletedMarked = [];

    const factory = new Function(
      'window',
      'globalThis',
      'document',
      'localStorage',
      'console',
      'setTimeout',
      'clearTimeout',
      'alert',
      'confirm',
      `${appSrc}
      return {
        executarAcaoLote,
        toggleSelectRow,
        toggleSelectAll,
        limparSelecao,
        selecionarSugeridosLimpeza,
        toggleFiltroDuplicados,
        getSelectedCodes: () => selectedCodes,
        __setPecas: (v) => { pecas = v; },
        __getPecas: () => pecas,
        __setProgramas: (v) => { programas = v; },
        __getProgramas: () => programas,
        __getDeletedPecas: () => deletedPecas,
        __getDeletedProgramas: () => deletedProgramas,
        __setRender: (f) => { render = f; },
        __setScheduleSync: (f) => { scheduleSync = f; },
      };`
    );

    let confirmChoice = true;
    const app = factory(
      g,
      g,
      doc,
      { getItem: () => null, setItem() {}, removeItem() {} },
      console,
      setTimeout,
      clearTimeout,
      () => {},
      () => confirmChoice
    );

    app.__setPecas([...initialPecas]);
    app.__setProgramas([...initialProgramas]);
    app.__setRender(() => {});
    app.__setScheduleSync(() => {
      syncScheduled = true;
    });

    return {
      app,
      doc,
      elements,
      setConfirmChoice: (v) => {
        confirmChoice = v;
      },
      isSyncScheduled: () => syncScheduled,
    };
  }

  it('exclui em lote as peças selecionadas, atualiza a lista e marca para exclusão na nuvem', () => {
    const { app, isSyncScheduled } = makeHarness([
      { code: 'VH_TB01', descricao: 'Vinheta TV Brasil Internacional' },
      { code: 'VH_TB02', descricao: 'Chamada TV Brasil Internacional' },
      { code: '89001', descricao: 'Peça Canal Educação 1' },
      { code: '89002', descricao: 'Peça Canal Educação 2' },
    ]);

    // Seleciona duas peças
    app.toggleSelectRow('VH_TB01', true);
    app.toggleSelectRow('VH_TB02', true);

    expect(app.getSelectedCodes().size).toBe(2);

    // Executa a exclusão em lote
    app.executarAcaoLote('excluir');

    // Confere que foram removidas da lista em memória
    const restantes = app.__getPecas();
    expect(restantes.map((p) => p.code)).toEqual(['89001', '89002']);

    // Confere que foram marcadas para exclusão do delta
    expect(app.__getDeletedPecas()).toContain('VH_TB01');
    expect(app.__getDeletedPecas()).toContain('VH_TB02');

    // Confere que a seleção foi limpa e sync agendado
    expect(app.getSelectedCodes().size).toBe(0);
    expect(isSyncScheduled()).toBe(true);
  });

  it('não exclui itens quando o usuário cancela a confirmação', () => {
    const { app, setConfirmChoice, isSyncScheduled } = makeHarness([
      { code: 'VH_01', descricao: 'Peça 1' },
      { code: 'VH_02', descricao: 'Peça 2' },
    ]);

    app.toggleSelectRow('VH_01', true);
    setConfirmChoice(false); // Usuário clica em 'Cancelar' no confirm()

    app.executarAcaoLote('excluir');

    // Nenhum item excluído
    expect(app.__getPecas()).toHaveLength(2);
    expect(app.__getDeletedPecas()).toHaveLength(0);
    expect(app.getSelectedCodes().size).toBe(1);
  });

  it('permite desativar em lote os itens selecionados', () => {
    const { app, isSyncScheduled } = makeHarness([
      { code: '101', descricao: 'Peça A', ativo: true },
      { code: '102', descricao: 'Peça B', ativo: true },
      { code: '103', descricao: 'Peça C', ativo: true },
    ]);

    app.toggleSelectRow('101', true);
    app.toggleSelectRow('103', true);

    app.executarAcaoLote('desativar');

    const lista = app.__getPecas();
    expect(lista.find((p) => p.code === '101').ativo).toBe(false);
    expect(lista.find((p) => p.code === '102').ativo).toBe(true);
    expect(lista.find((p) => p.code === '103').ativo).toBe(false);

    expect(isSyncScheduled()).toBe(true);
  });
});

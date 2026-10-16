import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const srcSemBoot = src.replace(/\ninit\(\);\s*$/, '\n');

function loadPure({ localStorage, domElements = {} } = {}) {
  const g = { addEventListener() {}, removeEventListener() {} };
  g.window = g;
  const ls = localStorage || {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  const elements = { ...domElements };

  function getOrCreateEl(id) {
    if (elements[id]) return elements[id];
    elements[id] = {
      id,
      style: { display: '' },
      classList: { add() {}, remove() {}, toggle() {} },
      textContent: '',
      innerHTML: '',
      value: '',
      checked: false,
      disabled: false,
      appendChild() {},
      querySelector: () => null,
      querySelectorAll: () => [],
    };
    return elements[id];
  }

  const document = {
    querySelectorAll: () => [],
    querySelector: (sel) => {
      if (sel === 'input[name="import-roteiro-pick"]:checked') {
        return elements['import-radio-checked'] || null;
      }
      return null;
    },
    getElementById: (id) => getOrCreateEl(id),
    createElement: () => ({ style: {}, classList: { add() {} } }),
    body: { appendChild() {} },
  };

  const confirm = () => true;
  const factory = new Function(
    'window',
    'globalThis',
    'localStorage',
    'document',
    'confirm',
    `${srcSemBoot}\nreturn {
      dateKey, formatDataLegivel, openCopiarRoteiroModal, executarCopiarRoteiro,
      importJSON, abrirImportRoteiroModal, confirmarImportRoteiroData, fecharImportRoteiroModal,
      undoLastAction, saveState,
      __test_getState: () => state,
      __test_setState: (v) => { Object.assign(state, v); },
      __test_getPendingImport: () => _pendingImportData,
      __test_setPendingImport: (v) => { _pendingImportData = v; },
      __test_getUndoStack: () => undoStack,
    };`
  );

  return { app: factory.call(g, g.window, g, ls, document, confirm), elements };
}

function makeLocalStorage(seed = {}) {
  const store = new Map();
  for (const [k, v] of Object.entries(seed)) {
    store.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    _store: store,
  };
}

describe('Recurso: Copiar Roteiro de Outro Dia e Importação Flexível', () => {
  it('formatDataLegivel formata chaves YYYY-MM-DD e Date em português legível', () => {
    const { app } = loadPure();
    expect(app.formatDataLegivel('2026-10-16')).toBe('Sexta, 16/10/2026');
    expect(app.formatDataLegivel('2026-10-17')).toBe('Sábado, 17/10/2026');
    expect(app.formatDataLegivel(new Date(2026, 9, 16))).toBe('Sexta, 16/10/2026');
  });

  it('openCopiarRoteiroModal popula a lista de dias disponíveis e alerta substituição', () => {
    const ls = makeLocalStorage({
      roteiroApp: {
        roteiros: {
          '2026-10-16': [{ code: '100', descricao: 'Peca 1' }, { code: '200', descricao: 'Peca 2' }],
          '2026-10-17': [{ code: '300', descricao: 'Peca Atual' }],
        },
      },
    });

    const { app, elements } = loadPure({ localStorage: ls });
    app.__test_setState({
      currentDate: new Date(2026, 9, 17), // 17/10/2026
      roteiro: [{ code: '300', descricao: 'Peca Atual' }],
    });

    app.openCopiarRoteiroModal();

    expect(elements['copiar-destino-info'].textContent).toContain('17/10/2026 (1 itens)');
    expect(elements['copiar-destino-alerta'].style.display).toBe('block');
    expect(elements['copiar-origem-select'].style.display).toBe('block');
    expect(elements['copiar-origem-select'].innerHTML).toContain('2026-10-16');
    expect(elements['btn-confirmar-copiar-roteiro'].disabled).toBe(false);
    expect(elements['modal-copiar-roteiro'].style.display).toBe('flex');
  });

  it('openCopiarRoteiroModal desabilita confirmação se não houver outros dias com roteiro', () => {
    const ls = makeLocalStorage({
      roteiroApp: {
        roteiros: {
          '2026-10-17': [{ code: '300', descricao: 'Peca Atual' }],
        },
      },
    });

    const { app, elements } = loadPure({ localStorage: ls });
    app.__test_setState({
      currentDate: new Date(2026, 9, 17),
      roteiro: [{ code: '300', descricao: 'Peca Atual' }],
    });

    app.openCopiarRoteiroModal();

    expect(elements['copiar-origem-select'].style.display).toBe('none');
    expect(elements['copiar-sem-origem'].style.display).toBe('block');
    expect(elements['btn-confirmar-copiar-roteiro'].disabled).toBe(true);
  });

  it('executarCopiarRoteiro copia roteiro entre datas com deep copy e suporte a desfazer (undo)', () => {
    const roteiroOrigem = [
      { code: 'A1', descricao: 'Programa A', type: 'RPRO', tempo: '00:30:00' },
      { code: 'B1', descricao: 'Chamada B', type: 'ECHM', tempo: '00:00:30' },
    ];

    const ls = makeLocalStorage({
      roteiroApp: {
        roteiros: {
          '2026-10-16': roteiroOrigem,
          '2026-10-17': [{ code: 'VELHO', descricao: 'Antigo' }],
        },
        pecasDia: {
          '2026-10-16': [{ code: 'PD1', nome: 'Peca Dia' }],
        },
      },
    });

    const { app } = loadPure({ localStorage: ls });
    app.__test_setState({
      currentDate: new Date(2026, 9, 17), // Destino: 17
      roteiro: [{ code: 'VELHO', descricao: 'Antigo' }],
    });

    const res = app.executarCopiarRoteiro('2026-10-16', true);
    expect(res.success).toBe(true);
    expect(res.count).toBe(2);

    // O roteiro ativo agora deve ter os itens do dia 16
    const st = app.__test_getState();
    expect(st.roteiro).toHaveLength(2);
    expect(st.roteiro[0].code).toBe('A1');
    expect(st.pecasDia[0].code).toBe('PD1');

    // Salvo no localStorage
    const saved = JSON.parse(ls.getItem('roteiroApp'));
    expect(saved.roteiros['2026-10-17']).toHaveLength(2);
    expect(saved.roteiros['2026-10-17'][0].code).toBe('A1');

    // Desfazer (undo) reverte para o estado anterior
    const undos = app.__test_getUndoStack();
    expect(undos.some((u) => u.dateKey === '2026-10-17')).toBe(true);

    app.undoLastAction();
    const stDesfeito = app.__test_getState();
    expect(stDesfeito.roteiro[0].code).toBe('VELHO');
  });

  it('importJSON mescla todas as datas do backup no localStorage sem perder roteiros', () => {
    const ls = makeLocalStorage({
      roteiroApp: {
        roteiros: {
          '2026-10-10': [{ code: 'LOCAL_10', descricao: 'Dia 10 Local' }],
        },
      },
    });

    const { app } = loadPure({ localStorage: ls });
    app.__test_setState({
      currentDate: new Date(2026, 9, 17),
      roteiro: [],
    });

    const backupJson = JSON.stringify({
      pecas: [{ code: 'P1' }],
      programas: [{ code: 'PG1' }],
      roteiros: {
        '2026-10-16': [{ code: 'ROT_16', descricao: 'Dia 16' }],
        '2026-10-17': [{ code: 'ROT_17', descricao: 'Dia 17' }],
      },
    });

    const res = app.importJSON(backupJson);
    expect(res.success).toBe(true);

    const saved = JSON.parse(ls.getItem('roteiroApp'));
    // Deve conter o local pré-existente E os dois importados
    expect(saved.roteiros['2026-10-10']).toBeDefined();
    expect(saved.roteiros['2026-10-16']).toBeDefined();
    expect(saved.roteiros['2026-10-17']).toBeDefined();
  });

  it('importJSON abre modal de escolha quando o backup tem roteiros em datas divergentes da data ativa', () => {
    const ls = makeLocalStorage();
    const { app, elements } = loadPure({ localStorage: ls });

    // Usuário está visualizando 17/10/2026
    app.__test_setState({
      currentDate: new Date(2026, 9, 17),
      roteiro: [],
    });

    // Backup contém roteiro trabalhado em 16/10/2026
    const backupJson = JSON.stringify({
      roteiros: {
        '2026-10-16': [{ code: 'PGM1', descricao: 'Trabalho do dia 16', type: 'RPRO' }],
      },
    });

    const res = app.importJSON(backupJson);
    expect(res.pendingModal).toBe(true);
    expect(elements['modal-import-roteiro-data'].style.display).toBe('flex');
    expect(elements['import-options-container'].innerHTML).toContain('2026-10-16');

    // Ao confirmar, carrega o dia 16 para o dia ativo (17)
    elements['import-radio-checked'] = { value: '2026-10-16' };
    const confirmRes = app.confirmarImportRoteiroData('2026-10-16');
    expect(confirmRes.success).toBe(true);

    const st = app.__test_getState();
    expect(st.roteiro[0].code).toBe('PGM1');

    const saved = JSON.parse(ls.getItem('roteiroApp'));
    expect(saved.roteiros['2026-10-17'][0].code).toBe('PGM1');
  });
});

describe('Caso Real: Backup do usuário com trabalho feito no dia 16 para aplicar no dia 17', () => {
  it('carrega o roteiro de 2026-10-16 (467 itens) para o dia 2026-10-17 através do modal de importação', () => {
    const rawBackup = readFileSync('/mnt/user-uploads/roteiro-canal-educacao-backup_17.json', 'utf8');
    const ls = makeLocalStorage();
    const { app, elements } = loadPure({ localStorage: ls });

    // Usuário abre o dia 17
    app.__test_setState({
      currentDate: new Date(2026, 9, 17),
      roteiro: [],
    });

    const res = app.importJSON(rawBackup);
    expect(res.pendingModal).toBe(true);
    expect(elements['modal-import-roteiro-data'].style.display).toBe('flex');
    expect(elements['import-options-container'].innerHTML).toContain('2026-10-16');
    expect(elements['import-options-container'].innerHTML).toContain('467 itens');

    // Usuário seleciona o dia 16 para carregar no dia 17
    const confirmRes = app.confirmarImportRoteiroData('2026-10-16');
    expect(confirmRes.success).toBe(true);
    expect(confirmRes.origem).toBe('2026-10-16');
    expect(confirmRes.destino).toBe('2026-10-17');
    expect(confirmRes.count).toBe(467);

    // O dia ativo agora tem os 467 itens concluídos
    const st = app.__test_getState();
    expect(st.roteiro).toHaveLength(467);
    const slots = st.roteiro.filter((it) => it.type === '__SLOT__');
    expect(slots).toHaveLength(0);

    // E no localStorage, a chave 2026-10-17 foi salva com os 467 itens
    const saved = JSON.parse(ls.getItem('roteiroApp'));
    expect(saved.roteiros['2026-10-17']).toHaveLength(467);
  });

  it('permite copiar diretamente do dia 16 para o dia 17 pelo botão Copiar de outro dia', () => {
    const rawBackup = JSON.parse(readFileSync('/mnt/user-uploads/roteiro-canal-educacao-backup_17.json', 'utf8'));
    // Supor que o usuário já tinha o dia 16 salvo no app
    const ls = makeLocalStorage({
      roteiroApp: {
        roteiros: {
          '2026-10-16': rawBackup.roteiros['2026-10-16'],
          '2026-10-17': rawBackup.roteiros['2026-10-17'], // 414 itens com slots vazios
        },
      },
    });

    const { app, elements } = loadPure({ localStorage: ls });
    app.__test_setState({
      currentDate: new Date(2026, 9, 17),
      roteiro: rawBackup.roteiros['2026-10-17'],
    });

    app.openCopiarRoteiroModal();
    expect(elements['copiar-origem-select'].innerHTML).toContain('2026-10-16');
    expect(elements['copiar-origem-select'].innerHTML).toContain('467 itens');

    const copyRes = app.executarCopiarRoteiro('2026-10-16');
    expect(copyRes.success).toBe(true);
    expect(copyRes.count).toBe(467);

    const st = app.__test_getState();
    expect(st.roteiro).toHaveLength(467);
  });
});

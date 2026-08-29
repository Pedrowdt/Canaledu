// Bug relatado: em Peças e Programas, editar/excluir e, antes do envio (nas
// primeiras 700ms), a página recarregar por qualquer motivo — o caso citado
// foi outra pessoa logando no MESMO navegador, o que dispara SIGNED_OUT e um
// location.reload() automático — descartava silenciosamente tudo que ainda
// não tinha sido confirmado no banco. Como a exclusão nunca chegou a sair,
// o reload trazia de volta exatamente a peça "excluída".
//
// pecas-programas.js é um script clássico (sem `import`/`export`); extraímos
// as funções relevantes com o mesmo padrão usado nos outros arquivos desta
// suíte (new Function + mocks mínimos). O IIFE `boot()` do topo do arquivo é
// assíncrono e, sem CanalAuth definido, ele mesmo cai no catch e retorna sem
// nenhum efeito colateral — não precisa ser removido do texto do script.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../pecas-programas.js', import.meta.url), 'utf8');

function makeFakeElement() {
  return {
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    textContent: '',
    value: '',
  };
}

function makeLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    _store: store,
  };
}

function loadApp({ localStorage, saveDeltaImpl } = {}) {
  const ls = localStorage || makeLocalStorage();
  const savedCalls = [];
  const PecasRepo = {
    async saveDelta(payload) {
      savedCalls.push(payload);
      if (saveDeltaImpl) return saveDeltaImpl(payload);
      return { aplicados: 1, removidos: (payload.deletedPecas || []).length + (payload.deletedProgramas || []).length, conflitos: [] };
    },
    async loadAll() {
      // Estado "atual" do banco: sem os itens que a sessão anterior tinha
      // tentado excluir (porque o DELETE nunca chegou a sair).
      return { pecas: [{ id: 'x1', code: 'PEC_QUE_DEVERIA_TER_SIDO_EXCLUIDA', descricao: 'Ainda no banco', tempo: '00:00:30' }], programas: [] };
    },
  };
  const g = { addEventListener() {}, removeEventListener() {} };
  g.window = g;
  const document = { getElementById: () => makeFakeElement(), querySelectorAll: () => [] };
  const factory = new Function(
    'window', 'globalThis', 'document', 'localStorage', 'console', 'setTimeout', 'clearTimeout', 'PecasRepo',
    `${src}\nreturn {
      persistirRascunho, limparRascunho, haRascunhoPendente, lerRascunho,
      restaurarRascunhoPendenteSeExistir, flushPendingSync, scheduleSync, loadFromCloud,
      __test_setCurrentUser: (u) => { currentUser = u; },
      __test_getPecas: () => pecas,
      __test_setPecas: (v) => { pecas = v; },
      __test_getDeletedPecas: () => deletedPecas,
      __test_setDeletedPecas: (v) => { deletedPecas = v; },
      __test_getPushTimer: () => pushTimer,
      __test_getSavedCalls: () => savedCalls,
    };`
  );
  const app = factory.call(g, g.window, g, document, ls, console, setTimeout, clearTimeout, PecasRepo);
  app.__test_setCurrentUser({ id: 'user-1', email: 'user@teste.com' });
  return { app, localStorage: ls, savedCalls };
}

describe('rascunho pendente — persistência local de segurança em Peças e Programas', () => {
  it('scheduleSync() grava o rascunho de forma síncrona, antes do debounce de 700ms', () => {
    const { app } = loadApp();
    app.__test_setPecas([{ code: 'A', descricao: 'Peça A' }]);
    app.__test_setDeletedPecas(['B']); // peça B acabou de ser excluída
    expect(app.haRascunhoPendente()).toBe(false);

    app.scheduleSync();

    expect(app.haRascunhoPendente()).toBe(true); // já marcado, sem esperar o timer
    const rascunho = app.lerRascunho();
    expect(rascunho.deletedPecas).toEqual(['B']);
    expect(rascunho.pecas).toEqual([{ code: 'A', descricao: 'Peça A' }]);
    clearTimeout(app.__test_getPushTimer());
  });

  it('pushToCloud() bem-sucedido limpa a marca de pendência', async () => {
    const { app } = loadApp();
    app.__test_setPecas([{ code: 'A' }]);
    app.__test_setDeletedPecas(['B']);
    app.scheduleSync();
    clearTimeout(app.__test_getPushTimer()); // não precisamos esperar os 700ms neste teste

    await app.flushPendingSync();

    expect(app.haRascunhoPendente()).toBe(false);
    expect(app.lerRascunho()).toBeNull();
  });

  it('bug original: uma exclusão pendente não confirmada é recuperada em vez de "voltar"', async () => {
    const local = makeLocalStorage();
    // Simula o estado deixado pela sessão anterior: exclusão feita, mas o
    // reload (SIGNED_OUT de outra pessoa logando) aconteceu antes do envio.
    local.setItem('cadastroRascunho', JSON.stringify({
      pecas: [], // a sessão anterior já tinha removido a peça da lista local
      programas: [],
      deletedPecas: ['PEC_QUE_DEVERIA_TER_SIDO_EXCLUIDA'],
      deletedProgramas: [],
      email: 'sessao-anterior@teste.com',
    }));
    local.setItem('cadastroSyncPendente', '1');

    const { app, savedCalls } = loadApp({ localStorage: local });

    // startApp() faria loadFromCloud() e depois isso:
    await app.loadFromCloud();
    expect(app.__test_getPecas().some((p) => p.code === 'PEC_QUE_DEVERIA_TER_SIDO_EXCLUIDA')).toBe(true); // "voltou" da nuvem

    app.restaurarRascunhoPendenteSeExistir();
    clearTimeout(app.__test_getPushTimer());

    // O rascunho (sem a peça) prevalece sobre o que a nuvem tinha mandado.
    expect(app.__test_getPecas().some((p) => p.code === 'PEC_QUE_DEVERIA_TER_SIDO_EXCLUIDA')).toBe(false);
    expect(app.__test_getDeletedPecas()).toEqual(['PEC_QUE_DEVERIA_TER_SIDO_EXCLUIDA']);

    // E o reenvio foi agendado (rascunho gravado de novo, pronto pro pushToCloud do timer).
    expect(app.haRascunhoPendente()).toBe(true);
  });

  it('sem rascunho pendente, loadFromCloud() não é alterado por restaurarRascunhoPendenteSeExistir()', async () => {
    const { app } = loadApp();
    await app.loadFromCloud();
    const antes = app.__test_getPecas();
    app.restaurarRascunhoPendenteSeExistir();
    expect(app.__test_getPecas()).toBe(antes); // nenhuma mutação — nada pendente para restaurar
  });

  it('flushPendingSync() cancela o timer e envia imediatamente', async () => {
    const { app, savedCalls } = loadApp();
    app.__test_setDeletedPecas(['X']);
    app.scheduleSync();
    expect(app.__test_getPushTimer()).not.toBeNull();

    await app.flushPendingSync();

    expect(savedCalls).toHaveLength(1);
    expect(savedCalls[0].deletedPecas).toEqual(['X']);
    expect(app.haRascunhoPendente()).toBe(false);
  });
});

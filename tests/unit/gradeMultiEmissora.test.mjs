import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const CLOUD_SYNC_SRC = readFileSync(new URL('../../cloud-sync.js', import.meta.url), 'utf8');

function makeFakeElement() {
  return {
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    appendChild() {},
    value: '',
    textContent: '',
    disabled: false,
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

function makeSupabaseMock(userDataMap = {}) {
  let currentEmissoraId = null;
  function builder(table) {
    const b = {
      select() { return b; },
      eq(col, val) {
        if (col === 'emissora_id') currentEmissoraId = val;
        return b;
      },
      async maybeSingle() {
        if (table === 'user_data') {
          return { data: userDataMap[currentEmissoraId] || null };
        }
        return { data: null };
      },
      update(payload) {
        if (table === 'user_data' && currentEmissoraId) {
          userDataMap[currentEmissoraId] = { ...(userDataMap[currentEmissoraId] || {}), ...payload };
        }
        return b;
      },
      async upsert(payload) {
        if (table === 'user_data') {
          const eid = payload.emissora_id || currentEmissoraId;
          userDataMap[eid] = { ...(userDataMap[eid] || {}), ...payload };
        }
        return { data: null };
      },
    };
    return b;
  }
  return { from: builder, userDataMap };
}

describe('Isolamento de grade multi-emissora', () => {
  it('salva a grade na chave específica da emissora ativa e não contamina outras emissoras', async () => {
    const ls = makeLocalStorage();
    const ID_CANAL_EDU = '00000000-0000-0000-0000-000000000001';
    const ID_TV_BRASIL = '9f033fde-2738-4df5-b5d8-752baae5d911';

    let emissoraAtivaId = ID_TV_BRASIL;
    const fakeContext = {
      getEmissoraAtivaId: () => emissoraAtivaId,
      setEmissoraAtivaId: (id) => { emissoraAtivaId = id; },
      getEmissorasCache: () => [
        { id: ID_CANAL_EDU, nome: 'Canal Educação', slug: 'canaledu' },
        { id: ID_TV_BRASIL, nome: 'TV Brasil', slug: 'tvbr' },
      ],
    };

    const userDataMap = {
      [ID_CANAL_EDU]: {
        grade_by_day: { 1: { 'PGM EDU': '08:00:00' } },
        grade_order_by_day: { 1: ['PGM EDU'] },
      },
      [ID_TV_BRASIL]: {
        grade_by_day: { 1: { 'PGM BRASIL': '10:00:00' } },
        grade_order_by_day: { 1: ['PGM BRASIL'] },
      },
    };

    const fakeSupabase = makeSupabaseMock(userDataMap);

    const g = {
      document: { getElementById: () => makeFakeElement() },
      location: { href: '', reload() {} },
      addEventListener() {},
      removeEventListener() {},
      EmissoraContext: fakeContext,
      getRoteiroStorageKey: () => `roteiroApp_${emissoraAtivaId}`,
      CanalAuth: {
        getClient: () => fakeSupabase,
        onAuthChange() {},
        resolveSession: async () => null,
      },
      RoteiroPecasBridge: {
        async carregarCadastro() { return { pecas: [], programas: [], origem: 'teste' }; },
        mergeCadastro(local) { return { pecas: local.pecas || [], programas: local.programas || [] }; },
      },
      localStorage: ls,
      console,
      setTimeout,
      clearTimeout,
      WORKSPACE_ID: 'workspace-teste',
    };
    g.window = g;

    const body = `${CLOUD_SYNC_SRC}
      function __test_setCurrentUser(u) { currentUser = u; }
      return { fetchAndMergeCloudData, pushToCloud, patchLocalStorage, __test_setCurrentUser };`;
    const factory = new Function(
      'window', 'globalThis', 'document', 'location', 'CanalAuth',
      'RoteiroPecasBridge', 'localStorage', 'console', 'setTimeout', 'clearTimeout',
      'WORKSPACE_ID', 'EmissoraContext', 'getRoteiroStorageKey',
      body
    );
    const cs = factory.call(
      g, g.window, g, g.document, g.location, g.CanalAuth,
      g.RoteiroPecasBridge, g.localStorage, g.console, g.setTimeout, g.clearTimeout,
      g.WORKSPACE_ID, fakeContext, g.getRoteiroStorageKey
    );
    cs.__test_setCurrentUser({ id: 'user-1', email: 'user@teste.com' });

    // 1. Carrega dados enquanto TV Brasil está ativa
    await cs.fetchAndMergeCloudData({ id: 'user-1' });

    const tvData = JSON.parse(ls.getItem(`roteiroApp_${ID_TV_BRASIL}`));
    expect(tvData.gradeByDay[1]).toEqual({ 'PGM BRASIL': '10:00:00' });

    // 2. Alterna para Canal Educação
    emissoraAtivaId = ID_CANAL_EDU;
    await cs.fetchAndMergeCloudData({ id: 'user-1' });

    const eduData = JSON.parse(ls.getItem(`roteiroApp_${ID_CANAL_EDU}`));
    expect(eduData.gradeByDay[1]).toEqual({ 'PGM EDU': '08:00:00' });

    // 3. Garante que os dados da TV Brasil permaneceram intocados no storage local
    const tvDataCheck = JSON.parse(ls.getItem(`roteiroApp_${ID_TV_BRASIL}`));
    expect(tvDataCheck.gradeByDay[1]).toEqual({ 'PGM BRASIL': '10:00:00' });
  });
});

  it('uma emissora sem grade cadastrada NUNCA herda a grade do Canal Educação nem dados legados', async () => {
    const ls = makeLocalStorage();
    const ID_CANAL_EDU = '00000000-0000-0000-0000-000000000001';
    const ID_NOVA_EMISSORA = 'a1b2c3d4-e5f6-4a5b-8c9d-0123456789ab';

    // Simula que no localStorage legado existe uma grade do Canal Educação
    ls.setItem('roteiroApp', JSON.stringify({
      gradeByDay: { 1: { 'TELECURSO': '06:00:00' } },
      gradeOrderByDay: { 1: ['TELECURSO'] },
    }));

    let emissoraAtivaId = ID_NOVA_EMISSORA;
    const fakeContext = {
      getEmissoraAtivaId: () => emissoraAtivaId,
      setEmissoraAtivaId: (id) => { emissoraAtivaId = id; },
      getEmissorasCache: () => [
        { id: ID_CANAL_EDU, nome: 'Canal Educação', slug: 'canaledu' },
        { id: ID_NOVA_EMISSORA, nome: 'Nova Emissora', slug: 'nova' },
      ],
    };

    const userDataMap = {
      // Nova emissora não tem dados em user_data
    };

    const fakeSupabase = makeSupabaseMock(userDataMap);

    const g = {
      document: { getElementById: () => makeFakeElement() },
      location: { href: '', reload() {} },
      addEventListener() {},
      removeEventListener() {},
      EmissoraContext: fakeContext,
      getRoteiroStorageKey: () => `roteiroApp_${emissoraAtivaId}`,
      CanalAuth: {
        getClient: () => fakeSupabase,
        onAuthChange() {},
        resolveSession: async () => null,
      },
      RoteiroPecasBridge: {
        async carregarCadastro() { return { pecas: [], programas: [], origem: 'teste' }; },
        mergeCadastro(local) { return { pecas: local.pecas || [], programas: local.programas || [] }; },
      },
      localStorage: ls,
      console,
      setTimeout,
      clearTimeout,
      WORKSPACE_ID: 'workspace-teste',
    };
    g.window = g;

    const body = `${CLOUD_SYNC_SRC}
      function __test_setCurrentUser(u) { currentUser = u; }
      return { fetchAndMergeCloudData, pushToCloud, patchLocalStorage, __test_setCurrentUser };`;
    const factory = new Function(
      'window', 'globalThis', 'document', 'location', 'CanalAuth',
      'RoteiroPecasBridge', 'localStorage', 'console', 'setTimeout', 'clearTimeout',
      'WORKSPACE_ID', 'EmissoraContext', 'getRoteiroStorageKey',
      body
    );
    const cs = factory.call(
      g, g.window, g, g.document, g.location, g.CanalAuth,
      g.RoteiroPecasBridge, g.localStorage, g.console, g.setTimeout, g.clearTimeout,
      g.WORKSPACE_ID, fakeContext, g.getRoteiroStorageKey
    );
    cs.__test_setCurrentUser({ id: 'user-1', email: 'user@teste.com' });

    await cs.fetchAndMergeCloudData({ id: 'user-1' });

    const novaData = JSON.parse(ls.getItem(`roteiroApp_${ID_NOVA_EMISSORA}`) || '{}');
    // Deve ser vazio, NUNCA herdando TELECURSO
    expect(novaData.gradeByDay || {}).toEqual({});
  });

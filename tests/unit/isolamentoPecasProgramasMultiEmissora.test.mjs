import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const APP_SRC = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const CLOUD_SYNC_SRC = readFileSync(new URL('../../cloud-sync.js', import.meta.url), 'utf8');
const BRIDGE_SRC = readFileSync(new URL('../../roteiro-pecas-bridge.js', import.meta.url), 'utf8');

function makeFakeElement() {
  return {
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    appendChild() {},
    value: '',
    textContent: '',
    disabled: false,
    innerHTML: '',
  };
}

function makeLocalStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    _store: store,
  };
}

describe('Isolamento de Peças, Programas e Peças do Dia entre Emissoras', () => {
  it('RoteiroPecasBridge.mergeCadastro para outra emissora autoritativa com 0 peças resulta em 0 peças', () => {
    const bridgeModule = {};
    new Function('window', 'globalThis', BRIDGE_SRC).call(bridgeModule, bridgeModule, bridgeModule);
    const bridge = bridgeModule.RoteiroPecasBridge;

    const baseContaminado = {
      pecas: [{ code: '88988', descricao: 'CH MANUT CANAL EDU' }],
      programas: [{ code: 'CE136463_1', descricao: 'PGM VIDA DE MERENDEIRA' }],
    };

    const cadastroRemotoVazioTVBrasil = {
      pecas: [],
      programas: [],
      origem: 'relacional',
      autoritativo: true,
      emissoraId: '9f033fde-2738-4df5-b5d8-752baae5d911',
    };

    const resultado = bridge.mergeCadastro(baseContaminado, cadastroRemotoVazioTVBrasil, null, {
      emissoraId: '9f033fde-2738-4df5-b5d8-752baae5d911',
    });

    expect(resultado.pecas).toEqual([]);
    expect(resultado.programas).toEqual([]);
  });

  it('fetchAndMergeCloudData não herda peças do Canal Educação nem pecas_dia para uma emissora secundária', async () => {
    const tbcId = '9f033fde-2738-4df5-b5d8-752baae5d911';
    const ls = makeLocalStorage({
      // LocalStorage contaminado com dados legados
      [`roteiroApp_${tbcId}`]: JSON.stringify({
        pecas: [{ code: '88988', descricao: 'CANAL EDU' }],
        programas: [{ code: 'CE136463_1', descricao: 'CANAL EDU PGM' }],
        pecasDia: { '2026-11-05': [{ code: '88988' }] },
      }),
      roteiroApp: JSON.stringify({
        pecas: [{ code: '88988', descricao: 'CANAL EDU' }],
        programas: [{ code: 'CE136463_1', descricao: 'CANAL EDU PGM' }],
        pecasDia: { '2026-11-05': [{ code: '88988' }] },
      }),
    });

    const fakeSupabase = {
      from(table) {
        const b = {
          select() { return b; },
          eq() { return b; },
          async maybeSingle() {
            if (table === 'shared_data') {
              return { data: { pecas: [{ code: '88988' }], programas: [{ code: 'CE1' }] } };
            }
            if (table === 'user_data') {
              // TV Brasil sem peças do dia nem roteiros salvos ainda
              return { data: { roteiros: {}, pecas_dia: {} } };
            }
            return { data: null };
          },
          update() { return b; },
          async upsert() { return { data: null }; },
        };
        return b;
      },
    };

    const bridgeModule = {};
    new Function('window', 'globalThis', BRIDGE_SRC).call(bridgeModule, bridgeModule, bridgeModule);

    const g = {
      document: { getElementById: () => makeFakeElement() },
      location: { href: '', reload() {} },
      addEventListener() {},
      removeEventListener() {},
      CanalAuth: {
        getClient: () => fakeSupabase,
        onAuthChange() {},
        resolveSession: async () => null,
      },
      RoteiroPecasBridge: bridgeModule.RoteiroPecasBridge,
      localStorage: ls,
      EmissoraContext: { getEmissoraAtivaId: () => tbcId },
      console, addEventListener() {}, removeEventListener() {},
      setTimeout,
      clearTimeout,
      WORKSPACE_ID: 'workspace-teste',
    };
    g.window = g;

    const body = `${CLOUD_SYNC_SRC}
      function __test_setCurrentUser(u) { currentUser = u; }
      return { fetchAndMergeCloudData, __test_setCurrentUser };`;
    const factory = new Function(
      'window', 'globalThis', 'document', 'location', 'CanalAuth',
      'RoteiroPecasBridge', 'localStorage', 'console', 'setTimeout', 'clearTimeout',
      'WORKSPACE_ID', 'EmissoraContext',
      body
    );
    const cs = factory.call(
      g, g.window, g, g.document, g.location, g.CanalAuth,
      g.RoteiroPecasBridge, g.localStorage, g.console, g.setTimeout, g.clearTimeout,
      g.WORKSPACE_ID, g.EmissoraContext
    );
    cs.__test_setCurrentUser({ id: 'user-tbc', email: 'tbc@teste.com' });

    await cs.fetchAndMergeCloudData({ id: 'user-tbc' });

    const salvo = JSON.parse(ls.getItem(`roteiroApp_${tbcId}`));
    expect(salvo.pecas).toEqual([]);
    expect(salvo.programas).toEqual([]);
    expect(salvo.pecasDia).toEqual({});
  });

  it('init() em app.js para uma emissora secundária não inicia com INITIAL_PECAS nem INITIAL_PROGRAMAS', () => {
    const tbcId = '9f033fde-2738-4df5-b5d8-752baae5d911';
    const ls = makeLocalStorage(); // Limpo, primeira vez abrindo
    const fakeEl = makeFakeElement();
    const doc = {
      getElementById: () => fakeEl,
      querySelector: () => fakeEl,
      querySelectorAll: () => [],
      addEventListener() {},
      removeEventListener() {},
      createElement: () => makeFakeElement(),
      body: fakeEl,
    };

    // Remove a auto-chamada de init() no final do arquivo app.js para controlar no teste
    const appSemBoot = APP_SRC.replace(/\binit\(\);?\s*$/, '');

    const g = {
      addEventListener() {},
      removeEventListener() {},
      document: doc,
      localStorage: ls,
      EmissoraContext: { getEmissoraAtivaId: () => tbcId },
      console,
      alert() {},
      confirm() { return true; },
      prompt() { return ''; },
    };
    g.window = g;

    const factory = new Function(
      'window', 'globalThis', 'document', 'localStorage', 'EmissoraContext',
      `${appSemBoot}\nreturn { init, state, getRoteiroStorageKey };`
    );
    const app = factory.call(g, g.window, g, g.document, g.localStorage, g.EmissoraContext);

    expect(app.getRoteiroStorageKey()).toBe(`roteiroApp_${tbcId}`);

    app.init();

    // Na emissora secundária, deve inicializar vazio, não com as 256 peças do Canal Educação
    expect(app.state.pecas).toEqual([]);
    expect(app.state.programas).toEqual([]);
    expect(app.state.pecasDia).toEqual([]);
  });
});

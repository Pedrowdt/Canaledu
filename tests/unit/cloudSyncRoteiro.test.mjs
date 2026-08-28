// Bug relatado: usuário edita o Roteiro, vai para "Peças e Programas" e
// volta -> o trabalho no roteiro do dia sumiu.
//
// Causa raiz: toda edição só é enviada à nuvem depois de um debounce de
// 900ms (patchLocalStorage, em cloud-sync.js). Trocar de tela é navegação
// completa (location.href), então se o clique acontece antes do timer
// disparar, o envio nunca ocorre. Ao voltar, fetchAndMergeCloudData()
// confiava cegamente em `userRow.roteiros` (nuvem) mesmo quando essa
// versão era mais velha que o que já estava salvo localmente — apagando a
// edição que não teve tempo de subir.
//
// Estes testes travam a correção: uma marca de "sincronização pendente" é
// gravada de forma síncrona a cada edição (sobrevive a recarregar a
// página) e, enquanto ela existir, o local vence da nuvem para os campos
// por-usuário (`roteiros`, `pecas_dia`).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../../cloud-sync.js', import.meta.url), 'utf8');

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

/** Mock mínimo do client Supabase usado por fetchAndMergeCloudData/pushToCloud. */
function makeSupabaseMock({ sharedRow = null, userRow = null, onUserDataWrite } = {}) {
  function builder(table) {
    const b = {
      select() { return b; },
      eq() { return b; },
      async maybeSingle() {
        if (table === 'shared_data') return { data: sharedRow };
        if (table === 'user_data') return { data: userRow };
        return { data: null };
      },
      update(payload) {
        if (table === 'user_data' && onUserDataWrite) onUserDataWrite(payload);
        return b;
      },
      async upsert(payload) {
        if (table === 'user_data' && onUserDataWrite) onUserDataWrite(payload);
        return { data: null };
      },
    };
    return b;
  }
  return { from: builder };
}

function loadCloudSync({ localStorage, sharedRow, userRow, onUserDataWrite } = {}) {
  const ls = localStorage || makeLocalStorage();
  const fakeSupabase = makeSupabaseMock({ sharedRow, userRow, onUserDataWrite });
  const g = {
    document: { getElementById: () => makeFakeElement() },
    location: { href: '', reload() {} },
    addEventListener() {},
    removeEventListener() {},
    CanalAuth: {
      getClient: () => fakeSupabase,
      onAuthChange() {},
      resolveSession: async () => null, // não loga sozinho durante o teste
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

  const body = `${SRC}
    function __test_setCurrentUser(u) { currentUser = u; }
    return {
      fetchAndMergeCloudData, flushPendingSync, marcarSyncPendente,
      marcarSyncConfirmado, haSyncPendente, patchLocalStorage,
      __test_setCurrentUser,
    };`;
  const factory = new Function(
    'window', 'globalThis', 'document', 'location', 'CanalAuth',
    'RoteiroPecasBridge', 'localStorage', 'console', 'setTimeout', 'clearTimeout',
    'WORKSPACE_ID',
    body
  );
  const cs = factory.call(
    g, g.window, g, g.document, g.location, g.CanalAuth,
    g.RoteiroPecasBridge, g.localStorage, g.console, g.setTimeout, g.clearTimeout,
    g.WORKSPACE_ID
  );
  cs.__test_setCurrentUser({ id: 'user-1', email: 'user@teste.com' });
  return { cs, localStorage: ls };
}

describe('marca de sincronização pendente (sobrevive a um reload de página)', () => {
  it('começa sem pendência e liga/desliga corretamente', () => {
    const { cs } = loadCloudSync();
    expect(cs.haSyncPendente()).toBe(false);
    cs.marcarSyncPendente();
    expect(cs.haSyncPendente()).toBe(true);
    cs.marcarSyncConfirmado();
    expect(cs.haSyncPendente()).toBe(false);
  });

  it('patchLocalStorage marca pendência já na escrita, antes do debounce de 900ms disparar', () => {
    const { cs, localStorage } = loadCloudSync();
    cs.patchLocalStorage();
    localStorage.setItem('roteiroApp', JSON.stringify({ roteiros: { '2026-08-27': [{ code: 'X' }] } }));
    // Sem esperar 900ms: a marca já deve estar salva de forma síncrona.
    expect(cs.haSyncPendente()).toBe(true);
  });
});

describe('fetchAndMergeCloudData — não pode apagar uma edição não confirmada', () => {
  it('sem pendência, a nuvem manda normalmente (comportamento de sempre)', async () => {
    const local = makeLocalStorage();
    local.setItem('roteiroApp', JSON.stringify({
      roteiros: { '2026-08-27': [{ code: 'ANTIGO' }] },
    }));
    const { cs } = loadCloudSync({
      localStorage: local,
      userRow: { roteiros: { '2026-08-27': [{ code: 'NUVEM' }] }, pecas_dia: {} },
    });

    await cs.fetchAndMergeCloudData({ id: 'user-1' });

    const saved = JSON.parse(local.getItem('roteiroApp'));
    expect(saved.roteiros['2026-08-27']).toEqual([{ code: 'NUVEM' }]);
  });

  it('bug original: com pendência, o roteiro local mais novo NÃO é sobrescrito pela nuvem desatualizada', async () => {
    const local = makeLocalStorage();
    local.setItem('roteiroApp', JSON.stringify({
      roteiros: { '2026-08-27': [{ code: 'TRABALHO_EM_ANDAMENTO' }] },
    }));
    let enviouDeNovo = false;
    const { cs } = loadCloudSync({
      localStorage: local,
      // A nuvem só tem o snapshot antigo, porque o push nunca terminou
      // antes da troca de página.
      userRow: { roteiros: { '2026-08-27': [{ code: 'VELHO' }] }, pecas_dia: {} },
      onUserDataWrite: (payload) => {
        if (payload.roteiros) enviouDeNovo = true;
      },
    });
    // Simula o estado deixado pela página anterior: edição feita, debounce
    // ainda não tinha disparado quando o usuário navegou para o Cadastro.
    cs.marcarSyncPendente();

    await cs.fetchAndMergeCloudData({ id: 'user-1' });

    const saved = JSON.parse(local.getItem('roteiroApp'));
    expect(saved.roteiros['2026-08-27']).toEqual([{ code: 'TRABALHO_EM_ANDAMENTO' }]); // nada sumiu
    expect(enviouDeNovo).toBe(true); // e a pendência é reenviada à nuvem, não fica esquecida
  });

  it('pecas_dia segue a mesma regra de precedência que roteiros', async () => {
    const local = makeLocalStorage();
    local.setItem('roteiroApp', JSON.stringify({ pecasDia: { '2026-08-27': [{ code: 'LOCAL' }] } }));
    const { cs } = loadCloudSync({
      localStorage: local,
      userRow: { roteiros: {}, pecas_dia: { '2026-08-27': [{ code: 'NUVEM_VELHA' }] } },
    });
    cs.marcarSyncPendente();

    await cs.fetchAndMergeCloudData({ id: 'user-1' });

    const saved = JSON.parse(local.getItem('roteiroApp'));
    expect(saved.pecasDia['2026-08-27']).toEqual([{ code: 'LOCAL' }]);
  });
});

describe('flushPendingSync — usado antes de navegar para Peças e Programas', () => {
  it('cancela o debounce e envia imediatamente em vez de esperar 900ms', async () => {
    let payloadEnviado = null;
    const local = makeLocalStorage();
    const { cs } = loadCloudSync({
      localStorage: local,
      onUserDataWrite: (payload) => { payloadEnviado = payload; },
    });
    cs.patchLocalStorage();
    local.setItem('roteiroApp', JSON.stringify({ roteiros: { '2026-08-27': [{ code: 'X' }] } }));

    expect(cs.haSyncPendente()).toBe(true); // ainda não confirmado
    await cs.flushPendingSync();

    expect(payloadEnviado).not.toBeNull();
    expect(payloadEnviado.roteiros['2026-08-27']).toEqual([{ code: 'X' }]);
    expect(cs.haSyncPendente()).toBe(false); // confirmado depois do flush
  });
});

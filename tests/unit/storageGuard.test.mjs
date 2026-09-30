// Bug: "Failed to execute 'setItem' on 'Storage': Setting the value of
// 'roteiroApp' exceeded the quota" (cloud-sync.js).
//
// Causa raiz: `roteiroApp` acumula todos os dias já montados
// (roteiros / pecasDia / pecasDiaLimpo) sem nenhum descarte; no login a
// nuvem devolve o mesmo JSON gigante e o primeiro boot quebra.
//
// Estes testes travam: (1) a política de retenção, (2) a poda por cota,
// (3) o fallback em memória sem exceção e (4) a integração com cloud-sync.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const GUARD_SRC = readFileSync(new URL('../../storage-guard.js', import.meta.url), 'utf8');
const SG = (() => {
  const g = {};
  new Function('window', 'globalThis', GUARD_SRC).call(g, g, g);
  return g.StorageGuard;
})();
const SRC = readFileSync(new URL('../../cloud-sync.js', import.meta.url), 'utf8');

const HOJE = new Date(2026, 8, 30); // 30/09/2026 (mês 0-based)

function dia(offset) {
  return SG.chaveDia(new Date(2026, 8, 30 + offset));
}

/** Storage fake com cota em caracteres (chave + valor), como o navegador. */
function makeQuotaStorage(limite) {
  const store = new Map();
  const uso = (ignorar) => [...store].reduce((n, [k, v]) => (k === ignorar ? n : n + k.length + v.length), 0);
  const quotaError = () => {
    const e = new Error("Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.");
    e.name = 'QuotaExceededError';
    e.code = 22;
    return e;
  };
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem(k, v) {
      v = String(v);
      if (uso(k) + k.length + v.length > limite) throw quotaError();
      store.set(k, v);
    },
    removeItem: (k) => store.delete(k),
    _store: store,
  };
}

/** App com `dias` dias de histórico (cada roteiro pesa ~`peso` chars). */
function appComHistorico(dias, peso = 200) {
  const roteiros = {}, pecasDia = {}, pecasDiaLimpo = {};
  for (let i = 0; i < dias; i++) {
    const k = dia(-i);
    roteiros[k] = [{ code: 'X' + i, pad: 'x'.repeat(peso) }];
    pecasDia[k] = [{ id: i }];
    pecasDiaLimpo[k] = true;
  }
  return { pecas: [{ id: 1 }], programas: [{ id: 2 }], grade: { seg: 1 }, roteiros, pecasDia, pecasDiaLimpo };
}

function makeGuard(storage, extra = {}) {
  const eventos = [];
  const guard = SG.criar({
    storage,
    setItemOriginal: (k, v) => storage.setItem(k, v),
    agora: () => HOJE,
    onEvento: (t, d) => eventos.push([t, d]),
    ...extra,
  });
  return { guard, eventos };
}

describe('ehErroDeCota', () => {
  it('reconhece as variantes de Chrome, Safari e Firefox', () => {
    expect(SG.ehErroDeCota({ name: 'QuotaExceededError' })).toBe(true);
    expect(SG.ehErroDeCota({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(SG.ehErroDeCota({ code: 22 })).toBe(true);
    expect(SG.ehErroDeCota({ code: 1014 })).toBe(true);
    expect(SG.ehErroDeCota(new Error('... exceeded the quota.'))).toBe(true);
  });
  it('não confunde outros erros com cota', () => {
    expect(SG.ehErroDeCota(new TypeError('x is undefined'))).toBe(false);
    expect(SG.ehErroDeCota(null)).toBe(false);
  });
});

describe('podarHistorico — política de retenção', () => {
  it('remove só dias passados além da retenção, nos três mapas', () => {
    const app = appComHistorico(200);
    const r = SG.podarHistorico(app, { hoje: HOJE, diasRetencao: 90 });
    const datas = Object.keys(r.app.roteiros);
    expect(datas.every((k) => k >= SG.chaveCorte(HOJE, 90))).toBe(true);
    expect(datas).toHaveLength(91); // hoje + 90 dias para trás
    expect(Object.keys(r.app.pecasDia)).toHaveLength(91);
    expect(Object.keys(r.app.pecasDiaLimpo)).toHaveLength(91);
    expect(r.total).toBe((200 - 91) * 3);
  });

  it('nunca descarta hoje nem dias futuros (roteiros planejados)', () => {
    const app = appComHistorico(5);
    app.roteiros[dia(+1)] = [{ code: 'AMANHA' }];
    app.roteiros[dia(+30)] = [{ code: 'MES_QUE_VEM' }];
    const r = SG.podarHistorico(app, { hoje: HOJE, diasRetencao: 0 });
    expect(r.app.roteiros[dia(0)]).toBeDefined();
    expect(r.app.roteiros[dia(+1)]).toBeDefined();
    expect(r.app.roteiros[dia(+30)]).toBeDefined();
    expect(r.app.roteiros[dia(-1)]).toBeUndefined();
  });

  it('preserva dias protegidos (dia aberto na tela) mesmo que antigos', () => {
    const app = appComHistorico(200);
    const aberto = dia(-150);
    const r = SG.podarHistorico(app, { hoje: HOJE, diasRetencao: 30, protegidos: [aberto] });
    expect(r.app.roteiros[aberto]).toBeDefined();
    expect(r.app.roteiros[dia(-151)]).toBeUndefined();
  });

  it('não toca no catálogo, na grade nem em chaves que não são datas', () => {
    const app = appComHistorico(200);
    app.roteiros['rascunho'] = [{ code: 'R' }];
    const r = SG.podarHistorico(app, { hoje: HOJE, diasRetencao: 7 });
    expect(r.app.pecas).toEqual(app.pecas);
    expect(r.app.programas).toEqual(app.programas);
    expect(r.app.grade).toEqual(app.grade);
    expect(r.app.roteiros['rascunho']).toBeDefined();
  });

  it('não muta o objeto original', () => {
    const app = appComHistorico(200);
    const antes = JSON.stringify(app);
    SG.podarHistorico(app, { hoje: HOJE, diasRetencao: 7 });
    expect(JSON.stringify(app)).toBe(antes);
  });

  it('é idempotente e tolera app vazio/sem mapas', () => {
    const r1 = SG.podarHistorico({}, { hoje: HOJE });
    expect(r1.total).toBe(0);
    const app = appComHistorico(200);
    const a = SG.podarHistorico(app, { hoje: HOJE, diasRetencao: 30 }).app;
    expect(SG.podarHistorico(a, { hoje: HOJE, diasRetencao: 30 }).total).toBe(0);
  });
});

describe('guard.setItem — poda por cota e fallback', () => {
  it('reproduz o bug: sem guard, o setItem direto lança QuotaExceededError', () => {
    const st = makeQuotaStorage(20000);
    const app = appComHistorico(400);
    expect(() => st.setItem('roteiroApp', JSON.stringify(app))).toThrow(/quota/i);
  });

  it('com guard: poda o histórico antigo e grava SEM lançar', () => {
    const st = makeQuotaStorage(40000);
    const { guard, eventos } = makeGuard(st);
    const app = appComHistorico(400);
    expect(JSON.stringify(app).length).toBeGreaterThan(40000);

    let r;
    expect(() => { r = guard.setItem('roteiroApp', JSON.stringify(app)); }).not.toThrow();
    expect(r.ok).toBe(true);
    expect(r.podado).toBe(true);

    const gravado = JSON.parse(st.getItem('roteiroApp'));
    expect(gravado.roteiros[dia(0)]).toBeDefined();          // hoje sobrevive
    expect(gravado.roteiros[dia(-399)]).toBeUndefined();     // antigo foi podado
    expect(gravado.pecas).toEqual(app.pecas);                // catálogo intacto
    expect(eventos.some(([t]) => t === 'poda_por_cota')).toBe(true);
  });

  it('usa o MENOR corte necessário (preserva o máximo de histórico)', () => {
    const st = makeQuotaStorage(60000);
    const { guard } = makeGuard(st);
    guard.setItem('roteiroApp', JSON.stringify(appComHistorico(400)));
    const gravado = JSON.parse(st.getItem('roteiroApp'));
    const n = Object.keys(gravado.roteiros).length;
    expect(n).toBeGreaterThan(1);
    expect(n).toBeLessThanOrEqual(91);
  });

  it('dia aberto na tela sobrevive à poda de emergência', () => {
    const st = makeQuotaStorage(15000);
    const aberto = dia(-200);
    const { guard } = makeGuard(st, { protegidos: () => [aberto] });
    guard.setItem('roteiroApp', JSON.stringify(appComHistorico(400)));
    const gravado = JSON.parse(st.getItem('roteiroApp'));
    expect(gravado.roteiros[aberto]).toBeDefined();
  });

  it('fallback em memória: nada cabe -> não lança e getItem devolve o valor', () => {
    const st = makeQuotaStorage(50); // impossível gravar qualquer coisa útil
    const { guard, eventos } = makeGuard(st);
    const valor = JSON.stringify(appComHistorico(10));
    let r;
    expect(() => { r = guard.setItem('roteiroApp', valor); }).not.toThrow();
    expect(r.ok).toBe(false);
    expect(r.emMemoria).toBe(true);
    expect(guard.emMemoria('roteiroApp')).toBe(true);
    expect(JSON.parse(guard.getItem('roteiroApp')).pecas).toEqual([{ id: 1 }]);
    expect(eventos.some(([t]) => t === 'fallback_memoria')).toBe(true);
  });

  it('volta a gravar em disco quando volta a caber, e limpa a cópia em memória', () => {
    let limite = 50;
    const base = makeQuotaStorage(1e9);
    const st = { ...base, setItem(k, v) { if (k.length + String(v).length > limite) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } base.setItem(k, v); } };
    const { guard } = makeGuard(st);
    guard.setItem('roteiroApp', JSON.stringify(appComHistorico(3)));
    expect(guard.emMemoria('roteiroApp')).toBe(true);
    limite = 1e9;
    guard.setItem('roteiroApp', JSON.stringify({ pecas: [] }));
    expect(guard.emMemoria('roteiroApp')).toBe(false);
    expect(st.getItem('roteiroApp')).toBe('{"pecas":[]}');
  });

  it('poda preventiva acima do limite suave, sem nem chegar a estourar a cota', () => {
    const st = makeQuotaStorage(1e9);
    const { guard, eventos } = makeGuard(st, { politica: { limiteSuaveChars: 20000 } });
    guard.setItem('roteiroApp', JSON.stringify(appComHistorico(400)));
    expect(eventos.some(([t]) => t === 'poda_preventiva')).toBe(true);
    expect(Object.keys(JSON.parse(st.getItem('roteiroApp')).roteiros).length).toBeLessThanOrEqual(91);
  });

  it('valor abaixo da cota e do limite: grava intacto, sem podar', () => {
    const st = makeQuotaStorage(1e9);
    const { guard, eventos } = makeGuard(st);
    const valor = JSON.stringify(appComHistorico(300));
    const r = guard.setItem('roteiroApp', valor);
    expect(r.podado).toBe(false);
    expect(st.getItem('roteiroApp')).toBe(valor); // retenção só age sob pressão ou no login
    expect(eventos).toHaveLength(0);
  });

  it('JSON inválido com cota estourada: não lança, cai na memória', () => {
    const st = makeQuotaStorage(10);
    const { guard } = makeGuard(st);
    expect(() => guard.setItem('roteiroApp', '{quebrado'.repeat(20))).not.toThrow();
    expect(guard.emMemoria('roteiroApp')).toBe(true);
  });

  it('erros que NÃO são de cota continuam propagando (não mascara bugs)', () => {
    const st = makeQuotaStorage(1e9);
    const { guard } = makeGuard(st, { setItemOriginal: () => { throw new TypeError('bug real'); } });
    expect(() => guard.setItem('roteiroApp', '{}')).toThrow('bug real');
  });

  it('roteiroRegras (crítica) também nunca lança', () => {
    const st = makeQuotaStorage(5);
    const { guard } = makeGuard(st);
    expect(() => guard.setItem('roteiroRegras', JSON.stringify({ a: 'x'.repeat(100) }))).not.toThrow();
    expect(guard.emMemoria('roteiroRegras')).toBe(true);
  });

  it('chave não crítica libera espaço podando o roteiroApp e regrava', () => {
    const app = JSON.stringify(appComHistorico(150, 20));
    const st = makeQuotaStorage(app.length + 'roteiroApp'.length + 4000); // sobra 4k; a chave nova pede 9k
    const { guard } = makeGuard(st);
    st.setItem('roteiroApp', app);
    expect(() => st.setItem('outraChave', 'y'.repeat(9000))).toThrow(/quota/i); // sem guard: estoura
    guard.setItem('outraChave', 'y'.repeat(9000));
    expect(st.getItem('outraChave')).toHaveLength(9000);
    expect(Object.keys(JSON.parse(st.getItem('roteiroApp')).roteiros).length).toBeLessThanOrEqual(91);
  });
});

describe('aplicarRetencao — política aplicada no login', () => {
  it('poda o que está no disco mesmo sem pressão de cota', () => {
    const st = makeQuotaStorage(1e9);
    const { guard, eventos } = makeGuard(st);
    st.setItem('roteiroApp', JSON.stringify(appComHistorico(400)));
    const r = guard.aplicarRetencao();
    expect(r.total).toBeGreaterThan(0);
    const gravado = JSON.parse(st.getItem('roteiroApp'));
    expect(Object.keys(gravado.roteiros)).toHaveLength(91);
    expect(eventos.some(([t]) => t === 'poda_retencao')).toBe(true);
  });

  it('sem nada a podar, não reescreve o storage', () => {
    const st = makeQuotaStorage(1e9);
    const { guard } = makeGuard(st);
    st.setItem('roteiroApp', JSON.stringify(appComHistorico(10)));
    const spy = vi.spyOn(st, 'setItem');
    expect(guard.aplicarRetencao().total).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------
// Integração com cloud-sync.js: o caminho exato do bug (login em
// navegador novo -> cloudSync puxa JSON gigante -> grava no localStorage)
// ---------------------------------------------------------------
function makeFakeElement() {
  return { style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, appendChild() {}, value: '', textContent: '', disabled: false };
}

function loadCloudSync({ storage, userRow, sharedRow = null, withGuard = true }) {
  const fakeSupabase = {
    from(table) {
      const b = {
        select() { return b; }, eq() { return b; },
        async maybeSingle() { return { data: table === 'user_data' ? userRow : sharedRow }; },
        update() { return b; },
        async upsert() { return { data: null }; },
      };
      return b;
    },
  };
  const g = {
    document: { getElementById: () => makeFakeElement() },
    location: { href: '', reload() {} },
    addEventListener() {}, removeEventListener() {},
    CanalAuth: { getClient: () => fakeSupabase, onAuthChange() {}, resolveSession: async () => null },
    RoteiroPecasBridge: {
      async carregarCadastro() { return { pecas: [{ id: 1 }], programas: [{ id: 2 }], origem: 'teste' }; },
      mergeCadastro(local) { return { pecas: local.pecas || [], programas: local.programas || [] }; },
    },
    localStorage: storage, console: { ...console, warn() {}, info() {} }, setTimeout, clearTimeout,
    WORKSPACE_ID: 'ws',
  };
  g.window = g;
  if (withGuard) g.StorageGuard = SG;
  const body = `${SRC}
    function __set(u) { currentUser = u; }
    return { fetchAndMergeCloudData, patchLocalStorage, gravarLocal, __set };`;
  const factory = new Function('window', 'globalThis', 'document', 'location', 'CanalAuth', 'RoteiroPecasBridge', 'localStorage', 'console', 'setTimeout', 'clearTimeout', 'WORKSPACE_ID', body);
  const cs = factory.call(g, g.window, g, g.document, g.location, g.CanalAuth, g.RoteiroPecasBridge, g.localStorage, g.console, g.setTimeout, g.clearTimeout, g.WORKSPACE_ID);
  cs.__set({ id: 'u1', email: 'u@t.com' });
  return cs;
}

describe('cloud-sync + storage-guard (caminho do bug)', () => {
  it('login em navegador novo: JSON gigante da nuvem NÃO lança e fica dentro da cota', async () => {
    const st = makeQuotaStorage(60000);
    const gigante = appComHistorico(600); // muito acima da cota
    const cs = loadCloudSync({ storage: st, userRow: { roteiros: gigante.roteiros, pecas_dia: gigante.pecasDia } });

    await expect(cs.fetchAndMergeCloudData({ id: 'u1', email: 'u@t.com' })).resolves.not.toThrow();

    const gravado = JSON.parse(st.getItem('roteiroApp'));
    const corte = SG.chaveCorte(new Date(), 90);
    const datas = Object.keys(gravado.roteiros);
    expect(datas.length).toBeGreaterThan(0);
    expect(datas.length).toBeLessThan(600);
    expect(JSON.stringify(gravado).length).toBeLessThanOrEqual(60000);
    // a retenção do login (90 dias) só remove histórico antigo, nunca o recente
    expect(datas.filter((k) => k >= corte).length).toBeGreaterThan(0);
  });

  it('patchLocalStorage: edição com disco cheio não lança e o app lê o dado novo', () => {
    const st = makeQuotaStorage(300);
    const cs = loadCloudSync({ storage: st });
    cs.patchLocalStorage();
    const novo = JSON.stringify({ pecas: [], roteiros: { [SG.chaveDia(new Date())]: [{ code: 'NOVO', pad: 'x'.repeat(2000) }] } });
    expect(() => st.setItem('roteiroApp', novo)).not.toThrow();
    expect(st.getItem('roteiroApp')).toBe(novo); // servido da memória
  });

  it('sem storage-guard.js carregado: degrada sem lançar (não quebra o login)', async () => {
    const st = makeQuotaStorage(100);
    const cs = loadCloudSync({ storage: st, withGuard: false, userRow: { roteiros: appComHistorico(50).roteiros, pecas_dia: {} } });
    await expect(cs.fetchAndMergeCloudData({ id: 'u1', email: 'u@t.com' })).resolves.not.toThrow();
  });
});

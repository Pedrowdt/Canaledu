// Testa PecasRepo (pecas-repo.js) com um cliente Supabase falso.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../pecas-repo.js', import.meta.url), 'utf8');

function loadRepo() {
  const g = {};
  new Function('window', 'globalThis', `${src}`).call(g, g, g);
  return g.PecasRepo;
}

/** Cliente falso: `tables` = null simula tabela inexistente (modo legado). */
function fakeClient({ relational = true, pecas = [], programas = [], shared = {} } = {}) {
  const calls = { upserts: [], deletes: [], updates: [], rpc: [] };
  const rows = { pecas, programas };

  function query(table) {
    const api = {
      _filters: [],
      select() {
        if (table === 'shared_data') {
          return { eq: () => ({ maybeSingle: async () => ({ data: shared, error: null }) }) };
        }
        if (!relational) return { limit: async () => ({ data: null, error: { message: 'relation does not exist' } }) };
        const chain = {
          limit: async () => ({ data: [], error: null }),
          order() { return chain; },
          then(res) { return Promise.resolve({ data: rows[table] || [], error: null }).then(res); },
        };
        return chain;
      },
      upsert(payload) { calls.upserts.push({ table, payload }); return Promise.resolve({ error: null }); },
      delete() {
        const d = {
          not(col, op, val) { calls.deletes.push({ table, col, op, val }); return Promise.resolve({ error: null }); },
          neq(col, val) { calls.deletes.push({ table, col, op: 'neq', val }); return Promise.resolve({ error: null }); },
        };
        return d;
      },
      update(patch) { calls.updates.push({ table, patch }); return { eq: async () => ({ error: null }) }; },
    };
    return api;
  }

  return {
    calls,
    from: query,
    rpc: async (fn, args) => { calls.rpc.push({ fn, args }); return { data: rows.pecas, error: null }; },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
  };
}

describe('PecasRepo', () => {
  let Repo;
  beforeEach(() => { Repo = loadRepo(); });

  it('detecta modo relacional', async () => {
    const c = fakeClient();
    expect(await Repo.init(c, 'workspace')).toBe('relational');
  });

  it('cai para o modo legado quando as tabelas não existem', async () => {
    const c = fakeClient({ relational: false, shared: { pecas: [{ code: 'A' }], programas: [] } });
    expect(await Repo.init(c, 'workspace')).toBe('legacy');
    const data = await Repo.loadAll();
    expect(data.pecas[0].code).toBe('A');
    expect(data.pecas[0].id).toBeTruthy();
  });

  it('converte linhas do banco para o formato da tela', async () => {
    const c = fakeClient({
      pecas: [{ id: '1', code: '90001', descricao: 'VH', tempo: '00:00:05', categoria: 'RCOM', h_ini: '10:00', h_fim: '14:00', dias: ['seg'], posicao: 'inicio' }],
      programas: [{ id: '2', code: 'P1', descricao: 'SCIENTIA', assinatura: 'infantil' }],
    });
    await Repo.init(c);
    const { pecas, programas } = await Repo.loadAll();
    expect(pecas[0]).toMatchObject({ hIni: '10:00', hFim: '14:00', dias: ['seg'], posicao: 'inicio' });
    expect(programas[0].assinatura).toEqual(['infantil']);
  });

  it('saveAll faz upsert por code e apaga os removidos', async () => {
    const c = fakeClient();
    await Repo.init(c);
    await Repo.saveAll({
      pecas: [{ code: '1', descricao: 'x', tempo: '00:00:05', dias: ['seg', 'xx'], hIni: '9', validade: '' }],
      programas: [{ code: 'P1', descricao: 'y', assinatura: ['jovem'] }],
      userId: 'u1',
    });
    const peca = c.calls.upserts.find((u) => u.table === 'pecas').payload[0];
    expect(peca.dias).toEqual(['seg']);          // dia inválido descartado
    expect(peca.h_ini).toBeNull();               // "9" não é HH:MM
    expect(peca.validade).toBeNull();            // string vazia -> null
    expect(c.calls.deletes.map((d) => d.table).sort()).toEqual(['pecas', 'programas']);
    expect(c.calls.deletes[0].val).toContain('"1"');
  });

  it('modo legado grava o JSONB em shared_data', async () => {
    const c = fakeClient({ relational: false, shared: { pecas: [], programas: [] } });
    await Repo.init(c, 'workspace');
    await Repo.saveAll({ pecas: [{ code: 'A' }], programas: [], userId: 'u1' });
    expect(c.calls.updates[0].table).toBe('shared_data');
    expect(c.calls.updates[0].patch.pecas).toHaveLength(1);
  });

  it('pecasElegiveis usa a função do banco no modo relacional', async () => {
    const c = fakeClient({ pecas: [{ code: '1', descricao: 'x' }] });
    await Repo.init(c);
    const out = await Repo.pecasElegiveis({ dow: 3, hora: '12:00' });
    expect(c.calls.rpc[0]).toEqual({ fn: 'fn_pecas_elegiveis', args: { p_dow: 3, p_hora: '12:00' } });
    expect(out[0].code).toBe('1');
  });
});

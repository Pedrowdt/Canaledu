// Consistência multiusuário: gravação por DELTA, exclusões explícitas e conflitos.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../pecas-repo.js', import.meta.url), 'utf8');
function loadRepo() {
  const g = {};
  new Function('window', 'globalThis', src).call(g, g, g);
  return g.PecasRepo;
}

function fakeClient(rows = { pecas: [], programas: [] }) {
  const calls = { rpc: [], upserts: [], deletes: [] };
  const client = {
    from(table) {
      return {
        select() {
          const chain = {
            limit: async () => ({ data: [], error: null }),
            order() { return chain; },
            then(res) { return Promise.resolve({ data: rows[table] || [], error: null }).then(res); },
            eq: () => ({ maybeSingle: async () => ({ data: { pecas: rows.pecas, programas: rows.programas }, error: null }) }),
          };
          return chain;
        },
        upsert(payload) { calls.upserts.push({ table, payload }); return Promise.resolve({ error: null }); },
        update(payload) { calls.updates = payload; return { eq: async () => ({ error: null }) }; },
        delete() { return { in: (col, val) => { calls.deletes.push({ table, val }); return Promise.resolve({ error: null }); } }; },
      };
    },
    async rpc(name, args) {
      calls.rpc.push({ name, args });
      return { data: { aplicados: args.p_upserts.length, removidos: args.p_deletes.length, conflitos: [] }, error: null };
    },
  };
  return { client, calls };
}

const PECA = (over = {}) => ({
  id: 'x', code: '90001', descricao: 'VH', tempo: '00:00:05', midia: '0OMN', type: 'EVNH',
  categoria: 'CHAMADA_QUENTE', validade: '', dias: [], hIni: '', hFim: '', freq: '', obs: '',
  posicao: '', ordem: 0, ativo: true, ...over,
});

describe('gravação por delta', () => {
  it('não reenvia linhas inalteradas', async () => {
    const repo = loadRepo();
    const { client, calls } = fakeClient({ pecas: [{ ...PECA(), h_ini: null, h_fim: null, row_version: 3 }], programas: [] });
    await repo.init(client);
    const { pecas } = await repo.loadAll();
    await repo.saveDelta({ pecas, programas: [] });
    expect(calls.rpc).toHaveLength(0);
  });

  it('envia só o item editado, com a row_version do banco', async () => {
    const repo = loadRepo();
    const { client, calls } = fakeClient({
      pecas: [
        { ...PECA(), row_version: 3 },
        { ...PECA({ code: '90002', descricao: 'OUTRA' }), row_version: 7 },
      ],
      programas: [],
    });
    await repo.init(client);
    const { pecas } = await repo.loadAll();
    pecas[1].descricao = 'EDITADA';
    await repo.saveDelta({ pecas, programas: [] });
    const chamada = calls.rpc.find((c) => c.name === 'fn_salvar_pecas');
    expect(chamada.args.p_upserts).toHaveLength(1);
    expect(chamada.args.p_upserts[0]).toMatchObject({ code: '90002', descricao: 'EDITADA', row_version: 7 });
  });

  it('linha nova vai com row_version null', async () => {
    const repo = loadRepo();
    const { client, calls } = fakeClient();
    await repo.init(client);
    await repo.loadAll();
    await repo.saveDelta({ pecas: [PECA({ code: '99999' })], programas: [] });
    expect(calls.rpc[0].args.p_upserts[0].row_version).toBe(null);
  });

  it('só apaga os codes excluídos explicitamente', async () => {
    const repo = loadRepo();
    const { client, calls } = fakeClient({ pecas: [{ ...PECA(), row_version: 1 }], programas: [] });
    await repo.init(client);
    const { pecas } = await repo.loadAll();
    await repo.saveDelta({ pecas, programas: [], deletedPecas: ['90001'] });
    expect(calls.rpc[0].args.p_deletes).toEqual(['90001']);
  });

  it('saveAll nunca apaga codes que este cliente não carregou', async () => {
    const repo = loadRepo();
    const { client, calls } = fakeClient({ pecas: [{ ...PECA(), row_version: 1 }], programas: [] });
    await repo.init(client);
    await repo.loadAll();
    await repo.saveAll({ pecas: [], programas: [] }); // usuário limpou a tela
    expect(calls.rpc[0].args.p_deletes).toEqual(['90001']);
  });

  it('fallback sem RPC usa upsert + delete in(), sem apagar o resto', async () => {
    const repo = loadRepo();
    const { client, calls } = fakeClient({ pecas: [], programas: [] });
    client.rpc = async () => ({ data: null, error: { message: 'Could not find the function' } });
    await repo.init(client);
    await repo.loadAll();
    await repo.saveDelta({ pecas: [PECA({ code: '55555' })], programas: [], deletedPecas: ['11111'] });
    expect(calls.upserts[0].payload[0].code).toBe('55555');
    expect(calls.deletes[0].val).toEqual(['11111']);
  });

  it('modo legado mescla com o estado remoto atual (não sobrescreve outros)', async () => {
    const repo = loadRepo();
    const remoto = { pecas: [{ code: 'OUTRO', descricao: 'DE OUTRO USUARIO' }], programas: [] };
    const { client, calls } = fakeClient(remoto);
    client.from = ((orig) => (table) => {
      if (table === 'pecas') return { select: () => ({ limit: async () => ({ data: null, error: { message: 'relation does not exist' } }) }) };
      return orig(table);
    })(client.from.bind(client));
    await repo.init(client);
    await repo.loadAll();
    await repo.saveDelta({ pecas: [PECA({ code: 'MEU' })], programas: [] });
    expect(calls.updates.pecas.map((p) => p.code).sort()).toEqual(['MEU', 'OUTRO']);
  });
});

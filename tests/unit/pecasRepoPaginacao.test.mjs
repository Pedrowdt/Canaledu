// Regressão: a leitura do cadastro relacional precisa trazer a TABELA INTEIRA.
// O PostgREST corta toda listagem no limite do servidor (1000 linhas por
// padrão). Como a ponte trata a lista relacional como "tudo que existe no
// cadastro", qualquer peça além desse corte era removida da tela do Roteiro a
// cada atualização — o relato "as peças estão sumindo".
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../pecas-repo.js', import.meta.url), 'utf8');

function loadRepo() {
  const g = {};
  new Function('window', 'globalThis', src).call(g, g, g);
  return g.PecasRepo;
}

/** Cliente falso que respeita `.range()` e corta em 1000 linhas por página. */
function clientePaginado(rows) {
  const ranges = [];
  function query(table) {
    return {
      select() {
        const chain = {
          limit: async () => ({ data: [], error: null }),
          order() { return chain; },
          range: async (de, ate) => {
            ranges.push([table, de, ate]);
            return { data: (rows[table] || []).slice(de, ate + 1), error: null };
          },
          then(res) {
            // Sem range: comportamento do servidor — corta em 1000.
            return Promise.resolve({ data: (rows[table] || []).slice(0, 1000), error: null }).then(res);
          },
        };
        return chain;
      },
    };
  }
  return { from: query, ranges };
}

describe('PecasRepo.loadAll — paginação', () => {
  it('traz todas as peças mesmo acima do limite de 1000 linhas', async () => {
    const pecas = Array.from({ length: 2300 }, (_, i) => ({ id: String(i), code: 'P' + i }));
    const c = clientePaginado({ pecas, programas: [] });
    const Repo = loadRepo();
    await Repo.init(c, 'workspace');
    const data = await Repo.loadAll();
    expect(data.pecas).toHaveLength(2300);
    expect(data.parcial).toBe(false);
    expect(c.ranges.filter(([t]) => t === 'pecas')).toHaveLength(3);
  });
});

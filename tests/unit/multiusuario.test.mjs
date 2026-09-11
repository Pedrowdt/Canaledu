// Cenário relatado: dois usuários trabalhando ao mesmo tempo.
// Quando o usuário B salva no cadastro, o tempo real atualiza a tela do
// usuário A. Antes, isso substituía state.pecas pelo cadastro da nuvem e
// apagava as peças que A tinha criado localmente ("as peças estão sumindo").
// Estes testes travam o comportamento correto da ponte.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

function loadBridge(pendentes) {
  const src = readFileSync(new URL('../../roteiro-pecas-bridge.js', import.meta.url), 'utf8');
  const g = { CadastroSync: pendentes ? { pendentes: () => pendentes } : undefined };
  new Function('window', 'globalThis', 'module', src).call(g, g, g, undefined);
  return g.RoteiroPecasBridge;
}

const peca = (code, extra = {}) => ({ code, descricao: 'peça ' + code, ativo: true, ...extra });

describe('atualização de um usuário não apaga as peças do outro', () => {
  it('preserva peça local pendente ao aplicar o cadastro da nuvem', () => {
    const bridge = loadBridge({ pecas: [peca('LOCAL1')], programas: [], excluidos: { pecas: [], programas: [] } });
    const state = { pecas: [peca('NUVEM1'), peca('LOCAL1')], programas: [] };

    const mudou = bridge.aplicarNoEstado(state, { pecas: [peca('NUVEM1'), peca('NUVEM2')], programas: [] });

    expect(mudou).toBe(true);
    const codes = state.pecas.map((p) => p.code).sort();
    expect(codes).toEqual(['LOCAL1', 'NUVEM1', 'NUVEM2']); // nada sumiu
  });

  it('mergeCadastro mantém pendências e respeita exclusões explícitas', () => {
    const bridge = loadBridge({
      pecas: [peca('LOCAL1')],
      programas: [],
      excluidos: { pecas: ['NUVEM2'], programas: [] },
    });

    const app = bridge.mergeCadastro(
      { pecas: [peca('LOCAL1')], roteiros: { '2026-01-01': [] } },
      { pecas: [peca('NUVEM1'), peca('NUVEM2')], programas: [] }
    );

    expect(app.pecas.map((p) => p.code).sort()).toEqual(['LOCAL1', 'NUVEM1']);
    expect(app.roteiros).toEqual({ '2026-01-01': [] }); // dados do roteiro intactos
  });

  it('sem pendências, o cadastro da nuvem continua mandando', () => {
    const bridge = loadBridge({ pecas: [], programas: [], excluidos: { pecas: [], programas: [] } });
    const state = { pecas: [peca('ANTIGA')], programas: [] };
    bridge.aplicarNoEstado(state, { pecas: [peca('NOVA')], programas: [] });
    expect(state.pecas.map((p) => p.code)).toEqual(['NOVA']);
  });
});

describe('fila de pendências (CadastroSync)', () => {
  function loadSync() {
    const src = readFileSync(new URL('../../cadastro-sync.js', import.meta.url), 'utf8');
    const store = new Map();
    const g = {
      localStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      },
      setTimeout: () => 0,
      clearTimeout: () => {},
      console,
    };
    g.window = g;
    new Function('window', 'globalThis', 'localStorage', 'setTimeout', 'clearTimeout', 'module', src)
      .call(g, g, g, g.localStorage, g.setTimeout, g.clearTimeout, undefined);
    return g.CadastroSync;
  }

  it('enfileira criações do Roteiro e nunca deduz exclusões', () => {
    const sync = loadSync();
    sync.init({ allowWrite: true }); // só a tela de cadastro pode escrever
    sync.sincronizarEstado({ pecas: [peca('A'), peca('B')], programas: [] });
    expect(sync.pendentes().pecas.map((p) => p.code).sort()).toEqual(['A', 'B']);

    // Estado local perdeu B (ex.: snapshot antigo) -> NÃO gera exclusão.
    sync.sincronizarEstado({ pecas: [peca('A')], programas: [] });
    expect(sync.pendentes().excluidos.pecas).toEqual([]);

    sync.marcarExclusao('pecas', ['A']);
    expect(sync.pendentes().excluidos.pecas).toEqual(['A']);
    expect(sync.pendentes().pecas.map((p) => p.code)).toEqual(['B']);
  });

  it('sem allowWrite (Roteiro) nada é enfileirado — fluxo de mão única', () => {
    const sync = loadSync();
    sync.init({});
    sync.sincronizarEstado({ pecas: [peca('X')], programas: [] });
    sync.marcarUpsert('pecas', [peca('Y')]);
    sync.marcarExclusao('pecas', ['Z']);
    expect(sync.total()).toBe(0);
  });
});

// ---------------------------------------------------------------
// REGRESSÃO — "peças somem a cada atualização de outro usuário"
// Três causas encontradas na investigação de 2026-09:
//  1) o espelho JSONB (shared_data.pecas), que chega atrasado no tempo real,
//     era tratado como "tudo que existe" e removia peças por ausência;
//  2) leitura relacional truncada (limite de 1000 linhas do PostgREST)
//     produzia o mesmo efeito, em silêncio;
//  3) a comparação de recência lia `row_version`, mas o cadastro entrega
//     `rowVersion` — a edição local mais nova sempre perdia para a nuvem.
// ---------------------------------------------------------------
describe('regressão: fonte não-autoritativa nunca remove peças', () => {
  it('espelho JSONB atrasado não apaga peça que existe no cadastro', () => {
    const bridge = loadBridge();
    const app = bridge.mergeCadastro(
      { pecas: [peca('CADASTRO1'), peca('CADASTRO2')] },
      { pecas: [peca('CADASTRO1')], programas: [], origem: 'shared_data' }
    );
    expect(app.pecas.map((p) => p.code).sort()).toEqual(['CADASTRO1', 'CADASTRO2']);
  });

  it('leitura relacional parcial (paginação truncada) não apaga nada', () => {
    const bridge = loadBridge();
    const state = { pecas: [peca('A'), peca('B')], programas: [] };
    bridge.aplicarNoEstado(state, { pecas: [peca('A')], programas: [], origem: 'relacional', parcial: true });
    expect(state.pecas.map((p) => p.code).sort()).toEqual(['A', 'B']);
  });

  it('cadastro relacional completo continua podendo remover o que foi excluído', () => {
    const bridge = loadBridge();
    const app = bridge.mergeCadastro(
      { pecas: [peca('A'), peca('EXCLUIDA')] },
      { pecas: [peca('A')], programas: [], origem: 'relacional', autoritativo: true }
    );
    expect(app.pecas.map((p) => p.code)).toEqual(['A']);
  });

  it('recência aceita rowVersion (camelCase) vindo do cadastro relacional', () => {
    const bridge = loadBridge();
    const state = { pecas: [peca('A', { rowVersion: 9, descricao: 'edição local nova' })], programas: [] };
    bridge.aplicarNoEstado(state, {
      pecas: [peca('A', { rowVersion: 2, descricao: 'versão antiga da nuvem' })],
      programas: [],
      origem: 'relacional',
    });
    expect(state.pecas[0].descricao).toBe('edição local nova');
  });
});

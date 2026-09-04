// app.js é um script clássico (sem `import`/`export`) carregado pelo
// index.html; extraímos aqui só as funções puras das três novidades
// pedidas — desfazer última ação e ordenação da sidebar por tempo — sem
// precisar montar um DOM completo (o mesmo padrão usado em
// tests/unit/pecasDia.test.mjs).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

// app.js chama init() incondicionalmente na última linha (pensado para
// rodar dentro do index.html). Para isolar só as funções puras que
// interessam ao teste, removemos essa chamada final — sem tocar o
// arquivo de verdade — e fornecemos um `document` mínimo só para não
// quebrar o `document.querySelectorAll('.modal-overlay')` que também
// roda no nível superior do script.
const srcSemBoot = src.replace(/\ninit\(\);\s*$/, '\n');

function loadPure({ localStorage } = {}) {
  const g = { addEventListener() {}, removeEventListener() {} };
  g.window = g;
  const ls = localStorage || {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const document = { querySelectorAll: () => [], getElementById: () => null };
  // Se saveState() (ou qualquer outra função testada aqui) chamar confirm(),
  // o teste falha na hora em vez de travar esperando um clique que nunca
  // vem — é exatamente o tipo de regressão que já aconteceu uma vez (ver
  // describe 'saveState() — regressão travada' mais abaixo neste arquivo).
  const confirm = () => { throw new Error('confirm() não deveria ser chamado aqui'); };
  const factory = new Function(
    'window',
    'globalThis',
    'localStorage',
    'document',
    'confirm',
    `${srcSemBoot}\nreturn {
      registrarUndoSeMudou, popUndoEntry, sortPecasByTempo, dateKey, timeToSec, saveState,
      findVhSeguir, findVhAssistindo, findVhPorFuncaoNoCadastro, baseProgramTitle, _normalizeProgKey,
      __test_getUndoStack: () => undoStack,
      __test_setUndoStack: (v) => { undoStack = v; },
      __test_getState: () => state,
      __test_setState: (v) => { Object.assign(state, v); },
      __test_setRegras: (v) => { Object.assign(REGRAS, v); },
    };`
  );
  return factory.call(g, g.window, g, ls, document, confirm);
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

describe('registrarUndoSeMudou — quando um ponto de desfazer é criado', () => {
  let app;
  beforeEach(() => { app = loadPure(); app.__test_setUndoStack([]); });

  it('não cria ponto de desfazer na primeira gravação do dia (nada salvo antes)', () => {
    app.registrarUndoSeMudou('2026-08-27', undefined, [{ code: 'A' }]);
    expect(app.__test_getUndoStack()).toHaveLength(0);
  });

  it('não cria ponto de desfazer se o conteúdo não mudou', () => {
    const roteiro = [{ code: 'A', tempo: '00:01:00' }];
    app.registrarUndoSeMudou('2026-08-27', roteiro, [{ code: 'A', tempo: '00:01:00' }]);
    expect(app.__test_getUndoStack()).toHaveLength(0);
  });

  it('empilha o estado ANTERIOR (não o novo) quando o conteúdo muda', () => {
    const anterior = [{ code: 'A' }];
    const novo = [{ code: 'A' }, { code: 'B' }];
    app.registrarUndoSeMudou('2026-08-27', anterior, novo);
    const stack = app.__test_getUndoStack();
    expect(stack).toHaveLength(1);
    expect(stack[0]).toEqual({ dateKey: '2026-08-27', roteiro: anterior });
  });

  it('mudanças em dias diferentes empilham entradas com a dateKey correta', () => {
    app.registrarUndoSeMudou('2026-08-27', [{ code: 'A' }], [{ code: 'B' }]);
    app.registrarUndoSeMudou('2026-08-28', [{ code: 'X' }], [{ code: 'Y' }]);
    const stack = app.__test_getUndoStack();
    expect(stack.map((e) => e.dateKey)).toEqual(['2026-08-27', '2026-08-28']);
  });

  it('respeita o limite de histórico (não cresce sem parar)', () => {
    for (let i = 0; i < 60; i++) {
      app.registrarUndoSeMudou('2026-08-27', [{ code: String(i) }], [{ code: String(i + 1) }]);
    }
    expect(app.__test_getUndoStack().length).toBeLessThanOrEqual(50);
  });
});

describe('popUndoEntry — a base do botão "Refazer última ação"', () => {
  let app;
  beforeEach(() => { app = loadPure(); });

  it('sem histórico para o dia, devolve null', () => {
    app.__test_setUndoStack([{ dateKey: '2026-08-26', roteiro: [] }]);
    expect(app.popUndoEntry('2026-08-27')).toBeNull();
  });

  it('devolve e remove a entrada mais recente do dia (LIFO)', () => {
    app.__test_setUndoStack([
      { dateKey: '2026-08-27', roteiro: [{ code: 'V1' }] },
      { dateKey: '2026-08-27', roteiro: [{ code: 'V2' }] },
    ]);
    const primeiro = app.popUndoEntry('2026-08-27');
    expect(primeiro.roteiro).toEqual([{ code: 'V2' }]); // desfaz a ação mais recente primeiro

    const segundo = app.popUndoEntry('2026-08-27');
    expect(segundo.roteiro).toEqual([{ code: 'V1' }]); // clicar de novo anda mais um passo atrás

    expect(app.popUndoEntry('2026-08-27')).toBeNull(); // esgotou o histórico deste dia
  });

  it('não mistura o histórico de dias diferentes', () => {
    app.__test_setUndoStack([
      { dateKey: '2026-08-26', roteiro: [{ code: 'ONTEM' }] },
      { dateKey: '2026-08-27', roteiro: [{ code: 'HOJE' }] },
    ]);
    expect(app.popUndoEntry('2026-08-27').roteiro).toEqual([{ code: 'HOJE' }]);
    // O de ontem continua intacto na pilha.
    expect(app.__test_getUndoStack()).toEqual([{ dateKey: '2026-08-26', roteiro: [{ code: 'ONTEM' }] }]);
  });
});

describe('sortPecasByTempo — ordenação da sidebar por duração', () => {
  const pecas = [
    { code: 'B', tempo: '00:02:00' },
    { code: 'A', tempo: '00:00:30' },
    { code: 'C', tempo: '00:10:00' },
  ];

  it('asc: menor duração primeiro', () => {
    const { sortPecasByTempo } = loadPure();
    expect(sortPecasByTempo(pecas, 'asc').map((p) => p.code)).toEqual(['A', 'B', 'C']);
  });

  it('desc: maior duração primeiro', () => {
    const { sortPecasByTempo } = loadPure();
    expect(sortPecasByTempo(pecas, 'desc').map((p) => p.code)).toEqual(['C', 'B', 'A']);
  });

  it('sem direção (null), mantém a ordem original e não muta o array recebido', () => {
    const { sortPecasByTempo } = loadPure();
    const resultado = sortPecasByTempo(pecas, null);
    expect(resultado.map((p) => p.code)).toEqual(['B', 'A', 'C']);
  });

  it('asc/desc devolvem um array novo — o original não é mutado', () => {
    const { sortPecasByTempo } = loadPure();
    const original = [...pecas];
    sortPecasByTempo(pecas, 'asc');
    expect(pecas).toEqual(original);
  });
});

describe('saveState() — regressão travada (commit 027f405 quebrou isso uma vez, sem erro visível)', () => {
  // Um commit externo (não gerado por mim) tentou resolver um relato de
  // "peças somem ao sincronizar" mexendo aqui — no lugar errado, já que
  // saveState() só grava o espelho local do cadastro, nunca escreve em
  // public.pecas/programas (isso é feito só pela tela Peças e Programas).
  // De quebra, removeu a chamada a registrarUndoSeMudou() (desligando
  // "Desfazer última ação" sem nenhum erro) e adicionou uma chamada a
  // loadState(), função que não existe no arquivo. Revertido; estes
  // testes travam essas duas garantias para não regredir de novo.

  it('não chama confirm() — não deve interromper o usuário com um diálogo bloqueante', () => {
    const app = loadPure({ localStorage: makeLocalStorage() });
    app.__test_setState({ currentDate: new Date(2026, 7, 26), roteiro: [{ code: 'A' }] });
    expect(() => app.saveState()).not.toThrow(); // confirm() lançaria "não deveria ser chamado aqui"
  });

  it('continua chamando registrarUndoSeMudou — "Desfazer última ação" depende disso', () => {
    const ls = makeLocalStorage();
    const app = loadPure({ localStorage: ls });
    const dia = new Date(2026, 7, 26);
    app.__test_setState({ currentDate: dia, roteiro: [{ code: 'A' }] });

    app.saveState(); // primeira gravação do dia — nada para desfazer ainda
    expect(app.__test_getUndoStack()).toHaveLength(0);

    app.__test_setState({ roteiro: [{ code: 'A' }, { code: 'B' }] });
    app.saveState(); // mudou de verdade -> tem que empilhar o estado anterior

    const stack = app.__test_getUndoStack();
    expect(stack).toHaveLength(1);
    expect(stack[0].roteiro).toEqual([{ code: 'A' }]);
  });

  it('não referencia nenhuma função inexistente (ex.: loadState) — só roda mesmo, sem lançar ReferenceError', () => {
    const app = loadPure({ localStorage: makeLocalStorage() });
    app.__test_setState({ currentDate: new Date(2026, 7, 26), roteiro: [] });
    expect(() => app.saveState()).not.toThrow();
  });

  it('grava o roteiro do dia no localStorage (comportamento básico continua intacto)', () => {
    const ls = makeLocalStorage();
    const app = loadPure({ localStorage: ls });
    const dia = new Date(2026, 7, 26);
    app.__test_setState({ currentDate: dia, roteiro: [{ code: 'X' }], pecas: [], programas: [] });

    app.saveState();

    const saved = JSON.parse(ls.getItem('roteiroApp'));
    expect(saved.roteiros[app.dateKey(dia)]).toEqual([{ code: 'X' }]);
  });
});

describe('findVhPorFuncaoNoCadastro / findVhSeguir / findVhAssistindo — Fase 2 do MVP de cadastro', () => {
  it('findVhPorFuncaoNoCadastro acha peça type=EVNH com funcao e programaRelacionado batendo', () => {
    const app = loadPure();
    app.__test_setState({
      pecas: [{ code: 'VH001', descricao: 'VH A SEGUIR PALALOOS', tempo: '00:00:05', midia: '0OMN', type: 'EVNH', funcao: 'vh_a_seguir', programaRelacionado: 'PALALOOS', ativo: true }],
    });
    const r = app.findVhPorFuncaoNoCadastro('vh_a_seguir', app._normalizeProgKey('PALALOOS'));
    expect(r).not.toBeNull();
    expect(r.code).toBe('VH001');
  });

  it('findVhPorFuncaoNoCadastro ignora peça inativa, com funcao diferente, ou de outro type', () => {
    const app = loadPure();
    app.__test_setState({
      pecas: [
        { code: 'A', type: 'EVNH', funcao: 'vh_a_seguir', programaRelacionado: 'PALALOOS', ativo: false },
        { code: 'B', type: 'EVNH', funcao: 'vh_daqui_a_pouco', programaRelacionado: 'PALALOOS' },
        { code: 'C', type: 'RCOM', funcao: 'vh_a_seguir', programaRelacionado: 'PALALOOS' },
      ],
    });
    expect(app.findVhPorFuncaoNoCadastro('vh_a_seguir', app._normalizeProgKey('PALALOOS'))).toBeNull();
  });

  it('findVhPorFuncaoNoCadastro desempata por `ordem` quando há mais de uma peça cadastrada igual', () => {
    const app = loadPure();
    app.__test_setState({
      pecas: [
        { code: 'SEGUNDA', type: 'EVNH', funcao: 'vh_a_seguir', programaRelacionado: 'PALALOOS', ordem: 2 },
        { code: 'PRIMEIRA', type: 'EVNH', funcao: 'vh_a_seguir', programaRelacionado: 'PALALOOS', ordem: 1 },
      ],
    });
    const r = app.findVhPorFuncaoNoCadastro('vh_a_seguir', app._normalizeProgKey('PALALOOS'));
    expect(r.code).toBe('PRIMEIRA');
  });

  it('findVhSeguir: peça cadastrada com funcao/programaRelacionado tem prioridade sobre VH_SEGUIR_MAP', () => {
    const app = loadPure();
    // SCIENTIA existe no VH_SEGUIR_MAP hardcoded (code 90359) — cadastrar
    // uma peça nova para o mesmo programa tem que vencer o mapa antigo.
    app.__test_setState({
      pecas: [{ code: 'NOVO123', descricao: 'VH A SEGUIR SCIENTIA (nova)', tempo: '00:00:05', midia: '0OMN', type: 'EVNH', funcao: 'vh_a_seguir', programaRelacionado: 'SCIENTIA', ativo: true }],
    });
    const r = app.findVhSeguir('PGM SCIENTIA - T01 EP01');
    expect(r.code).toBe('NOVO123');
  });

  it('findVhSeguir: sem peça cadastrada com os campos novos, cai no VH_SEGUIR_MAP de sempre (nada regride)', () => {
    const app = loadPure();
    app.__test_setState({ pecas: [] });
    const r = app.findVhSeguir('PGM SCIENTIA - T01 EP01');
    expect(r).not.toBeNull();
    expect(r.code).toBe('90359'); // code do VH_SEGUIR_MAP hardcoded para SCIENTIA
  });

  it('findVhSeguir: respeita REGRAS.vhSeguirAtivo=false mesmo com peça cadastrada', () => {
    const app = loadPure();
    app.__test_setRegras({ vhSeguirAtivo: false });
    app.__test_setState({
      pecas: [{ code: 'X', type: 'EVNH', funcao: 'vh_a_seguir', programaRelacionado: 'SCIENTIA', ativo: true }],
    });
    expect(app.findVhSeguir('PGM SCIENTIA - T01 EP01')).toBeNull();
  });

  it('findVhAssistindo: peça cadastrada tem prioridade sobre VH_ASSISTINDO_MAP', () => {
    const app = loadPure();
    app.__test_setState({
      pecas: [{ code: 'NOVO456', descricao: 'VH VC ESTA ASSISTINDO SCIENTIA (nova)', tempo: '00:00:05', midia: '0OMN', type: 'EVNH', funcao: 'vh_voce_esta_assistindo', programaRelacionado: 'SCIENTIA', ativo: true }],
    });
    const r = app.findVhAssistindo('PGM SCIENTIA - T01 EP01');
    expect(r.code).toBe('NOVO456');
  });

  it('findVhAssistindo: sem peça cadastrada, cai no VH_ASSISTINDO_MAP de sempre', () => {
    const app = loadPure();
    app.__test_setState({ pecas: [] });
    const r = app.findVhAssistindo('PGM SCIENTIA - T01 EP01');
    expect(r).not.toBeNull();
    expect(r.code).toBe('90360'); // code do VH_ASSISTINDO_MAP hardcoded para SCIENTIA
  });
});

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

function loadPure() {
  const g = { addEventListener() {}, removeEventListener() {} };
  g.window = g;
  const localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const document = { querySelectorAll: () => [], getElementById: () => null };
  const factory = new Function(
    'window',
    'globalThis',
    'localStorage',
    'document',
    `${srcSemBoot}\nreturn {
      registrarUndoSeMudou, popUndoEntry, sortPecasByTempo, dateKey, timeToSec,
      __test_getUndoStack: () => undoStack,
      __test_setUndoStack: (v) => { undoStack = v; },
    };`
  );
  return factory.call(g, g.window, g, localStorage, document);
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

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import BreakDistributor from '../../src/core/breakDistributor.js';

const appSrc = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const srcSemBoot = appSrc.replace(/\ninit\(\);\s*$/, '\n');

function makeFakeEl() {
  return {
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    textContent: '',
    innerHTML: '',
    value: '',
    appendChild() {},
  };
}

describe('executarDistribuicaoBreaks e Relatório Visual (app.js)', () => {
  let ctx;
  let elementsMap;

  beforeEach(() => {
    elementsMap = new Map();
    const getEl = (id) => {
      if (!elementsMap.has(id)) {
        elementsMap.set(id, makeFakeEl());
      }
      return elementsMap.get(id);
    };

    const g = { addEventListener() {}, removeEventListener() {} };
    g.window = g;
    g.BreakDistributor = BreakDistributor;

    const fakeDoc = {
      querySelectorAll: () => [],
      querySelector: () => makeFakeEl(),
      getElementById: (id) => getEl(id),
      createElement: () => makeFakeEl(),
      body: makeFakeEl(),
    };

    const factory = new Function(
      'window',
      'globalThis',
      'localStorage',
      'document',
      'confirm',
      'BreakDistributor',
      `${srcSemBoot}\nreturn {
        state,
        executarDistribuicaoBreaks,
        exibirRelatorioDistribuicaoBreaks
      };`
    );

    ctx = factory(g, g, { getItem: () => null, setItem: () => {}, removeItem: () => {} }, fakeDoc, () => true, BreakDistributor);
    ctx.state.currentDate = new Date(2026, 9, 27);
  });

  it('unifica Peças do Dia com o catálogo mestre e incrementa o contador .usado da peça do dia alocada', () => {
    ctx.state.roteiro = [
      { type: 'PGM', descricao: 'PGM ABERTURA', tempo: '00:15:00' },
      { type: '__SLOT__', descricao: '[ BREAK — chamada ]', tempo: '00:00:30' }
    ];

    // Peça do dia com maior peso
    ctx.state.pecasDia = [
      { code: 'CHM_DIA_01', type: 'ECHM', descricao: 'CHAMADA DO DIA', peso: 9, tempo: '00:00:30', ativo: true, usado: 0 }
    ];

    // Peça do acervo normal com menor peso
    ctx.state.pecas = [
      { code: 'CHM_ACERVO_01', type: 'ECHM', descricao: 'CHAMADA ACERVO', peso: 3, tempo: '00:00:30', ativo: true }
    ];

    ctx.executarDistribuicaoBreaks();

    // O slot deve ter sido preenchido com a chamada do dia
    expect(ctx.state.roteiro[1].code).toBe('CHM_DIA_01');

    // O contador 'usado' na peça do dia correspondente deve ter sido incrementado para 1
    expect(ctx.state.pecasDia[0].usado).toBe(1);

    // O modal de relatório deve ter sido aberto
    const modalEl = elementsMap.get('modal-distribuicao-breaks');
    expect(modalEl.style.display).toBe('flex');

    // O resumo deve conter 1 peça alocada
    const cardsEl = elementsMap.get('dist-breaks-resumo-cards');
    expect(cardsEl.innerHTML).toContain('Total Distribuído');
    expect(cardsEl.innerHTML).toContain('1');
  });

  it('exibirRelatorioDistribuicaoBreaks renderiza detalhes das peças alocadas e slots vazios com motivo', () => {
    const fakeResultado = {
      totalAlocado: 2,
      chamadasPreenchidas: 1,
      interprogramasPreenchidos: 1,
      gapsResolvidos: 0,
      slotsVaziosRestantes: 1,
      alocacoes: [
        { horario: '06:15:00', code: 'CHM01', descricao: 'CHAMADA TESTE', type: 'ECHM', origem: 'pecasDia', tempo: '00:00:30', score: 12 },
        { horario: '06:15:30', code: 'INT01', descricao: 'INTERPROGRAMA TESTE', type: 'EINT', origem: 'pecas', tempo: '00:01:00', score: 7 }
      ],
      slotsNaoPreenchidos: [
        { horario: '07:30:00', descricao: '[ BREAK — comercial ]', tempo: '00:00:30', motivoRecusa: 'Nenhuma peça ativa deste tipo cadastrada' }
      ]
    };

    ctx.exibirRelatorioDistribuicaoBreaks(fakeResultado);

    const modalEl = elementsMap.get('modal-distribuicao-breaks');
    expect(modalEl.style.display).toBe('flex');

    const listaEl = elementsMap.get('dist-breaks-lista-alocadas');
    expect(listaEl.innerHTML).toContain('CHM01');
    expect(listaEl.innerHTML).toContain('INT01');
    expect(listaEl.innerHTML).toContain('Peças do Dia');
    expect(listaEl.innerHTML).toContain('Acervo');

    const vaziosEl = elementsMap.get('dist-breaks-lista-vazios');
    expect(vaziosEl.innerHTML).toContain('Nenhuma peça ativa deste tipo cadastrada');
    expect(vaziosEl.innerHTML).toContain('07:30:00');
  });
});

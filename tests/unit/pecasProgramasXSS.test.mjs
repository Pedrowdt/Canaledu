// Achado da revisão do projeto: a tabela principal de Peças e Programas
// inseria `descricao`/`obs`/`code`/`tempo`/`type`/`midia` direto no
// innerHTML, sem escapar — um XSS armazenado real, já que esses campos são
// texto livre editável por qualquer conta autenticada e o HTML resultante é
// executado no navegador de toda a equipe que abrir a tela. O arquivo já
// tinha `escapeHtml()` (usada no log); só não era aplicada aqui.
//
// Mesmo padrão de extração dos outros testes deste arquivo (new Function +
// mocks mínimos de DOM).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../pecas-programas.js', import.meta.url), 'utf8');

function makeFakeElement(id) {
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
  };
}

function loadApp() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeFakeElement(id));
      return elements.get(id);
    },
    querySelectorAll: () => [],
  };
  const g = { addEventListener() {}, removeEventListener() {} };
  g.window = g;
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const factory = new Function(
    'window', 'globalThis', 'document', 'localStorage', 'console', 'setTimeout', 'clearTimeout',
    `${src}\nreturn {
      render,
      __test_setActiveTab: (t) => { activeTab = t; },
      __test_setPecas: (v) => { pecas = v; },
      __test_setProgramas: (v) => { programas = v; },
    };`
  );
  const app = factory.call(g, g.window, g, document, localStorage, console, setTimeout, clearTimeout);
  return { app, elements };
}

const PAYLOAD = '<img src=x onerror=alert(1)>';

describe('render() escapa campos de texto livre (peças e programas) — regressão de XSS armazenado', () => {
  it('peças: descricao, obs, code, tempo e type não viram HTML executável', () => {
    const { app, elements } = loadApp();
    app.__test_setActiveTab('pecas');
    app.__test_setPecas([{
      id: 'p1', code: PAYLOAD, descricao: PAYLOAD, obs: PAYLOAD,
      tempo: PAYLOAD, type: PAYLOAD, categoria: null, validade: null,
    }]);

    app.render();

    const html = elements.get('tbody').innerHTML;
    expect(html).not.toContain('<img'); // sem tag executável — só o texto escapado
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('programas: descricao, code, tempo, type e midia não viram HTML executável', () => {
    const { app, elements } = loadApp();
    app.__test_setActiveTab('programas');
    app.__test_setProgramas([{
      id: 'g1', code: PAYLOAD, descricao: PAYLOAD, tempo: PAYLOAD,
      type: PAYLOAD, midia: PAYLOAD, assinatura: [],
    }]);

    app.render();

    const html = elements.get('tbody').innerHTML;
    expect(html).not.toContain('<img'); // sem tag executável — só o texto escapado
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('conteúdo normal (sem payload) continua aparecendo legível na tabela', () => {
    const { app, elements } = loadApp();
    app.__test_setActiveTab('pecas');
    app.__test_setPecas([{
      id: 'p1', code: 'VH0001', descricao: 'Vinheta de abertura', obs: '',
      tempo: '00:00:10', type: 'VH', categoria: null, validade: null,
    }]);

    app.render();

    const html = elements.get('tbody').innerHTML;
    expect(html).toContain('VH0001');
    expect(html).toContain('Vinheta de abertura');
  });
});

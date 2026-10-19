import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const srcApp = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const srcAppSemBoot = srcApp.replace(/\ninit\(\);\s*$/, '\n');

function loadAppEnv({ localStorage } = {}) {
  const g = { addEventListener() {}, removeEventListener() {} };
  g.window = g;
  const ls = localStorage || {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const elements = {};
  function getEl(id) {
    if (!elements[id]) {
      elements[id] = {
        id,
        value: '',
        textContent: '',
        innerHTML: '',
        style: {},
        title: '',
        classList: { add() {}, remove() {}, toggle() {} },
        appendChild() {},
      };
    }
    return elements[id];
  }
  const document = {
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: (id) => getEl(id),
    createElement: () => ({ style: {}, classList: { add() {} } }),
    body: { appendChild() {} },
  };

  const factory = new Function(
    'window',
    'globalThis',
    'localStorage',
    'document',
    `${srcAppSemBoot}\nreturn {
      detectarPeriodoSemana,
      normalizarMesGrade,
      editarIdentificacaoSemana,
      fmtLogDetalhes,
      _gradeImport,
      applyGradeSemanalImport,
    };`
  );

  return { app: factory.call(g, g.window, g, ls, document), elements, ls };
}

describe('Grade Semanal — Detecção e Informação de Período (Dia X até Dia Y)', () => {
  it('detecta período simples "08 A 14 DE JUNHO" diretamente do nome da aba', () => {
    const { app } = loadAppEnv();
    const res = app.detectarPeriodoSemana('08 A 14 DE JUNHO', 'grade_2026.xlsx', []);
    expect(res.diaInicio).toBe(8);
    expect(res.diaFim).toBe(14);
    expect(res.mes).toBe('Junho');
    expect(res.descricao).toContain('Dia 08 até o dia 14 de Junho');
    expect(res.diasArray).toEqual(['08', '09', '10', '11', '12', '13', '14']);
  });

  it('detecta transição de mês "29 DE JUNHO A 05 DE JULHO"', () => {
    const { app } = loadAppEnv();
    const res = app.detectarPeriodoSemana('29 DE JUNHO A 05 DE JULHO', 'grade.xlsx', []);
    expect(res.diaInicio).toBe(29);
    expect(res.diaFim).toBe(5);
    expect(res.mes).toBe('Julho');
    expect(res.diasArray[0]).toBe('29');
    expect(res.diasArray[1]).toBe('30');
    expect(res.diasArray[2]).toBe('01');
    expect(res.diasArray[6]).toBe('05');
  });

  it('detecta ano e mês no nome do arquivo quando a aba tem apenas "15 A 21"', () => {
    const { app } = loadAppEnv();
    const res = app.detectarPeriodoSemana('15 A 21', 'Grade Semanal Outubro 2026.xlsx', []);
    expect(res.diaInicio).toBe(15);
    expect(res.diaFim).toBe(21);
    expect(res.mes).toBe('Outubro');
    expect(res.ano).toBe(2026);
    expect(res.descricao).toContain('Dia 15 até o dia 21 de Outubro (2026)');
  });

  it('detecta período nas primeiras linhas da planilha quando o nome da aba é genérico', () => {
    const { app } = loadAppEnv();
    const rows = [
      ['PROGRAMAÇÃO CANAL EDUCAÇÃO'],
      ['GRADE SEMANAL DE 01 A 07 DE NOVEMBRO DE 2026'],
      ['HORÁRIO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO'],
    ];
    const res = app.detectarPeriodoSemana('Semana 1', 'grade.xlsx', rows);
    expect(res.diaInicio).toBe(1);
    expect(res.diaFim).toBe(7);
    expect(res.mes).toBe('Novembro');
    expect(res.ano).toBe(2026);
    expect(res.descricao).toBe('Dia 01 até o dia 07 de Novembro (2026)');
  });

  it('applyGradeSemanalImport persiste gradeSemanalInfo e gradeByDay._info', () => {
    const store = new Map();
    const ls = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
    const { app, elements } = loadAppEnv({ localStorage: ls });
    
    app._gradeImport.parsed = {
      gradeByDay: { 1: { 'AULA 1': '08:00:00' } },
      gradeOrderByDay: { 1: ['AULA 1'] },
    };
    app._gradeImport.detectedPeriodo = {
      descricao: 'Dia 08 até o dia 14 de Junho',
      diaInicio: 8,
      diaFim: 14,
      mes: 'Junho',
    };
    app.elements = elements;
    const elInp = app.elements['grade-import-periodo-input'] || { value: '' };
    elInp.value = 'Dia 08 até o dia 14 de Junho';
    elements['grade-import-periodo-input'] = elInp;

    app.applyGradeSemanalImport();

    const saved = JSON.parse(store.get('roteiroApp'));
    expect(saved.gradeSemanalInfo).toBeDefined();
    expect(saved.gradeSemanalInfo.descricao).toBe('Dia 08 até o dia 14 de Junho');
    expect(saved.gradeByDay._info.descricao).toBe('Dia 08 até o dia 14 de Junho');
  });
});

describe('Mapeamento e Compreensão de Logs — CanalLog', () => {
  it('classifica erros por categoria (inicialização, rede, storage, etc)', async () => {
    const srcLog = readFileSync(new URL('../../canal-log.js', import.meta.url), 'utf8');
    const g = { addEventListener() {}, removeEventListener() {}, location: { href: 'https://canaledu.vercel.app/' } };
    g.window = g;
    const factory = new Function('window', 'globalThis', `${srcLog}\nreturn window.CanalLog;`);
    const canalLog = factory.call(g, g.window, g);

    expect(canalLog.classificarErro('renderPecasSidebarDebounced is not defined')).toBe('inicializacao');
    expect(canalLog.classificarErro('TypeError: Cannot read properties of undefined (reading debounce)')).toBe('inicializacao');
    expect(canalLog.classificarErro('Failed to fetch from Supabase')).toBe('rede_nuvem');
    expect(canalLog.classificarErro('QuotaExceededError: localStorage full')).toBe('armazenamento');
    expect(canalLog.classificarErro('Cannot read properties of null (reading getElementById)')).toBe('interface_dom');
  });

  it('enriquece erro_nao_tratado com categoria e contexto atual', async () => {
    const srcLog = readFileSync(new URL('../../canal-log.js', import.meta.url), 'utf8');
    const g = { addEventListener() {}, removeEventListener() {}, location: { href: 'https://canaledu.vercel.app/' } };
    g.window = g;
    const store = new Map();
    g.localStorage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
    const factory = new Function('window', 'globalThis', `${srcLog}\nreturn window.CanalLog;`);
    const canalLog = factory.call(g, g.window, g);

    canalLog.registrarAcao('Roteiro aberto');
    canalLog.registrarAcao('Clique no botão importar grade');

    const entrada = canalLog.registrar('erro_nao_tratado', {
      mensagem: 'renderPecasSidebarDebounced is not defined',
      arquivo: 'https://canaledu.vercel.app/',
      linha: 1,
    });

    expect(entrada.detalhe.categoria).toBe('inicializacao');
    expect(entrada.detalhe.url).toBe('https://canaledu.vercel.app/');
    expect(entrada.detalhe.breadcrumbs).toEqual([
      'Roteiro aberto',
      'Clique no botão importar grade',
    ]);
  });
});

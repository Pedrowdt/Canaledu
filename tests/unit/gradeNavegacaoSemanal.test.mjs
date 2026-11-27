import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import SemanaUtils from '../../src/core/semanaUtils.js';
import GradeEditorCore from '../../src/core/gradeEditorCore.js';
import GradeRecorrenciaCore from '../../src/core/gradeRecorrenciaCore.js';

const gradeEditorJs = readFileSync(new URL('../../grade-editor.js', import.meta.url), 'utf8');
const cloudSyncJs = readFileSync(new URL('../../cloud-sync.js', import.meta.url), 'utf8');

describe('Etapa 1 — Navegação Semanal e Persistência Independente da Grade', () => {
  let localStorageMock;
  let toasts;

  beforeEach(() => {
    toasts = [];
    const store = new Map();
    localStorageMock = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      _store: store
    };
  });

  function setupGradeEditorEnv(options = {}) {
    const { emissoraId = 'tv-brasil-int', initialSaved = {} } = options;
    const storageKey = emissoraId ? `roteiroApp_${emissoraId}` : 'roteiroApp';

    if (Object.keys(initialSaved).length > 0) {
      localStorageMock.setItem(storageKey, JSON.stringify(initialSaved));
    }

    const docElements = new Map();
    const mockDocument = {
      getElementById: (id) => {
        if (!docElements.has(id)) {
          docElements.set(id, {
            id,
            textContent: '',
            value: '',
            style: {},
            classList: { add() {}, remove() {}, toggle() {} }
          });
        }
        return docElements.get(id);
      },
      querySelector: () => null,
      querySelectorAll: () => []
    };

    const windowMock = {
      SemanaUtils,
      GradeEditorCore,
      GradeRecorrenciaCore,
      EmissoraContext: {
        getEmissoraAtivaId: () => emissoraId
      },
      document: mockDocument,
      localStorage: localStorageMock,
      showToast: (msg, type) => toasts.push({ msg, type })
    };

    // Função de carregamento isolado do grade-editor
    const runner = new Function(
      'window',
      'document',
      'localStorage',
      'SemanaUtils',
      'GradeEditorCore',
      'GradeRecorrenciaCore',
      'showToast',
      `
      let blocksByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      let recurrenceState = { slots: {}, episodeQueues: {}, cursores: {}, excecoesPorData: {} };
      let isDirty = false;
      const DOW_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      function setSyncStatus() {}
      function aplicarHerancaNaGradeUI() {}
      function renderActiveView() {}
      function persistirEstadoRecorrencia() {}
      function atualizarBadgesDias() {}

      function getStorageKey() {
        const emissoraId = window.EmissoraContext ? window.EmissoraContext.getEmissoraAtivaId() : null;
        return emissoraId ? \`roteiroApp_\${emissoraId}\` : 'roteiroApp';
      }

      ${gradeEditorJs.slice(
        gradeEditorJs.indexOf('function gradeTemProgramas(grade)'),
        gradeEditorJs.indexOf('window.ajustarNumeroSemanaGrade = function ()')
      )}

      return {
        obterChaveSemanaAtual,
        obterResumoSemanaAtiva,
        salvarSemanaAtualEmStorage,
        carregarSemanaEmStorage,
        gradeTemProgramas,
        getBlocksByDay: () => blocksByDay,
        setBlocksByDay: (b) => { blocksByDay = b; },
        selecionarSemanaPorData: window.selecionarSemanaPorData,
        navegarSemana: window.navegarSemana,
        gerarGradeSemanaAtualDaAnterior: window.gerarGradeSemanaAtualDaAnterior,
        getStorageKey
      };
      `
    );

    return runner(
      windowMock,
      mockDocument,
      localStorageMock,
      SemanaUtils,
      GradeEditorCore,
      GradeRecorrenciaCore,
      windowMock.showToast
    );
  }

  it('salva a semana atual na chave correta e abre a próxima semana totalmente limpa', () => {
    const emissoraId = 'tv-brasil-int';
    const env = setupGradeEditorEnv({ emissoraId });

    // Preenche a Semana 45 (início 2026-11-02) com programas
    const semana45Slots = GradeEditorCore.generateBaseSlots(6, 30);
    semana45Slots[0].program = { code: 'TVBI_01', title: 'PROGRAMA DA MANHA', tempo: '00:30:00' };
    semana45Slots[1].program = { code: 'TVBI_02', title: 'NOTICIAS DO MUNDO', tempo: '00:30:00' };

    const blocks45 = {
      0: GradeEditorCore.generateBaseSlots(6, 30),
      1: semana45Slots,
      2: GradeEditorCore.generateBaseSlots(6, 30),
      3: GradeEditorCore.generateBaseSlots(6, 30),
      4: GradeEditorCore.generateBaseSlots(6, 30),
      5: GradeEditorCore.generateBaseSlots(6, 30),
      6: GradeEditorCore.generateBaseSlots(6, 30)
    };

    // Seleciona a Semana 45 explicitamente
    env.selecionarSemanaPorData('2026-11-02');
    env.setBlocksByDay(blocks45);

    // Navega para a próxima semana (+1 semana: 2026-11-09)
    env.navegarSemana(1);

    // A grade da nova semana deve estar totalmente limpa (sem os programas da Semana 45)
    const blocks46 = env.getBlocksByDay();
    const seg46ComPrograma = blocks46[1].filter(s => s.program && s.program.title);
    expect(seg46ComPrograma.length).toBe(0);

    // Verifica que no localStorage a Semana 45 foi preservada intacta em gradesPorSemana
    const rawStorage = JSON.parse(localStorageMock.getItem(`roteiroApp_${emissoraId}`));
    expect(rawStorage.gradesPorSemana['2026-11-02']).toBeDefined();
    const seg45Salva = rawStorage.gradesPorSemana['2026-11-02'][1].filter(s => s.program && s.program.title);
    expect(seg45Salva.length).toBe(2);
    expect(seg45Salva[0].program.code).toBe('TVBI_01');

    // E a semana atual ativa é 2026-11-09
    expect(rawStorage.semanaDataBase).toBe('2026-11-09');
  });

  it('navegar de volta para a semana anterior restaura os programas salvos', () => {
    const emissoraId = 'tv-brasil-int';
    const env = setupGradeEditorEnv({ emissoraId });

    // Configura e salva Semana 45 (2026-11-02)
    env.selecionarSemanaPorData('2026-11-02');
    const blocks45 = {
      0: GradeEditorCore.generateBaseSlots(6, 30),
      1: GradeEditorCore.generateBaseSlots(6, 30),
      2: GradeEditorCore.generateBaseSlots(6, 30),
      3: GradeEditorCore.generateBaseSlots(6, 30),
      4: GradeEditorCore.generateBaseSlots(6, 30),
      5: GradeEditorCore.generateBaseSlots(6, 30),
      6: GradeEditorCore.generateBaseSlots(6, 30)
    };
    blocks45[1][4].program = { code: 'TVBI_JOURNAL', title: 'JORNAL INTERNACIONAL', tempo: '00:30:00' };
    env.setBlocksByDay(blocks45);

    // Navega para próxima semana (+1)
    env.navegarSemana(1);
    expect(env.getBlocksByDay()[1][4].program).toBeNull();

    // Navega de volta para a semana anterior (-1)
    env.navegarSemana(-1);
    const blocksRestaurada = env.getBlocksByDay();
    expect(blocksRestaurada[1][4].program).not.toBeNull();
    expect(blocksRestaurada[1][4].program.code).toBe('TVBI_JOURNAL');
    expect(blocksRestaurada[1][4].program.title).toBe('JORNAL INTERNACIONAL');
  });

  it('selecionar semana por data carrega diretamente a chave correta e não contamina', () => {
    const emissoraId = 'tv-brasil-int';
    const env = setupGradeEditorEnv({ emissoraId });

    // Salva algo na semana de 09/11/2026
    env.selecionarSemanaPorData('2026-11-09');
    const blocksNov09 = {
      0: GradeEditorCore.generateBaseSlots(6, 30),
      1: GradeEditorCore.generateBaseSlots(6, 30),
      2: GradeEditorCore.generateBaseSlots(6, 30),
      3: GradeEditorCore.generateBaseSlots(6, 30),
      4: GradeEditorCore.generateBaseSlots(6, 30),
      5: GradeEditorCore.generateBaseSlots(6, 30),
      6: GradeEditorCore.generateBaseSlots(6, 30)
    };
    blocksNov09[1][0].program = { code: 'TVBI_ESP', title: 'ESPECIAL INTERNACIONAL' };
    env.setBlocksByDay(blocksNov09);

    // Seleciona uma semana distante no futuro via calendário (ex: 14/12/2026)
    env.selecionarSemanaPorData('2026-12-14');

    // A semana futura deve estar limpa
    const blocksFutura = env.getBlocksByDay();
    expect(blocksFutura[1].some(s => s.program && s.program.title)).toBe(false);

    // Volta para 09/11/2026 via calendário
    env.selecionarSemanaPorData('2026-11-09');
    const blocksRecarregada = env.getBlocksByDay();
    expect(blocksRecarregada[1][0].program.code).toBe('TVBI_ESP');
  });

  it('não copia a grade atual quando a semana anterior não existir', () => {
    const emissoraId = 'tv-brasil-int';
    const env = setupGradeEditorEnv({ emissoraId });

    // Semana atual 09/11/2026, com uma grade montada na tela
    env.selecionarSemanaPorData('2026-11-09');
    const gradeAtual = {
      0: GradeEditorCore.generateBaseSlots(6, 30),
      1: GradeEditorCore.generateBaseSlots(6, 30),
      2: GradeEditorCore.generateBaseSlots(6, 30),
      3: GradeEditorCore.generateBaseSlots(6, 30),
      4: GradeEditorCore.generateBaseSlots(6, 30),
      5: GradeEditorCore.generateBaseSlots(6, 30),
      6: GradeEditorCore.generateBaseSlots(6, 30)
    };
    gradeAtual[1][2].program = { code: 'PROG_ATUAL', title: 'PROGRAMA DA SEMANA ATUAL' };
    env.setBlocksByDay(gradeAtual);

    // Tentativa de gerar a partir da anterior (02/11/2026), que NÃO existe
    toasts.length = 0;
    env.gerarGradeSemanaAtualDaAnterior();

    // Deve emitir aviso de que não há grade anterior disponível
    expect(toasts.length).toBeGreaterThan(0);
    expect(toasts[0].type).toBe('warning');
    expect(toasts[0].msg).toContain('Não há grade anterior disponível');

    // A grade atual NÃO deve ter sido sobrescrita com fallback
    expect(env.getBlocksByDay()[1][2].program.code).toBe('PROG_ATUAL');
  });

  it('quando a semana anterior existe, gera nova semana avançando inéditos e espelhando reprises', () => {
    const emissoraId = 'tv-brasil-int';
    const env = setupGradeEditorEnv({ emissoraId });

    // Semana anterior: 2026-11-02
    env.selecionarSemanaPorData('2026-11-02');
    const gradeSemana1 = {
      0: GradeEditorCore.generateBaseSlots(6, 30),
      1: [
        { id: 's1', time: '10:00', tipoExibicao: 'inedito', program: { code: 'TVBI_P1', title: 'PROGRAMA 1' } },
        { id: 's2', time: '12:00', tipoExibicao: 'fixo', isAoVivo: true, program: { code: 'TVBI_LIVE', title: 'JORNAL AO VIVO' } }
      ],
      2: GradeEditorCore.generateBaseSlots(6, 30),
      3: [
        { id: 's3', time: '16:00', tipoExibicao: 'reprise', mestreSlotId: 's1', program: { code: 'TVBI_P1', title: 'PROGRAMA 1' } }
      ],
      4: GradeEditorCore.generateBaseSlots(6, 30),
      5: GradeEditorCore.generateBaseSlots(6, 30),
      6: GradeEditorCore.generateBaseSlots(6, 30)
    };
    env.setBlocksByDay(gradeSemana1);

    // Navega para 2026-11-09 (nova semana, abre limpa)
    env.navegarSemana(1);

    // Agora gera da semana anterior
    toasts.length = 0;
    env.gerarGradeSemanaAtualDaAnterior();

    expect(toasts.some(t => t.type === 'success')).toBe(true);
    const gradeGerada = env.getBlocksByDay();
    expect(gradeGerada[1].length).toBe(2);
    expect(gradeGerada[1][1].isAoVivo).toBe(true);
    expect(gradeGerada[1][1].horarioFixo).toBe('12:00');
  });

  it('preserva gradesPorSemana no cloud-sync para que a nuvem não descarte semanas cadastradas', () => {
    expect(cloudSyncJs).toContain('merged.gradesPorSemana           = localRaw.gradesPorSemana || {};');
  });
});

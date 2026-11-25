import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../src/core/gradeRoteiroSyncCore.js', import.meta.url), 'utf8');

function loadSyncCore() {
  const g = {};
  new Function('window', 'globalThis', src).call(g, g, g);
  return g.GradeRoteiroSyncCore;
}

describe('GradeRoteiroSyncCore — Etapa 3.4: Sincronização Grade -> Roteiro Preservando Edições', () => {
  const Core = loadSyncCore();

  it('exporta todas as funções essenciais de particionamento, mesclagem e publicação', () => {
    expect(typeof Core.desestruturarRoteiro).toBe('function');
    expect(typeof Core.normalizarSlotsGradeDoDia).toBe('function');
    expect(typeof Core.mesclarGradeComRoteiroPreservandoEdicoes).toBe('function');
    expect(typeof Core.prepararPublicacaoGradeSemanal).toBe('function');
    expect(typeof Core.verificarGradePendenteParaData).toBe('function');
  });

  it('identifica corretamente peças manuais, programas e slots vazios', () => {
    expect(Core.isProgramaItem({ type: 'RPRO', descricao: 'PGM PALALOOS' })).toBe(true);
    expect(Core.isProgramaItem({ type: 'GPRO', descricao: 'JORNAL GOV' })).toBe(true);
    expect(Core.isProgramaItem({ type: 'ECHM', descricao: 'CHM REPORTER' })).toBe(false);

    expect(Core.isSlotVazio({ code: '__BREAK__', type: '__SLOT__' })).toBe(true);
    expect(Core.isSlotVazio({ _break: true })).toBe(true);
    expect(Core.isSlotVazio({ _gap: true })).toBe(true);

    expect(Core.isPecaManual({ type: 'ECHM', code: '92115', descricao: 'CHAMADA ESPECIAL' })).toBe(true);
    expect(Core.isPecaManual({ type: 'EINT', code: '11814', descricao: 'FALA BRASIL' })).toBe(true);
    expect(Core.isPecaManual({ type: 'EVNH', code: '86100', descricao: 'VINHETA MANUAL' })).toBe(true);
  });

  it('desestrutura o roteiro agrupando programas e suas peças nos breaks correspondentes', () => {
    const roteiroMock = [
      { code: 'FIXA_ABERTURA', type: 'EVNH', tempo: '00:00:10', _fixa: true, posicao: 'inicio' },
      { code: 'PROG1_B1', type: 'RPRO', descricao: 'PGM CIENCIA - BL 01', tempo: '00:12:00', bloco: 1 },
      { code: '92115', type: 'ECHM', descricao: 'CHM REPORTER BRASIL', tempo: '00:00:30' },
      { code: '11814', type: 'EINT', descricao: 'FALA BRASIL - ARTE', tempo: '00:01:00' },
      { code: 'PROG1_B2', type: 'RPRO', descricao: 'PGM CIENCIA - BL 02', tempo: '00:11:30', bloco: 2 },
      { code: '86200', type: 'EVNH', descricao: 'VH INTERVALO 1', tempo: '00:00:05' },
      { code: 'PROG2_B1', type: 'RPRO', descricao: 'PGM HISTORIA - BL 01', tempo: '00:26:00', bloco: 1 },
      { code: 'FIXA_ENCERRAMENTO', type: 'EVNH', tempo: '00:00:10', _fixa: true, posicao: 'fim' }
    ];

    const part = Core.desestruturarRoteiro(roteiroMock);
    expect(part.fixasInicio.length).toBe(1);
    expect(part.fixasInicio[0].code).toBe('FIXA_ABERTURA');
    expect(part.fixasFim.length).toBe(1);
    expect(part.fixasFim[0].code).toBe('FIXA_ENCERRAMENTO');

    expect(part.gruposProgramas.length).toBe(2);
    const g1 = part.gruposProgramas[0];
    expect(g1.tituloBase).toBe('CIENCIA');
    expect(g1.blocos.length).toBe(2);
    expect(g1.pecasBreakFinal.some(p => p.code === '92115' || p.code === '86200')).toBe(true);
  });

  it('caso 1: preenche roteiro do zero a partir da grade quando o roteiro está vazio', () => {
    const slotsGrade = [
      {
        time: '08:00:00',
        duration: '00:30:00',
        program: { title: 'PGM REPORTER VISUAL', code: 'REP_VISUAL' }
      },
      {
        time: '08:30:00',
        duration: '00:30:00',
        program: { title: 'PGM PALALOOS', code: 'PALAL' }
      }
    ];

    const resultado = Core.mesclarGradeComRoteiroPreservandoEdicoes([], slotsGrade);
    expect(resultado.resumo.programasNovos).toBe(2);
    expect(resultado.roteiroAtualizado.length).toBeGreaterThan(2);

    const progs = resultado.roteiroAtualizado.filter(Core.isProgramaItem);
    expect(progs.length).toBeGreaterThanOrEqual(2);
    expect(progs[0].descricao).toContain('REPORTER VISUAL');
  });

  it('caso 2: PRESERVA 100% DAS CHAMADAS E VINHETAS MANUAIS ao atualizar episódios da Grade', () => {
    // Cenário real de produção: operador já montou chamadas e interprogramas no break do programa
    const roteiroExistente = [
      { code: 'PALAL_B1', type: 'RPRO', descricao: 'PGM PALALOOS - BL 01', tempo: '00:12:00', bloco: 1 },
      { code: '92115', type: 'ECHM', descricao: 'CHM REPORTER BRASIL MANHA', tempo: '00:00:30' },
      { code: '11814', type: 'EINT', descricao: 'FALA POVO EP 02', tempo: '00:01:00' },
      { code: '86201', type: 'EVNH', descricao: 'VH ASSISTA MAIS TARDE', tempo: '00:00:10' },
      { code: 'PALAL_B2', type: 'RPRO', descricao: 'PGM PALALOOS - BL 02', tempo: '00:12:00', bloco: 2 }
    ];

    // Nova grade semanal publicada traz o episódio resolvido da semana: "O Resgate do Amigo"
    const novaGrade = [
      {
        time: '08:00:00',
        duration: '00:30:00',
        tipoExibicao: 'inedito',
        program: {
          title: 'PGM PALALOOS',
          code: 'PALAL',
          episodio: {
            titulo: 'O Resgate do Amigo',
            temporada: 2,
            episodioNumero: 5,
            codigo: 'PAL_T02EP05'
          }
        }
      }
    ];

    const { roteiroAtualizado, resumo } = Core.mesclarGradeComRoteiroPreservandoEdicoes(roteiroExistente, novaGrade);

    expect(resumo.programasAtualizados).toBe(1);
    expect(resumo.pecasManuaisPreservadas).toBe(3); // 92115, 11814, 86201 preservadas!

    // Verifica que todas as 3 peças inseridas pelo operador continuam presentes no roteiro resultante
    const codigosPresentes = roteiroAtualizado.map(i => i.code);
    expect(codigosPresentes).toContain('92115');
    expect(codigosPresentes).toContain('11814');
    expect(codigosPresentes).toContain('86201');

    // E o título do programa foi enriquecido com o novo episódio da Grade
    const blocoProg = roteiroAtualizado.find(i => i.code === 'PALAL_B1');
    expect(blocoProg.descricao).toContain('O Resgate do Amigo');
    expect(blocoProg.episodioTitulo).toBe('O Resgate do Amigo');
    expect(blocoProg.temporada).toBe(2);
    expect(blocoProg.episodioNumero).toBe(5);
  });

  it('caso 3: insere novo programa da grade na ordem correta sem apagar peças vizinhas', () => {
    const roteiroExistente = [
      { code: 'PROG_A_B1', type: 'RPRO', descricao: 'PGM A - BL 01', tempo: '00:26:00', bloco: 1 },
      { code: 'CHM_01', type: 'ECHM', descricao: 'CHAMADA A', tempo: '00:00:30' },
      { code: 'PROG_B_B1', type: 'RPRO', descricao: 'PGM B - BL 01', tempo: '00:26:00', bloco: 1 },
      { code: 'CHM_02', type: 'ECHM', descricao: 'CHAMADA B', tempo: '00:00:30' }
    ];

    // Nova grade inseriu o "PGM NOVO" entre o PGM A e PGM B
    const novaGrade = [
      { time: '08:00:00', program: { title: 'PGM A' } },
      { time: '08:30:00', program: { title: 'PGM NOVO' } },
      { time: '09:00:00', program: { title: 'PGM B' } }
    ];

    const { roteiroAtualizado, resumo } = Core.mesclarGradeComRoteiroPreservandoEdicoes(roteiroExistente, novaGrade);

    expect(resumo.programasAtualizados).toBe(2); // PGM A e PGM B
    expect(resumo.programasNovos).toBe(1);       // PGM NOVO
    expect(resumo.pecasManuaisPreservadas).toBe(2); // CHAMADA A e CHAMADA B

    const descricoes = roteiroAtualizado.map(i => i.descricao);
    expect(descricoes.some(d => d.includes('PGM NOVO'))).toBe(true);
    expect(roteiroAtualizado.some(i => i.code === 'CHM_01')).toBe(true);
    expect(roteiroAtualizado.some(i => i.code === 'CHM_02')).toBe(true);
  });

  it('caso 4: preserva blocos e peças manuais caso um programa não conste mais na grade', () => {
    const roteiroExistente = [
      { code: 'PROG_SAIU', type: 'RPRO', descricao: 'PGM ANTIGO', tempo: '00:26:00', bloco: 1 },
      { code: 'CHM_IMPORTANTE', type: 'ECHM', descricao: 'CHAMADA IMPORTANTE', tempo: '00:00:30' }
    ];

    const novaGrade = [
      { time: '08:00:00', program: { title: 'PGM DIFERENTE' } }
    ];

    const { roteiroAtualizado, resumo } = Core.mesclarGradeComRoteiroPreservandoEdicoes(roteiroExistente, novaGrade);

    expect(resumo.programasRemovidos).toBe(1);
    expect(resumo.pecasManuaisPreservadas).toBe(1);
    // Não perde a peça manual do operador
    expect(roteiroAtualizado.some(i => i.code === 'CHM_IMPORTANTE')).toBe(true);
    expect(roteiroAtualizado.some(i => i.descricao.includes('[NÃO CONSTA NA NOVA GRADE]'))).toBe(true);
  });

  it('caso 5: permite substituição completa quando modo=substituir for selecionado', () => {
    const roteiroExistente = [
      { code: 'VELHO', type: 'RPRO', descricao: 'VELHO' },
      { code: 'CHM_OLD', type: 'ECHM', descricao: 'CHM OLD' }
    ];
    const novaGrade = [
      { time: '10:00:00', program: { title: 'NOVO PGM' } }
    ];

    const { roteiroAtualizado, resumo } = Core.mesclarGradeComRoteiroPreservandoEdicoes(roteiroExistente, novaGrade, { modo: 'substituir' });
    expect(resumo.modo).toBe('substituir');
    expect(roteiroAtualizado.some(i => i.code === 'CHM_OLD')).toBe(false);
    expect(roteiroAtualizado.some(i => i.descricao.includes('NOVO PGM'))).toBe(true);
  });

  it('caso 6: herança de reprises chega ao roteiro com etiqueta e status de reprise', () => {
    const novaGrade = [
      {
        time: '20:00:00',
        isReprise: true,
        tipoExibicao: 'reprise',
        origemReprise: { diaSemana: 1, horario: '08:00:00' },
        program: {
          title: 'PGM DOCUMENTARIOS',
          episodio: { titulo: 'Biomas Brasileiros' }
        }
      }
    ];

    const { roteiroAtualizado } = Core.mesclarGradeComRoteiroPreservandoEdicoes([], novaGrade);
    const prog = roteiroAtualizado.find(Core.isProgramaItem);
    expect(prog.isReprise).toBe(true);
    expect(prog.descricao).toContain('(REPRISE)');
    expect(prog.descricao).toContain('Biomas Brasileiros');
  });

  it('prepararPublicacaoGradeSemanal empacota metadados auditáveis com versão e timestamp', () => {
    const pacote = Core.prepararPublicacaoGradeSemanal({
      emissoraId: 'tv-brasil',
      blocksByDay: { 1: [{ time: '08:00:00' }] },
      recurrenceState: { slots: {} },
      resumoSemana: { numeroSemana: 45, periodoFormatado: '09/11 a 15/11/2026', rotuloCompleto: 'Semana 45' },
      publicadoPor: 'pedro@ebc.gov.br'
    });

    expect(pacote.info.versao).toBeGreaterThan(0);
    expect(pacote.info.emissoraId).toBe('tv-brasil');
    expect(pacote.info.semanaNumero).toBe(45);
    expect(pacote.info.publicadoPor).toBe('pedro@ebc.gov.br');
    expect(pacote.info.status).toBe('publicada');
  });

  it('verificarGradePendenteParaData detecta quando há versão de grade mais nova que a do roteiro', () => {
    const gradePublicadaInfo = {
      versao: 1732280000000,
      publicadoEm: '2026-11-22T12:00:00Z',
      semanaNumero: 45,
      rotuloCompleto: 'Semana 45 (09 a 15/11)'
    };

    // Roteiro salvo sem versão da grade (versão 0) -> pendente = true
    const check1 = Core.verificarGradePendenteParaData('2026-11-10', {}, gradePublicadaInfo);
    expect(check1.pendente).toBe(true);
    expect(check1.semanaNumero).toBe(45);

    // Roteiro sincronizado com a mesma versão -> pendente = false
    const check2 = Core.verificarGradePendenteParaData('2026-11-10', { _metaGrade: { versaoGrade: 1732280000000 } }, gradePublicadaInfo);
    expect(check2.pendente).toBe(false);

    // Roteiro sincronizado com versão anterior -> pendente = true
    const check3 = Core.verificarGradePendenteParaData('2026-11-10', { _metaGrade: { versaoGrade: 1732270000000 } }, gradePublicadaInfo);
    expect(check3.pendente).toBe(true);
  });

  it('preserva breaks internos de múltiplos blocos e recalcula tempos cumulativos', () => {
    const roteiroExistente = [
      { code: 'PALAL_B1', type: 'RPRO', descricao: 'PGM PALALOOS - BL 01', tempo: '00:10:00', bloco: 1, totalBlocos: 3 },
      { code: 'CHM_INT_1', type: 'ECHM', descricao: 'CHAMADA INTERNA 1', tempo: '00:00:30' },
      { code: 'PALAL_B2', type: 'RPRO', descricao: 'PGM PALALOOS - BL 02', tempo: '00:10:00', bloco: 2, totalBlocos: 3 },
      { code: 'INT_01', type: 'EINT', descricao: 'INTERPROGRAMA 1', tempo: '00:01:00' },
      { code: 'PALAL_B3', type: 'RPRO', descricao: 'PGM PALALOOS - BL 03', tempo: '00:10:00', bloco: 3, totalBlocos: 3 }
    ];

    const novaGrade = [
      {
        time: '08:00:00',
        program: {
          title: 'PGM PALALOOS',
          episodio: {
            titulo: 'A Nova Aventura',
            blocos: [
              { bloco: 1, duracao: '00:10:00' },
              { bloco: 2, duracao: '00:10:00' },
              { bloco: 3, duracao: '00:10:00' }
            ]
          }
        }
      }
    ];

    const { roteiroAtualizado, resumo } = Core.mesclarGradeComRoteiroPreservandoEdicoes(roteiroExistente, novaGrade);
    expect(resumo.pecasManuaisPreservadas).toBe(2);
    expect(roteiroAtualizado.some(i => i.code === 'CHM_INT_1')).toBe(true);
    expect(roteiroAtualizado.some(i => i.code === 'INT_01')).toBe(true);

    // Checa continuidade e acúmulo dos horários IN e OUT
    expect(roteiroAtualizado[0].in).toBe('06:00:00');
    for (let k = 1; k < roteiroAtualizado.length; k++) {
      expect(roteiroAtualizado[k].in).toBe(roteiroAtualizado[k - 1].out);
    }
  });

  it('suporta sincronização de atrações vindas de Faixa Desmembrada', () => {
    const slotsGrade = [
      {
        time: '07:30:00',
        duracao: '00:15:00',
        faixaNome: 'TV BRASIL ANIMADA',
        program: {
          title: 'O SHOW DA LUNA - T01 EP01',
          code: 'LUNA_01',
          categoria: 'Infantil'
        }
      },
      {
        time: '07:45:00',
        duracao: '00:15:00',
        faixaNome: 'TV BRASIL ANIMADA',
        program: {
          title: 'SOS FADA MANU - T01 EP02',
          code: 'MANU_02',
          categoria: 'Infantil'
        }
      }
    ];

    const { roteiroAtualizado, resumo } = Core.mesclarGradeComRoteiroPreservandoEdicoes([], slotsGrade);
    expect(resumo.programasNovos).toBe(2);
    expect(roteiroAtualizado.some(i => i.descricao.includes('SHOW DA LUNA'))).toBe(true);
    expect(roteiroAtualizado.some(i => i.descricao.includes('FADA MANU'))).toBe(true);
  });

  it('vincula slots da Grade ao acervo e usa codes/tempos oficiais por episódio e bloco', () => {
    const acervo = [
      { code: 'CE136463_1', descricao: 'PGM VIDA DE MERENDEIRA - T 03 EP 04 - BL 01', tempo: '00:14:04', midia: '0OMN', type: 'RPRO' },
      { code: 'CE136463_2', descricao: 'PGM VIDA DE MERENDEIRA - T 03 EP 04 - BL 02', tempo: '00:12:57', midia: '0OMN', type: 'RPRO' },
      { code: 'CE136463_3', descricao: 'PGM VIDA DE MERENDEIRA - T 03 EP 04 - BL 03', tempo: '00:23:15', midia: '0OMN', type: 'RPRO' },
      { code: 'CE999999_1', descricao: 'PGM VIDA DE MERENDEIRA - T 03 EP 05 - BL 01', tempo: '00:14:00', midia: '0OMN', type: 'RPRO' }
    ];
    const slots = [{
      id: 'slot-real', time: '08:00:00', duration: '00:15:00',
      program: { title: 'VIDA DE MERENDEIRA', tempo: '00:50:16', code: 'CE136463_1', type: 'RPRO' },
      episodio: { temporada: 3, episodioNumero: 4, titulo: 'T 03 EP 04' }
    }];

    const resultado = Core.mesclarGradeComRoteiroPreservandoEdicoes([], slots, { modo: 'substituir', acervo });
    const programas = resultado.roteiroAtualizado.filter(item => item.type === 'RPRO');
    expect(programas.map(item => item.code)).toEqual(['CE136463_1', 'CE136463_2', 'CE136463_3']);
    expect(programas.map(item => item.tempo)).toEqual(['00:14:04', '00:12:57', '00:23:15']);
    expect(programas.some(item => /_B\d+$|^GRD_/.test(item.code))).toBe(false);
  });

  it('usa o código e a duração oficial de um registro único em vez de criar bloco genérico', () => {
    const acervo = [{ code: 'AD926703', descricao: 'PGM PALALOOS - T 01 EP 04 - ROLANDO TUDO AZUL', tempo: '00:10:00', midia: '0OMN', type: 'RPRO' }];
    const slots = [{ time: '09:00:00', duration: '00:15:00', program: { title: 'PALALOOS - T 01 EP 04 - ROLANDO TUDO AZUL', code: 'AD926703', tempo: '00:10:00', type: 'RPRO' } }];
    const resultado = Core.mesclarGradeComRoteiroPreservandoEdicoes([], slots, { modo: 'substituir', acervo });
    const programas = resultado.roteiroAtualizado.filter(item => item.type === 'RPRO');
    expect(programas).toHaveLength(1);
    expect(programas[0].code).toBe('AD926703');
    expect(programas[0].tempo).toBe('00:10:00');
  });

  it('não vincula blocos de outro episódio quando a grade identifica temporada e episódio', () => {
    const acervo = [
      { code: 'CEEP05_1', descricao: 'PGM VIDA DE MERENDEIRA - T 03 EP 05 - BL 01', tempo: '00:14:00', type: 'RPRO' }
    ];
    const slots = [{
      time: '08:00:00', duration: '00:15:00',
      program: { title: 'VIDA DE MERENDEIRA', code: 'CEEP05_1', tempo: '00:14:00', type: 'RPRO' },
      episodio: { temporada: 3, episodioNumero: 4, titulo: 'T 03 EP 04' }
    }];
    const resultado = Core.mesclarGradeComRoteiroPreservandoEdicoes([], slots, { modo: 'substituir', acervo });
    const programas = resultado.roteiroAtualizado.filter(item => item.type === 'RPRO');
    expect(programas).toHaveLength(1);
    expect(programas[0].code).not.toBe('CEEP05_1');
    expect(programas[0]._catalogoOficial).not.toBe(true);
  });

  it('seleciona a grade somente quando a data está no período publicado', () => {
    const saved = {
      gradePublicadaInfo: { dataInicio: '2026-11-09', dataFim: '2026-11-15', versao: 4 },
      gradePublicadaBlocksByDay: { 1: [{ id: 'segunda-publicada' }] },
      gradeBlocksByDay: { 1: [{ id: 'segunda-rascunho' }] }
    };
    expect(Core.selecionarGradeParaData('2026-11-09', 1, saved)).toMatchObject({
      dentroDaSemana: true, fonte: 'publicada', blocks: [{ id: 'segunda-publicada' }]
    });
    expect(Core.selecionarGradeParaData('2026-11-16', 1, saved)).toMatchObject({
      dentroDaSemana: false, fonte: 'fora_da_vigencia', blocks: []
    });
  });

  it('usa o rascunho da semana quando não há snapshot publicado, sem sair do intervalo', () => {
    const saved = {
      gradePublicadaInfo: { dataInicio: '2026-11-09', dataFim: '2026-11-15' },
      gradeBlocksByDay: { 2: [{ id: 'terca-da-semana' }] }
    };
    expect(Core.selecionarGradeParaData('2026-11-10', 2, saved)).toMatchObject({
      dentroDaSemana: true, fonte: 'rascunho', blocks: [{ id: 'terca-da-semana' }]
    });
  });

  it('regera a sequência de vinhetas para programas existentes sem mexer em grupos editados manualmente', () => {
    const grade = [{ time: '08:00:00', duration: '00:30:00', program: { title: 'JORNAL TESTE', code: 'JT01', tempo: '00:20:00', type: 'RPRO' } }];
    const existente = [{ type: 'RPRO', code: 'JT_OLD', descricao: 'JORNAL TESTE', tempo: '00:15:00', bloco: 1 }];
    const resultado = Core.mesclarGradeComRoteiroPreservandoEdicoes(existente, grade, {
      modo: 'inteligente',
      geradorSequenciaPrograma: blocos => [{ type: 'EVNH', code: 'AUTO_VH', descricao: 'VINHETA AUTOMÁTICA', tempo: '00:00:05' }, ...blocos]
    });
    expect(resultado.roteiroAtualizado[0].code).toBe('AUTO_VH');
    expect(resultado.roteiroAtualizado.some(item => item.type === 'RPRO')).toBe(true);
  });

});

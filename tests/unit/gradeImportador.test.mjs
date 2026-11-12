import { describe, it, expect } from 'vitest';
import GradeImportador from '../../src/core/gradeImportador.js';

describe('GradeImportador', () => {
  it('preset da TV Brasil Semana 44 possui os 7 dias completos', () => {
    const preset = GradeImportador.GRADE_TV_BRASIL_SEMANA_44;
    expect(preset).toBeDefined();
    expect(preset.emissoraNome).toBe('TV Brasil');
    expect(preset.dias).toBeDefined();

    for (let dow = 0; dow <= 6; dow++) {
      const diaSlots = preset.dias[dow];
      expect(Array.isArray(diaSlots)).toBe(true);
      expect(diaSlots.length).toBeGreaterThan(10);
    }
  });

  it('prepararPreviaImportacao detecta novos programas e calcula métricas', () => {
    const acervoExistente = [
      { title: 'Sem Censura', code: 'SC_01', categoria: 'Entrevistas' },
    ];

    const previa = GradeImportador.prepararPreviaImportacao(
      GradeImportador.GRADE_TV_BRASIL_SEMANA_44,
      acervoExistente
    );

    expect(previa.totalSlots).toBeGreaterThan(100);
    expect(previa.novosProgramas.length).toBeGreaterThan(0);

    // 'Sem Censura' já estava no acervo, não deve ser duplicado como novo
    const achouSemCensura = previa.novosProgramas.some(p => p.title.toUpperCase() === 'SEM CENSURA');
    expect(achouSemCensura).toBe(false);

    // Verifica se 'Repórter Brasil Tarde' entrou nos novos programas
    const achouReporter = previa.novosProgramas.some(p => p.title === 'Repórter Brasil Tarde');
    expect(achouReporter).toBe(true);

    // Verifica resumo dos 7 dias
    expect(previa.diasResumo[1].totalSlots).toBeGreaterThan(0);
    expect(previa.slotsPorDia[1].length).toBeGreaterThan(0);
    expect(previa.recorrenciaSugerida.slots['1:17:00:00']).toBeDefined();
    expect(previa.recorrenciaSugerida.slots['1:00:30:00'].tipoExibicao).toBe('reprise');
  });

  it('parseCsvGrade converte CSV com delimitador ponto e vírgula', () => {
    const csv = `
dia;horario;duracao;programa;codigo;categoria;tipo
segunda;06:00;00:30;Telejornal Manhã;TJM01;Jornalismo;inedito
segunda;06:30;00:30;Desenho Especial;DES01;Infantil;inedito
terça;07:00;01:00;Documentário Brasil;DOC01;Cultura;reprise
`;

    const parsed = GradeImportador.parseCsvGrade(csv);
    expect(parsed.dias[1]).toBeDefined();
    expect(parsed.dias[1]).toHaveLength(2);
    expect(parsed.dias[1][0].program.title).toBe('Telejornal Manhã');
    expect(parsed.dias[1][0].time).toBe('06:00:00');
    expect(parsed.dias[1][0].duration).toBe('00:30:00');

    expect(parsed.dias[2]).toBeDefined();
    expect(parsed.dias[2]).toHaveLength(1);
    expect(parsed.dias[2][0].program.title).toBe('Documentário Brasil');
    expect(parsed.dias[2][0].tipoExibicao).toBe('reprise');
  });

  it('normalizarDiaSemana e normalizarHorario tratam variações', () => {
    expect(GradeImportador.normalizarDiaSemana('segunda-feira')).toBe(1);
    expect(GradeImportador.normalizarDiaSemana('DOMINGO')).toBe(0);
    expect(GradeImportador.normalizarDiaSemana('sábado')).toBe(6);
    expect(GradeImportador.normalizarDiaSemana('qua')).toBe(3);
    expect(GradeImportador.normalizarDiaSemana(4)).toBe(4);

    expect(GradeImportador.normalizarHorario('6:00')).toBe('06:00:00');
    expect(GradeImportador.normalizarHorario('14:30:00')).toBe('14:30:00');
  });
});

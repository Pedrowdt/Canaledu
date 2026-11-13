import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import GradeImportador from '../../src/core/gradeImportador.js';

describe('Resumo Operacional da Prévia de Grade (Duração, Livres, Excedentes e Atrações)', () => {
  it('formatDurationHuman formata corretamente segundos em horas e minutos', () => {
    expect(GradeImportador.formatDurationHuman(86400)).toBe('24h 00m');
    expect(GradeImportador.formatDurationHuman(3600)).toBe('1h 00m');
    expect(GradeImportador.formatDurationHuman(5400)).toBe('1h 30m');
    expect(GradeImportador.formatDurationHuman(604800)).toBe('168h 00m');
    expect(GradeImportador.formatDurationHuman(915)).toBe('0h 15m 15s');
    expect(GradeImportador.formatDurationHuman(0)).toBe('0h 00m');
  });

  it('calcularMetricasDia identifica grade 24h contínua sem lacunas ou sobreposições', () => {
    const blocks = [
      { time: '06:00:00', duration: '12:00:00', durationSec: 43200, program: { title: 'Bloco Manhã' } },
      { time: '18:00:00', duration: '12:00:00', durationSec: 43200, program: { title: 'Bloco Noite' } },
    ];

    const metricas = GradeImportador.calcularMetricasDia(blocks, 1);
    expect(metricas.duracaoTotalSec).toBe(86400);
    expect(metricas.duracaoFormatada).toBe('24h 00m');
    expect(metricas.segundosLivres).toBe(0);
    expect(metricas.segundosExcedentes).toBe(0);
    expect(metricas.slotsLivres).toHaveLength(0);
    expect(metricas.lacunas).toHaveLength(0);
    expect(metricas.sobreposicoes).toHaveLength(0);
    expect(metricas.atracoesNaoDistribuidas).toHaveLength(0);
    expect(metricas.isCompleto24h).toBe(true);
  });

  it('calcularMetricasDia detecta horários livres e lacunas entre programas', () => {
    const blocks = [
      // 06:00 às 07:00 (1h)
      { time: '06:00:00', duration: '01:00:00', durationSec: 3600, program: { title: 'Jornal' } },
      // Lacuna das 07:00 às 08:00 (1h = 3600s)
      // 08:00 às 09:00 (1h = 3600s)
      { time: '08:00:00', duration: '01:00:00', durationSec: 3600, program: { title: 'Livre' } }, // Slot vago
      // 09:00 às 05:00 do dia seguinte (20h = 72000s)
      { time: '09:00:00', duration: '20:00:00', durationSec: 72000, program: { title: 'Maratona' } },
      // Fim em 05:00 -> lacuna das 05:00 às 06:00 (1h = 3600s) até o fim do dia
    ];

    const metricas = GradeImportador.calcularMetricasDia(blocks, 1);
    expect(metricas.duracaoTotalSec).toBe(79200); // 22h ocupadas
    // 3h livres: 2 lacunas de 1h + 1 slot vago de 1h = 10800s
    expect(metricas.segundosLivres).toBe(10800);
    expect(metricas.segundosLivresFormatados).toBe('3h 00m');
    expect(metricas.slotsLivres).toHaveLength(1);
    expect(metricas.slotsLivres[0].time).toBe('08:00:00');
    expect(metricas.lacunas).toHaveLength(2);
    expect(metricas.isCompleto24h).toBe(false);
  });

  it('calcularMetricasDia detecta horários excedentes e sobreposições', () => {
    const blocks = [
      { time: '06:00:00', duration: '02:00:00', durationSec: 7200, program: { title: 'Prog A' } },
      // Prog B começa às 07:30 (sobreposição de 30 min com Prog A que vai até 08:00)
      { time: '07:30:00', duration: '22:30:00', durationSec: 81000, program: { title: 'Prog B' } },
    ];

    const metricas = GradeImportador.calcularMetricasDia(blocks, 2);
    expect(metricas.sobreposicoes).toHaveLength(1);
    expect(metricas.sobreposicoes[0].inicio).toBe('07:30:00');
    expect(metricas.sobreposicoes[0].duracao).toBe('00:30:00');
    expect(metricas.segundosExcedentes).toBe(1800); // 30 min de sobreposição
    expect(metricas.isCompleto24h).toBe(false);
  });

  it('prepararPreviaImportacao lista atrações não distribuídas quando faixa é mantida composta', () => {
    const dados = {
      versao: 'Teste Semana',
      emissoraNome: 'TV Brasil',
      dias: {
        1: [
          { time: '06:00:00', duration: '01:00:00', program: { title: 'Abertura' } },
          {
            time: '07:00:00',
            duration: '05:30:00',
            title: 'TV BRASIL ANIMADA',
            isFaixa: true,
            subprogramas: GradeImportador.SUBPROGRAMAS_TV_BRASIL_ANIMADA // 23 atrações = 5h45 > 5h30
          },
          { time: '12:30:00', duration: '17:30:00', program: { title: 'Encerramento' } },
        ]
      }
    };

    // Sem alocarAteLimite, a faixa é mantida composta e as 23 atrações constam como não distribuídas
    const previa = GradeImportador.prepararPreviaImportacao(dados, [], { desmembrarFaixas: true });
    const dia1 = previa.diasResumo[1];

    expect(dia1.duracaoTotalSec).toBe(86400);
    expect(dia1.duracaoFormatada).toBe('24h 00m');
    expect(dia1.segundosLivres).toBe(0);
    expect(dia1.segundosExcedentes).toBe(0);
    expect(dia1.atracoesNaoDistribuidas).toHaveLength(23);
    expect(dia1.atracoesNaoDistribuidas[0].titulo).toBe('ESSE E O BICHO - T 01');
    expect(dia1.atracoesNaoDistribuidas[0].motivo).toContain('faixa composta');

    expect(previa.resumoOperacional.duracaoTotalSemanaSec).toBeGreaterThan(0);
    expect(previa.resumoOperacional.totalAtracoesNaoDistribuidas).toBe(23);
  });

  it('prepararPreviaImportacao com alocarAteLimite distribui até a capacidade e lista excedentes pendentes', () => {
    const dados = {
      versao: 'Teste Semana 45 Parcial',
      emissoraNome: 'TV Brasil',
      dias: {
        1: [
          { time: '06:00:00', duration: '01:00:00', program: { title: 'Abertura' } },
          {
            time: '07:00:00',
            duration: '05:30:00', // 22 slots de 15m cabem em 5h30
            title: 'TV BRASIL ANIMADA',
            isFaixa: true,
            subprogramas: GradeImportador.SUBPROGRAMAS_TV_BRASIL_ANIMADA // 23 atrações
          },
          { time: '12:30:00', duration: '17:30:00', program: { title: 'Tarde e Noite' } },
        ]
      }
    };

    const previa = GradeImportador.prepararPreviaImportacao(dados, [], { desmembrarFaixas: true, alocarAteLimite: true });
    const dia1 = previa.diasResumo[1];

    // Total de blocos no dia: 1 (abertura) + 22 (desenhos alocados) + 1 (encerramento) = 24
    expect(previa.slotsPorDia[1]).toHaveLength(24);
    expect(dia1.duracaoTotalSec).toBe(86400); // 24h
    // 1 atração excedente não coube e ficou pendente
    expect(dia1.atracoesNaoDistribuidas).toHaveLength(1);
    expect(dia1.atracoesNaoDistribuidas[0].titulo).toBe('HEROINAS NEGRAS BRASILEIRAS - T 01');
    expect(dia1.atracoesNaoDistribuidas[0].motivo).toContain('Excedente à capacidade');
  });

  it('preset da Semana 45 gera resumo operacional completo com 168h e identifica pendências', () => {
    const previa = GradeImportador.prepararPreviaImportacao(
      GradeImportador.GRADE_TV_BRASIL_SEMANA_45,
      []
    );

    const resOp = previa.resumoOperacional;
    expect(resOp).toBeDefined();
    expect(resOp.duracaoTotalSemanaSec).toBe(604800); // 168h
    expect(resOp.duracaoTotalSemanaFormatada).toBe('168h 00m');
    expect(resOp.segundosLivresTotal).toBe(0);
    expect(resOp.segundosExcedentesTotal).toBe(0);

    // Nos dias úteis e sábado (6 dias), as 23 atrações da TV Brasil Animada foram mantidas agrupadas
    expect(resOp.totalAtracoesNaoDistribuidas).toBe(6 * 23); // 138 atrações listadas com transparência
  });

  it('grade-editor.html e grade-editor.js possuem os elementos e lógica de UI do resumo operacional', () => {
    const html = readFileSync(new URL('../../grade-editor.html', import.meta.url), 'utf8');
    const js = readFileSync(new URL('../../grade-editor.js', import.meta.url), 'utf8');

    expect(html).toContain('id="previa-duracao-total-dia"');
    expect(html).toContain('id="previa-duracao-total-semana"');
    expect(html).toContain('id="previa-horarios-livres-total"');
    expect(html).toContain('id="previa-horarios-excedentes-total"');
    expect(html).toContain('id="previa-atracoes-nao-distribuidas-total"');
    expect(html).toContain('id="previa-painel-detalhes-operacionais"');

    expect(js).toContain('function atualizarResumoOperacionalUI');
    expect(js).toContain('previa-painel-detalhes-operacionais');
    expect(js).toContain('Horário Livre / Vazio');
  });
});

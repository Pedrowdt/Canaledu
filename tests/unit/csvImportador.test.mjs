import { describe, it, expect } from 'vitest';
import CsvImportador from '../../src/core/csvImportador.js';

describe('CsvImportador — Core', () => {
  describe('detectarDelimitador', () => {
    it('detecta ponto e vírgula (;) prioritariamente quando presente', () => {
      const csv = 'Code;Description;Duration;Type\n101;"Chamada A";"0000:30.00";(GCHM)\n102;"Chamada B";"0000:15.00";(GCHM)';
      const res = CsvImportador.detectarDelimitador(csv);
      expect(res.delimitador).toBe(';');
      expect(res.nome).toContain('Ponto e vírgula');
    });

    it('remove BOM UTF-8 antes de analisar delimitador', () => {
      const csvComBOM = '\uFEFFCode;Description;Duration;Type\n101;"Chamada A";"0000:30.00";(GCHM)';
      const res = CsvImportador.detectarDelimitador(csvComBOM);
      expect(res.delimitador).toBe(';');
    });

    it('detecta dois-pontos (:) em dumps de servidor de exibição quando não há ponto e vírgula', () => {
      const csv = 'Code:Description:Duration:Type\n11605:"CH MANUT CINEMA":"0000:29.00":(GCHM)\n11612:"BRASIL EM DIA":"0000:30.00":(GCHM)';
      const res = CsvImportador.detectarDelimitador(csv);
      expect(res.delimitador).toBe(':');
    });

    it('detecta vírgula (,) se o arquivo for CSV padrão com vírgula', () => {
      const csv = 'Code,Description,Duration,Type\n11605,"CH MANUT CINEMA","0000:29.00","(GCHM)"\n11612,"BRASIL EM DIA","0000:30.00","(GCHM)"';
      const res = CsvImportador.detectarDelimitador(csv);
      expect(res.delimitador).toBe(',');
    });
  });

  describe('normalizarDuracao', () => {
    it('converte formato de frames MMMM:SS.FF para HH:MM:SS', () => {
      expect(CsvImportador.normalizarDuracao('0000:29.00')).toBe('00:00:29');
      expect(CsvImportador.normalizarDuracao('0001:01.26')).toBe('00:01:01');
      expect(CsvImportador.normalizarDuracao('0075:30.00')).toBe('01:15:30');
    });

    it('converte formato com vírgula em vez de ponto nos frames', () => {
      expect(CsvImportador.normalizarDuracao('0000:29,00')).toBe('00:00:29');
      expect(CsvImportador.normalizarDuracao('0002:15,10')).toBe('00:02:15');
    });

    it('preserva HH:MM:SS já formatado', () => {
      expect(CsvImportador.normalizarDuracao('00:30:00')).toBe('00:30:00');
      expect(CsvImportador.normalizarDuracao('01:15:20')).toBe('01:15:20');
    });

    it('remove frames de HH:MM:SS.FF', () => {
      expect(CsvImportador.normalizarDuracao('01:23:45.12')).toBe('01:23:45');
      expect(CsvImportador.normalizarDuracao('00:30:10.25')).toBe('00:30:10');
    });

    it('converte MM:SS para HH:MM:SS', () => {
      expect(CsvImportador.normalizarDuracao('30:00')).toBe('00:30:00');
      expect(CsvImportador.normalizarDuracao('05:30')).toBe('00:05:30');
      expect(CsvImportador.normalizarDuracao('75:00')).toBe('01:15:00');
    });

    it('usa fallback em caso de valor nulo ou vazio', () => {
      expect(CsvImportador.normalizarDuracao('', '00:01:00')).toBe('00:01:00');
      expect(CsvImportador.normalizarDuracao(null, '00:30:00')).toBe('00:30:00');
    });
  });

  describe('analisarImportacao', () => {
    const rows = [
      ['Code', 'Description', 'Duration', 'Type'],
      ['101', 'Peça Teste 1', '0000:30.00', 'EVNH'],
      ['102', 'Peça Teste 2 (Já existe)', '0001:15.00', 'EVNH'],
      ['103', 'Peça Teste 3', '0000:45.10', 'EVNH'],
      ['', '', '', ''], // linha vazia
      ['104', 'Peça Teste 4 (Duplicada no mesmo arquivo)', '0000:20.00', 'EVNH'],
      ['104', 'Peça Teste 4 repetida', '0000:20.00', 'EVNH'],
    ];

    it('identifica corretamente novos registros e duplicados existentes', () => {
      const itensExistentes = [{ code: '102', descricao: 'Peça Teste 2 (Já existe)' }];
      const res = CsvImportador.analisarImportacao({
        rows,
        itensExistentes,
        isPecas: true,
      });

      expect(res.valido).toBe(true);
      expect(res.totalNovos).toBe(3); // 101, 103, 104
      expect(res.totalDuplicados).toBe(2); // 102 (existia no banco) + segundo 104 (repetido na planilha)
      expect(res.novosItens.length).toBe(3);
      expect(res.novosItens[0].code).toBe('101');
      expect(res.novosItens[0].tempo).toBe('00:00:30');
      expect(res.amostra.length).toBeGreaterThan(0);
    });

    it('retorna erro se colunas obrigatórias não existirem', () => {
      const rowsSemCode = [
        ['Nome', 'Tempo'],
        ['Item 1', '00:30:00'],
      ];
      const res = CsvImportador.analisarImportacao({ rows: rowsSemCode });
      expect(res.valido).toBe(false);
      expect(res.erro).toContain('CODE e DESCRIÇÃO');
    });
  });
});

  describe('mapearTipo', () => {
    it('mapeia descrições e tipos brutos do servidor para tipos padrão do sistema', () => {
      expect(CsvImportador.mapearTipo('CANAL EDUCACAO - VINHETA', 'VH CANAL EDUCAÇÃO', true)).toBe('EVNH');
      expect(CsvImportador.mapearTipo('CANAL LIBRAS - VINHETA', 'VH CLASSIFICACAO', true)).toBe('EVNH');
      expect(CsvImportador.mapearTipo('CANAL EDUCACAO - INTERPROGRAMA', 'INTPGM TODA MATEMATICA', true)).toBe('EINT');
      expect(CsvImportador.mapearTipo('CANAL EDUCACAO - CHAMADA MANUTECAO', 'CH MANUT BRASIL EM DIA', true)).toBe('ECHM');
      expect(CsvImportador.mapearTipo('(GCHM)', 'CH MANUT CINEMA', true)).toBe('ECHM');
      expect(CsvImportador.mapearTipo('(#N/D)', 'VH ASSISTA AGORA CAFE COM PIMENTA', true)).toBe('EVNH');
      expect(CsvImportador.mapearTipo('', 'CH MANUT PREVEST', true)).toBe('ECHM');
      expect(CsvImportador.mapearTipo('', 'INTPGM TRILHINHA', true)).toBe('EINT');
      expect(CsvImportador.mapearTipo('ECHE', 'Estreia', true)).toBe('ECHE');
    });
  });

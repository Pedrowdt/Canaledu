import { describe, it, expect } from 'vitest';
import fs from 'fs';
import CsvImportador from '../../src/core/csvImportador.js';

describe('CsvImportador — Multiemissora e TV Brasil Internacional (TVBI)', () => {
  describe('Mapeamento de tipos contextuais por emissora', () => {
    it('mapeia tipos para TV Brasil Internacional (tv-brasil-int)', () => {
      // Chamadas
      expect(CsvImportador.mapearTipo('INTERNACIONAL - CHAMADA MANUTENÇÃO', 'CH SEM CENSURA', true, 'tv-brasil-int')).toBe('CH');
      expect(CsvImportador.mapearTipo('INTERNACIONAL - CHAMADA ESPECIFICA', 'CH DOC', true, 'tv-brasil-int')).toBe('CH');
      expect(CsvImportador.mapearTipo('CH', 'Chamada genérica', true, 'tv-brasil-int')).toBe('CH');
      expect(CsvImportador.mapearTipo('', 'CH MANUTENCAO', true, 'tv-brasil-int')).toBe('CH');

      // Vinhetas
      expect(CsvImportador.mapearTipo('INTERNACIONAL - VINHETA DA CASA', 'VH BEM BAHIA', true, 'tv-brasil-int')).toBe('VH');
      expect(CsvImportador.mapearTipo('VH', 'Vinheta genérica', true, 'tv-brasil-int')).toBe('VH');
      expect(CsvImportador.mapearTipo('', 'VH A SEGUIR', true, 'tv-brasil-int')).toBe('VH');

      // Promos
      expect(CsvImportador.mapearTipo('INTERNACIONAL - PROMO', 'PROMO FESTIVAL', true, 'tv-brasil-int')).toBe('PROMO');
      expect(CsvImportador.mapearTipo('PROMO', 'Promo genérica', true, 'tv-brasil-int')).toBe('PROMO');
      expect(CsvImportador.mapearTipo('', 'PROMO BRASIL', true, 'tv-brasil-int')).toBe('PROMO');

      // Pílulas e Interprogramas
      expect(CsvImportador.mapearTipo('INTERNACIONAL - PILULA', 'PILULA AGENCIA BRASIL', true, 'tv-brasil-int')).toBe('INTERPRO');
      expect(CsvImportador.mapearTipo('INTERPRO', 'Interprograma genérico', true, 'tv-brasil-int')).toBe('INTERPRO');
      expect(CsvImportador.mapearTipo('', 'PILULA SAUDE', true, 'tv-brasil-int')).toBe('INTERPRO');
      expect(CsvImportador.mapearTipo('', 'PIRILA NOTICIA', true, 'tv-brasil-int')).toBe('INTERPRO');

      // Programas
      expect(CsvImportador.mapearTipo('PROGRAMA', 'BEM BAHIA', false, 'tv-brasil-int')).toBe('IPRO');
      expect(CsvImportador.mapearTipo('IPRO', 'BRASIL VISUAL', false, 'tv-brasil-int')).toBe('IPRO');
      expect(CsvImportador.mapearTipo('', 'PROGRAMA ESPECIAL', false, 'tv-brasil-int')).toBe('IPRO');

      // Classificação Indicativa
      expect(CsvImportador.mapearTipo('CI', 'CLASSIFICACAO LIVRE', true, 'tv-brasil-int')).toBe('CI');
      expect(CsvImportador.mapearTipo('CLASSIFICACAO INDICATIVA', 'CI 12 ANOS', true, 'tv-brasil-int')).toBe('CI');
    });

    it('mapeia tipos para TV Brasil (Rede)', () => {
      expect(CsvImportador.mapearTipo('CHAMADA', 'CH JORNAL', true, 'tv-brasil')).toBe('CH');
      expect(CsvImportador.mapearTipo('VINHETA', 'VH IDENTIDADE', true, 'tv-brasil')).toBe('VH');
      expect(CsvImportador.mapearTipo('PROMO', 'PROMO NOVELA', true, 'tv-brasil')).toBe('PROMO');
      expect(CsvImportador.mapearTipo('PILULA', 'PILULA HISTORIA', true, 'tv-brasil')).toBe('INTERPRO');
      expect(CsvImportador.mapearTipo('PROGRAMETE', 'PGT MINUTO', true, 'tv-brasil')).toBe('PROGRAMETE');
      expect(CsvImportador.mapearTipo('PROGRAMA', 'REPORTER BRASIL', false, 'tv-brasil')).toBe('RPRO');
    });

    it('mapeia tipos para Canal Gov (canal-gov)', () => {
      expect(CsvImportador.mapearTipo('CHAMADA', 'CH BRASIL EM DIA', true, 'canal-gov')).toBe('GCHM');
      expect(CsvImportador.mapearTipo('VINHETA', 'VH CANAL GOV', true, 'canal-gov')).toBe('GVNH');
      expect(CsvImportador.mapearTipo('CAMPANHA', 'VACINACAO', true, 'canal-gov')).toBe('GGV');
      expect(CsvImportador.mapearTipo('INSTITUCIONAL', 'MINISTERIO', true, 'canal-gov')).toBe('GINS');
      expect(CsvImportador.mapearTipo('AO VIVO', 'PRONUNCIAMENTO', false, 'canal-gov')).toBe('LIVE');
      expect(CsvImportador.mapearTipo('PROGRAMA', 'A VOZ DO BRASIL', false, 'canal-gov')).toBe('GPRO');
    });

    it('mantém retrocompatibilidade para Canal Educação (canal-educacao)', () => {
      expect(CsvImportador.mapearTipo('CHAMADA', 'CH MANUT', true, 'canal-educacao')).toBe('ECHM');
      expect(CsvImportador.mapearTipo('VINHETA', 'VH CANAL', true, 'canal-educacao')).toBe('EVNH');
      expect(CsvImportador.mapearTipo('INTERPROGRAMA', 'INTPGM', true, 'canal-educacao')).toBe('EINT');
      expect(CsvImportador.mapearTipo('ESTREIA', 'ESTREIA SERIE', true, 'canal-educacao')).toBe('ECHE');
      expect(CsvImportador.mapearTipo('COMERCIAL', 'APOIO', true, 'canal-educacao')).toBe('RCOM');
      expect(CsvImportador.mapearTipo('POLITICO', 'PARTIDARIO', true, 'canal-educacao')).toBe('RPOL');
      expect(CsvImportador.mapearTipo('PROGRAMA', 'AULA', false, 'canal-educacao')).toBe('RPRO');
    });
  });

  describe('Importação com preservação de acervo e detecção de duplicados', () => {
    const fixtureTVBI = [
      ['CODE', 'DESCRICAO', 'TEMPO', 'TYPE'],
      ['AGBR_1', 'PILULA AGENCIA BRASIL - NOVO PISO MAGISTERIO', '00:00:30', 'INTERNACIONAL - PILULA'],
      ['I3010', 'VH BEM BAHIA AINDA HOJE', '00:00:10', 'INTERNACIONAL - VINHETA DA CASA'],
      ['I4001', 'PROMO FESTIVAL LATINO', '00:00:45', 'INTERNACIONAL - PROMO'],
      ['i4511', 'CH PILULA MULHERES 1 - LUTA PELA VIDA', '00:00:55', 'INTERNACIONAL - PILULA'],
      ['i4674', 'CH SEM CENSURA MANUT', '00:00:45', 'INTERNACIONAL - CHAMADA MANUTENÇÃO'],
      ['I3010', 'VH BEM BAHIA repetida no mesmo arquivo', '00:00:10', 'INTERNACIONAL - VINHETA DA CASA'],
    ];

    it('analisa planilha TVBI corretamente e ignora itens já existentes sem sobrescrever', () => {
      const existentes = [{ code: 'AGBR_1', descricao: 'Pílula antiga gravada' }];

      const res = CsvImportador.analisarImportacao({
        rows: fixtureTVBI,
        itensExistentes: existentes,
        isPecas: true,
        emissora: 'tv-brasil-int',
        uidGenerator: () => 'id-mock',
      });

      expect(res.valido).toBe(true);
      expect(res.totalLinhas).toBe(6);
      expect(res.totalNovos).toBe(4); // I3010, I4001, i4511, i4674
      expect(res.totalDuplicados).toBe(2); // AGBR_1 (existente no banco) + segundo I3010 (duplicado no arquivo)

      const tipos = res.novosItens.map(it => it.type);
      expect(tipos).toContain('VH');
      expect(tipos).toContain('PROMO');
      expect(tipos).toContain('INTERPRO');
      expect(tipos).toContain('CH');

      // Garante que o item existente não foi colocado para inserção (não sobrescreve)
      expect(res.novosItens.find(it => it.code === 'AGBR_1')).toBeUndefined();
    });
  });

  describe('Validação contra arquivo real TVBI_pecas_consolidadas.csv quando presente', () => {
    it('processa perfeitamente todas as 576 peças do arquivo real', () => {
      const csvPath = '/mnt/user-uploads/TVBI_pecas_consolidadas.csv';
      if (!fs.existsSync(csvPath)) {
        return; // Pula em ambientes sem o upload anexado
      }

      const content = fs.readFileSync(csvPath, 'utf8');
      const delim = CsvImportador.detectarDelimitador(content);
      expect(delim.delimitador).toBe(';');

      // Parse simples respeitando aspas
      const linhas = [];
      let linhaAtual = [];
      let dentroAspas = false;
      let campoAtual = '';

      const limpo = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;

      for (let i = 0; i < limpo.length; i++) {
        const c = limpo[i];
        if (c === '"') {
          dentroAspas = !dentroAspas;
        } else if (c === ';' && !dentroAspas) {
          linhaAtual.push(campoAtual);
          campoAtual = '';
        } else if ((c === '\r' || c === '\n') && !dentroAspas) {
          if (c === '\r' && limpo[i + 1] === '\n') i++;
          linhaAtual.push(campoAtual);
          campoAtual = '';
          if (linhaAtual.length > 1 || (linhaAtual[0] && linhaAtual[0].trim())) {
            linhas.push(linhaAtual);
          }
          linhaAtual = [];
        } else {
          campoAtual += c;
        }
      }
      if (campoAtual.length > 0 || linhaAtual.length > 0) {
        linhaAtual.push(campoAtual);
        linhas.push(linhaAtual);
      }

      const res = CsvImportador.analisarImportacao({
        rows: linhas,
        itensExistentes: [],
        isPecas: true,
        emissora: 'tv-brasil-int',
      });

      expect(res.valido).toBe(true);
      expect(res.totalLinhas).toBe(576);
      expect(res.totalNovos).toBe(576);
      expect(res.totalInvalidos).toBe(0);

      const contagem = {};
      res.novosItens.forEach(it => {
        contagem[it.type] = (contagem[it.type] || 0) + 1;
        // Valida que todos os tempos estão em HH:MM:SS
        expect(it.tempo).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      });

      expect(contagem['CH']).toBe(294);
      expect(contagem['VH']).toBe(217);
      expect(contagem['PROMO']).toBe(42);
      expect(contagem['INTERPRO']).toBe(23);
    });
  });
});

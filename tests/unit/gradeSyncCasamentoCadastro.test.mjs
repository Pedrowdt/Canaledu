import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const syncSrc = readFileSync(new URL('../../src/core/gradeRoteiroSyncCore.js', import.meta.url), 'utf8');
const editorSrc = readFileSync(new URL('../../src/core/gradeEditorCore.js', import.meta.url), 'utf8');

function loadCores() {
  const g = {};
  new Function('window', 'globalThis', editorSrc).call(g, g, g);
  new Function('window', 'globalThis', syncSrc).call(g, g, g);
  return {
    GradeEditorCore: g.GradeEditorCore,
    GradeRoteiroSyncCore: g.GradeRoteiroSyncCore
  };
}

describe('Casamento do GradeRoteiroSyncCore com o Cadastro (Peças e Programas)', () => {
  const { GradeRoteiroSyncCore: SyncCore, GradeEditorCore: EditorCore } = loadCores();

  describe('1. Normalizador único de títulos', () => {
    it('normaliza variações reais de títulos para a mesma chave canônica', () => {
      const normalizar = SyncCore.normalizarTituloCatalogo;

      expect(normalizar('BAR [2ª]')).toBe('BAR');
      expect(normalizar("BAR 26'")).toBe('BAR');
      expect(normalizar("BAR 13'")).toBe('BAR');
      expect(normalizar('BAR_2')).toBe('BAR');
      expect(normalizar('BAR_1')).toBe('BAR');
      expect(normalizar('BAR - CANAL EDUCAÇÃO')).toBe('BAR');
      expect(normalizar('BAR - TV BRASIL')).toBe('BAR');
      expect(normalizar('BAR - CANAL GOV')).toBe('BAR');
      expect(normalizar('BAR [2ª] - CANAL GOV')).toBe('BAR');
      expect(normalizar('BAR (REPRISE)')).toBe('BAR');
      expect(normalizar('BAR (AO VIVO)')).toBe('BAR');

      // Prefixos de emissora e tipo
      expect(normalizar('RPRO BAR')).toBe('BAR');
      expect(normalizar('GPRO BAR')).toBe('BAR');
      expect(normalizar('IPRO BAR')).toBe('BAR');
      expect(normalizar('PGM BAR')).toBe('BAR');
      expect(normalizar('PROGRAMA BAR')).toBe('BAR');
      expect(normalizar('INTPGM BAR')).toBe('BAR');
      expect(normalizar('INTERPROGRAMA BAR')).toBe('BAR');

      // Tratamento de & e conectivos
      expect(normalizar('ACAO E CIA')).toBe('ACAO CIA');
      expect(normalizar('AÇÃO & CIA')).toBe('ACAO CIA');
      expect(normalizar('MUNDO DA BOLA')).toBe('MUNDO BOLA');
      expect(normalizar('VIDA DE MERENDEIRA')).toBe('VIDA MERENDEIRA');
    });

    it('GradeEditorCore compartilha a mesma regra de normalização', () => {
      expect(typeof EditorCore.normalizarTituloGrade).toBe('function');
      expect(EditorCore.normalizarTituloGrade('BAR [2ª]')).toBe('BAR');
      expect(EditorCore.normalizarTituloGrade('ACAO E CIA')).toBe(EditorCore.normalizarTituloGrade('AÇÃO & CIA'));
    });
  });

  describe('2. Casamento por id/code antes do texto', () => {
    it('casa por programaId quando o título do slot foi editado ou difere do cadastro', () => {
      const acervo = [
        {
          id: 'prog-uuid-999',
          code: 'OFICIAL_01',
          descricao: 'NOME ORIGINAL NO BANCO',
          tempo: '00:26:00',
          midia: '0OMN'
        }
      ];

      const slots = [
        {
          id: 'slot-1',
          time: '09:00:00',
          duration: '00:30:00',
          program: {
            id: 'prog-uuid-999',
            title: 'NOME TOTALMENTE MODIFICADO NA GRADE'
          }
        }
      ];

      const res = SyncCore.mesclarGradeComRoteiroPreservandoEdicoes([], slots, {
        modo: 'substituir',
        acervo
      });

      const prog = res.roteiroAtualizado.find(SyncCore.isProgramaItem);
      expect(prog).toBeDefined();
      expect(prog.code).toBe('OFICIAL_01');
      expect(prog.tempo).toBe('00:26:00');
      expect(prog.descricao).toBe('NOME ORIGINAL NO BANCO');
    });

    it('casa por code oficial existente no cadastro antes de recorrer ao título', () => {
      const acervo = [
        {
          id: 'p1',
          code: 'COD_DIRETO',
          descricao: 'ATRAÇÃO PRINCIPAL',
          tempo: '00:13:30',
          midia: '0OMN'
        }
      ];

      const slots = [
        {
          id: 'slot-1',
          time: '10:00:00',
          duration: '00:15:00',
          program: {
            code: 'COD_DIRETO',
            title: 'TÍTULO QUALQUER'
          }
        }
      ];

      const res = SyncCore.mesclarGradeComRoteiroPreservandoEdicoes([], slots, {
        modo: 'substituir',
        acervo
      });

      const prog = res.roteiroAtualizado.find(SyncCore.isProgramaItem);
      expect(prog).toBeDefined();
      expect(prog.code).toBe('COD_DIRETO');
      expect(prog.tempo).toBe('00:13:30');
    });
  });

  describe('3. Casamento de variações de títulos (BAR, AÇÃO & CIA, etc.)', () => {
    const acervo = [
      { code: 'BAR_CAD', descricao: 'BAR', tempo: '00:26:00', midia: '0OMN' },
      { code: 'ACAO_CAD', descricao: 'AÇÃO & CIA', tempo: '00:26:00', midia: '0OMN' }
    ];

    it('casa BAR [2ª], BAR 26\', BAR_2 e sufixos de emissora com BAR do cadastro', () => {
      const slots = [
        { id: 's1', time: '08:00:00', duration: '00:30:00', program: { title: 'BAR [2ª]' } },
        { id: 's2', time: '09:00:00', duration: '00:30:00', program: { title: "BAR 26'" } },
        { id: 's3', time: '10:00:00', duration: '00:30:00', program: { title: 'BAR_2' } },
        { id: 's4', time: '11:00:00', duration: '00:30:00', program: { title: 'BAR - CANAL EDUCAÇÃO' } },
        { id: 's5', time: '12:00:00', duration: '00:30:00', program: { title: 'BAR - TV BRASIL' } },
        { id: 's6', time: '13:00:00', duration: '00:30:00', program: { title: 'BAR - CANAL GOV' } },
        { id: 's7', time: '14:00:00', duration: '00:30:00', program: { title: 'RPRO BAR' } }
      ];

      const res = SyncCore.mesclarGradeComRoteiroPreservandoEdicoes([], slots, {
        modo: 'substituir',
        acervo
      });

      const progs = res.roteiroAtualizado.filter(SyncCore.isProgramaItem);
      expect(progs.length).toBe(7);
      progs.forEach(p => {
        expect(p.code).toBe('BAR_CAD');
        expect(p.tempo).toBe('00:26:00');
        expect(p.code.startsWith('GRD_')).toBe(false);
      });
      expect(res.resumo.totalSemCadastro).toBe(0);
    });

    it('casa ACAO E CIA na grade com AÇÃO & CIA no cadastro', () => {
      const slots = [
        { id: 's1', time: '15:00:00', duration: '00:30:00', program: { title: 'ACAO E CIA' } }
      ];

      const res = SyncCore.mesclarGradeComRoteiroPreservandoEdicoes([], slots, {
        modo: 'substituir',
        acervo
      });

      const prog = res.roteiroAtualizado.find(SyncCore.isProgramaItem);
      expect(prog.code).toBe('ACAO_CAD');
      expect(prog.tempo).toBe('00:26:00');
      expect(res.resumo.totalSemCadastro).toBe(0);
    });
  });

  describe('4. Mesmo programa duas vezes no mesmo dia (X e X [2ª])', () => {
    it('preenche ambas as ocorrências com o code e o tempo oficiais do cadastro', () => {
      const acervo = [
        { code: 'COD_X', descricao: 'PROGRAMA X', tempo: '00:25:30', midia: '0OMN' }
      ];

      const slots = [
        { id: 'slot-manha', time: '08:00:00', duration: '00:30:00', program: { title: 'PROGRAMA X' } },
        { id: 'slot-tarde', time: '14:00:00', duration: '00:30:00', program: { title: 'PROGRAMA X [2ª]' } }
      ];

      const res = SyncCore.mesclarGradeComRoteiroPreservandoEdicoes([], slots, {
        modo: 'substituir',
        acervo
      });

      const progs = res.roteiroAtualizado.filter(SyncCore.isProgramaItem);
      expect(progs.length).toBe(2);

      expect(progs[0].code).toBe('COD_X');
      expect(progs[0].tempo).toBe('00:25:30');
      expect(progs[0].code.startsWith('GRD_')).toBe(false);

      expect(progs[1].code).toBe('COD_X');
      expect(progs[1].tempo).toBe('00:25:30');
      expect(progs[1].code.startsWith('GRD_')).toBe(false);

      expect(res.resumo.totalSemCadastro).toBe(0);
    });
  });

  describe('5. Casos que NÃO devem casar (regras propositais)', () => {
    it('episódio explícito inexistente no cadastro gera code GRD_ e tempo da duração do slot na grade', () => {
      const acervo = [
        { code: 'EP01', descricao: 'BAR - T 01 EP 01', tempo: '00:26:00', midia: '0OMN' },
        { code: 'EP02', descricao: 'BAR - T 01 EP 02', tempo: '00:26:00', midia: '0OMN' }
      ];

      const slots = [
        {
          id: 'slot-1',
          time: '08:00:00',
          duration: '00:30:00',
          program: { title: 'BAR - T 01 EP 07' }
        }
      ];

      const res = SyncCore.mesclarGradeComRoteiroPreservandoEdicoes([], slots, {
        modo: 'substituir',
        acervo
      });

      const progs = res.roteiroAtualizado.filter(SyncCore.isProgramaItem);
      expect(progs.length).toBeGreaterThan(0);
      progs.forEach(p => {
        expect(p.code.startsWith('GRD_080000')).toBe(true);
      });

      expect(res.resumo.totalSemCadastro).toBe(1);
      expect(res.resumo.programasSemCadastro).toContain('BAR - T 01 EP 07');
    });

    it('item do cadastro sem code é ignorado no casamento e registrado nos avisos de inválidos', () => {
      const acervo = [
        { descricao: 'PROGRAMA SEM CODE', tempo: '00:20:00', midia: '0OMN' } // sem code
      ];

      const slots = [
        { id: 's1', time: '09:00:00', duration: '00:30:00', program: { title: 'PROGRAMA SEM CODE' } }
      ];

      const res = SyncCore.mesclarGradeComRoteiroPreservandoEdicoes([], slots, {
        modo: 'substituir',
        acervo
      });

      const prog = res.roteiroAtualizado.find(SyncCore.isProgramaItem);
      expect(prog.code.startsWith('GRD_090000')).toBe(true);
      expect(res.resumo.totalSemCadastro).toBe(1);
      expect(res.resumo.totalInvalidosCadastro).toBe(1);
      expect(res.resumo.itensInvalidosCadastro[0].nome).toBe('PROGRAMA SEM CODE');
      expect(res.resumo.itensInvalidosCadastro[0].semCode).toBe(true);
    });

    it('item do cadastro sem tempo é ignorado no casamento e registrado nos avisos de inválidos', () => {
      const acervo = [
        { code: 'COD_123', descricao: 'PROGRAMA SEM TEMPO', midia: '0OMN' } // sem tempo
      ];

      const slots = [
        { id: 's1', time: '10:00:00', duration: '00:30:00', program: { title: 'PROGRAMA SEM TEMPO' } }
      ];

      const res = SyncCore.mesclarGradeComRoteiroPreservandoEdicoes([], slots, {
        modo: 'substituir',
        acervo
      });

      const prog = res.roteiroAtualizado.find(SyncCore.isProgramaItem);
      expect(prog.code.startsWith('GRD_100000')).toBe(true);
      expect(res.resumo.totalSemCadastro).toBe(1);
      expect(res.resumo.totalInvalidosCadastro).toBe(1);
      expect(res.resumo.itensInvalidosCadastro[0].semTempo).toBe(true);
    });
  });

  describe('6. Visibilidade e resumo de sincronização', () => {
    it('informa no resumo os programas que ficaram com GRD_ e formata a mensagem adequadamente', () => {
      const acervo = [
        { code: 'OK_01', descricao: 'PROGRAMA CONHECIDO', tempo: '00:26:00', midia: '0OMN' }
      ];

      const slots = [
        { id: 's1', time: '08:00:00', duration: '00:30:00', program: { title: 'PROGRAMA CONHECIDO' } },
        { id: 's2', time: '09:00:00', duration: '00:30:00', program: { title: 'NOVO FANTASMA 1' } },
        { id: 's3', time: '10:00:00', duration: '00:30:00', program: { title: 'NOVO FANTASMA 2' } }
      ];

      const res = SyncCore.mesclarGradeComRoteiroPreservandoEdicoes([], slots, {
        modo: 'substituir',
        acervo
      });

      expect(res.resumo.totalSemCadastro).toBe(2);
      expect(res.resumo.programasSemCadastro).toEqual(['NOVO FANTASMA 1', 'NOVO FANTASMA 2']);
      expect(res.resumo.mensagem).toContain('2 programas sem correspondência no cadastro: NOVO FANTASMA 1, NOVO FANTASMA 2');
    });
  });

  describe('7. Preservação de edições manuais no modo inteligente', () => {
    it('preserva tempo editado manualmente pelo operador e chamadas inseridas no roteiro', () => {
      const acervo = [
        { code: 'BAR_CAD', descricao: 'BAR', tempo: '00:26:00', midia: '0OMN' }
      ];

      const roteiroExistente = [
        {
          type: 'RPRO',
          code: 'BAR_CAD',
          descricao: 'BAR',
          tempo: '00:20:00', // operador alterou para 20min
          _tempoEditadoManualmente: true,
          bloco: 1
        },
        {
          type: 'CHAM',
          code: 'CHAM_01',
          descricao: 'CHAMADA ESPECIAL INSERIDA PELO OPERADOR',
          tempo: '00:00:30',
          _isPecaManual: true
        }
      ];

      const slots = [
        { id: 's1', time: '08:00:00', duration: '00:30:00', program: { title: 'BAR' } }
      ];

      const res = SyncCore.mesclarGradeComRoteiroPreservandoEdicoes(roteiroExistente, slots, {
        modo: 'inteligente',
        acervo
      });

      const prog = res.roteiroAtualizado.find(SyncCore.isProgramaItem);
      expect(prog.tempo).toBe('00:20:00'); // manteve a edição manual!

      const chamada = res.roteiroAtualizado.find(i => i.code === 'CHAM_01');
      expect(chamada).toBeDefined(); // preservou a chamada do operador!
      expect(res.resumo.pecasManuaisPreservadas).toBeGreaterThan(0);
    });
  });
});

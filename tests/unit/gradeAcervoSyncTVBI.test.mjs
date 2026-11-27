import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const syncSrc = readFileSync(new URL('../../src/core/gradeRoteiroSyncCore.js', import.meta.url), 'utf8');
const editorSrc = readFileSync(new URL('../../src/core/gradeEditorCore.js', import.meta.url), 'utf8');
const importadorSrc = readFileSync(new URL('../../src/core/gradeImportador.js', import.meta.url), 'utf8');

function loadModules() {
  const g = {};
  new Function('window', 'globalThis', editorSrc).call(g, g, g);
  new Function('window', 'globalThis', syncSrc).call(g, g, g);
  new Function('window', 'globalThis', importadorSrc).call(g, g, g);
  return {
    GradeEditorCore: g.GradeEditorCore,
    GradeRoteiroSyncCore: g.GradeRoteiroSyncCore,
    GradeImportador: g.GradeImportador
  };
}

describe('TVBI — Etapas 3 e 4: Vínculo Acervo <-> Grade e Sincronização com Roteiro', () => {
  const { GradeEditorCore, GradeRoteiroSyncCore, GradeImportador } = loadModules();

  describe('Etapa 3: Acervo TVBI <-> Grade', () => {
    it('normaliza títulos da TVBI removendo sufixos de canal', () => {
      const normalizar = GradeEditorCore.normalizarTituloGrade;
      expect(normalizar('NOTICIAS DO BRASIL - TV BRASIL INTERNACIONAL')).toBe('NOTICIAS BRASIL');
      expect(normalizar('NOTICIAS DO BRASIL - TVBI')).toBe('NOTICIAS BRASIL');
      expect(normalizar('IPRO NOTICIAS DO BRASIL')).toBe('NOTICIAS BRASIL');
    });

    it('assignProgramToSlot preserva programaId, code, tempo e flag Ao Vivo', () => {
      const blocks = [
        { id: 's0', time: '08:00:00', duration: '00:30:00', durationSec: 1800, endTime: '08:30:00', program: null }
      ];
      const progTVBI = {
        id: 'tvbi-prog-001',
        title: 'JORNAL INTERNACIONAL',
        code: 'IPRO_JORNAL_INT',
        tempo: '00:26:00',
        type: 'IPRO',
        isAoVivo: true
      };

      const resultado = GradeEditorCore.assignProgramToSlot(blocks, 0, progTVBI);
      expect(resultado[0].programaId).toBe('tvbi-prog-001');
      expect(resultado[0].code).toBe('IPRO_JORNAL_INT');
      expect(resultado[0].tempo).toBe('00:26:00');
      expect(resultado[0].isAoVivo).toBe(true);
      expect(resultado[0].horarioFixo).toBe('08:00:00');
      expect(resultado[0].program.id).toBe('tvbi-prog-001');
      expect(resultado[0].program.code).toBe('IPRO_JORNAL_INT');
    });

    it('gradeToBlocks casa por code oficial do acervo TVBI mesmo se o título divergir', () => {
      const catalogoTVBI = [
        {
          id: 'tvbi-123',
          code: 'IPRO_0042',
          title: 'DOCUMENTARIOS DO BRASIL',
          tempo: '00:52:00',
          type: 'IPRO'
        }
      ];

      const gradeSalva = {
        'IPRO_0042': '14:00:00'
      };
      const orderList = ['IPRO_0042'];

      const blocos = GradeEditorCore.gradeToBlocks(gradeSalva, orderList, catalogoTVBI);
      expect(blocos).toHaveLength(1);
      expect(blocos[0].programaId).toBe('tvbi-123');
      expect(blocos[0].code).toBe('IPRO_0042');
      expect(blocos[0].tempo).toBe('00:52:00');
    });

    it('GradeImportador.prepararPreviaImportacao indexa e vincula programas TVBI por code oficial', () => {
      const acervoTVBI = [
        {
          id: 'p-tvbi-99',
          code: 'IPRO_MUSICA_BR',
          title: 'MUSICA BRASIL',
          tempo: '00:26:30',
          type: 'IPRO'
        }
      ];

      const dadosGrade = {
        dias: {
          1: [
            {
              time: '19:00:00',
              duration: '00:30:00',
              title: 'MUSICA BRASIL',
              code: 'IPRO_MUSICA_BR'
            }
          ]
        }
      };

      const previa = GradeImportador.prepararPreviaImportacao(dadosGrade, acervoTVBI);
      const slot = previa.slotsPorDia[1][0];
      expect(slot).toBeDefined();
      expect(slot.code).toBe('IPRO_MUSICA_BR');
      expect(slot.programaId).toBe('p-tvbi-99');
      expect(slot.program.tempo).toBe('00:26:30');
      expect(slot.program.duracaoFonte).toBe('acervo');
      expect(slot.program.catalogoEncontrado).toBe(true);
    });
  });

  describe('Etapa 4: Sincronização Grade -> Roteiro TVBI', () => {
    it('sincroniza slot da TVBI gerando itens com type IPRO e metadados oficiais', () => {
      const acervoTVBI = [
        {
          id: 'tvbi-ep-1',
          code: 'IPRO_SAMBA_01',
          descricao: 'RODA DE SAMBA - EP 01',
          tempo: '00:26:00',
          type: 'IPRO',
          midia: '0OMN'
        }
      ];

      const slotsGrade = [
        {
          time: '21:00:00',
          duration: '00:30:00',
          program: {
            title: 'RODA DE SAMBA',
            code: 'IPRO_SAMBA_01',
            tempo: '00:26:00',
            type: 'IPRO'
          }
        }
      ];

      const res = GradeRoteiroSyncCore.mesclarGradeComRoteiroPreservandoEdicoes([], slotsGrade, {
        modo: 'substituir',
        emissora: 'tv-brasil-int',
        acervo: acervoTVBI
      });

      const programas = res.roteiroAtualizado.filter(GradeRoteiroSyncCore.isProgramaItem);
      expect(programas.length).toBeGreaterThan(0);
      expect(programas[0].type).toBe('IPRO');
      expect(programas[0].code).toBe('IPRO_SAMBA_01');
      expect(programas[0].tempo).toBe('00:26:00');
      expect(programas[0]._catalogoOficial).toBe(true);
    });

    it('mantém programa Ao Vivo da TVBI com horarioFixo e isAoVivo: true', () => {
      const acervoTVBI = [
        {
          id: 'tvbi-live-1',
          code: 'IPRO_REP_LIVE',
          descricao: 'REPÓRTER BRASIL AO VIVO',
          tempo: '00:45:00',
          type: 'IPRO',
          isAoVivo: true
        }
      ];

      const slotsGrade = [
        {
          time: '19:00:00',
          duration: '00:45:00',
          isAoVivo: true,
          program: {
            title: 'REPÓRTER BRASIL AO VIVO',
            code: 'IPRO_REP_LIVE',
            tempo: '00:45:00',
            isAoVivo: true
          }
        }
      ];

      const res = GradeRoteiroSyncCore.mesclarGradeComRoteiroPreservandoEdicoes([], slotsGrade, {
        modo: 'substituir',
        emissora: 'tv-brasil-int',
        acervo: acervoTVBI
      });

      const progAoVivo = res.roteiroAtualizado.find(it => it.code === 'IPRO_REP_LIVE');
      expect(progAoVivo).toBeDefined();
      expect(progAoVivo.isAoVivo).toBe(true);
      expect(progAoVivo.horarioFixo).toBe('19:00:00');
    });
  });
});

import { describe, it, expect } from 'vitest';
import GradeRecorrenciaCore from '../../src/core/gradeRecorrenciaCore.js';

describe('GradeRecorrenciaCore — Classificações Oficiais TV Brasil e Faixas Compostas', () => {
  const {
    CLASSIFICACOES,
    detectarClassificacao,
    criarFaixaComposta,
    adicionarSubprograma,
    substituirSubprograma,
    removerSubprograma,
    reordenarSubprogramas,
    parseSubprogramasTexto
  } = GradeRecorrenciaCore;

  describe('5 Cores e Classificações Oficiais TV Brasil', () => {
    it('expõe as cinco classificações oficiais com cores exatas da legenda', () => {
      expect(CLASSIFICACOES.TV_BRASIL).toBeDefined();
      expect(CLASSIFICACOES.TV_BRASIL.cor).toBe('#92D050'); // Verde TV Brasil

      expect(CLASSIFICACOES.TV_BRASIL_AOVIVO).toBeDefined();
      expect(CLASSIFICACOES.TV_BRASIL_AOVIVO.cor).toBe('#FFFF00'); // Amarelo Ao Vivo

      expect(CLASSIFICACOES.LICENCIADO).toBeDefined();
      expect(CLASSIFICACOES.LICENCIADO.cor).toBe('#FFFFFF'); // Branco Licenciado

      expect(CLASSIFICACOES.RNCP).toBeDefined();
      expect(CLASSIFICACOES.RNCP.cor).toBe('#B8CCE4'); // Azul Claro RNCP

      expect(CLASSIFICACOES.REPRISE_MADRUGADA).toBeDefined();
      expect(CLASSIFICACOES.REPRISE_MADRUGADA.cor).toBe('#D9D9D9'); // Cinza Reprise
    });

    it('detecta classificação explícita informada no slot ou regra', () => {
      const classif = detectarClassificacao({ classificacao: 'rnpc', time: '10:00:00' });
      expect(classif.id).toBe('rnpc');
      expect(classif.cor).toBe('#B8CCE4');
    });

    it('detecta programa AO VIVO automaticamente pelo título', () => {
      const classif = detectarClassificacao({
        time: '16:00:00',
        program: { title: 'SEM CENSURA\nAO VIVO' }
      });
      expect(classif.id).toBe('tv_brasil_aovivo');
      expect(classif.cor).toBe('#FFFF00');
    });

    it('detecta reprises da madrugada entre 01:00 e 05:45', () => {
      const classif = detectarClassificacao({
        time: '02:30:00',
        tipoExibicao: 'reprise',
        program: { title: 'CAMINHOS DA REPORTAGEM' }
      });
      expect(classif.id).toBe('reprise_madrugada');
      expect(classif.cor).toBe('#D9D9D9');
    });

    it('detecta produções da RNCP por emissoras parceiras no título/código', () => {
      const classif = detectarClassificacao({
        time: '06:00:00',
        program: { title: 'RAIZ BRASILEIRA\nTV SAGRES\nT 03 EP 12' }
      });
      expect(classif.id).toBe('rnpc');
      expect(classif.cor).toBe('#B8CCE4');
    });
  });

  describe('Suporte a Faixas Compostas (ex: TV Brasil Animada)', () => {
    it('cria uma faixa composta com subprogramas', () => {
      const faixa = criarFaixaComposta({
        titulo: 'TV BRASIL ANIMADA',
        duracaoTotal: '05:15:00',
        subprogramas: [
          { titulo: 'Mundo Bita', temporada: 'T 09' },
          { titulo: 'Os Chocolix', temporada: 'T 01' }
        ]
      });

      expect(faixa.isFaixa).toBe(true);
      expect(faixa.titulo).toBe('TV BRASIL ANIMADA');
      expect(faixa.subprogramas).toHaveLength(2);
      expect(faixa.subprogramas[0].ordem).toBe(1);
      expect(faixa.subprogramas[1].ordem).toBe(2);
    });

    it('adiciona subprograma a uma faixa existente recalculando ordens', () => {
      const faixa = criarFaixaComposta({ titulo: 'Faixa Infantil' });
      const atualizada = adicionarSubprograma(faixa, {
        titulo: 'O Diário de Mika',
        temporada: 'T 02',
        duracao: '00:15:00'
      });

      expect(atualizada.subprogramas).toHaveLength(1);
      expect(atualizada.subprogramas[0].titulo).toBe('O Diário de Mika');
      expect(atualizada.subprogramas[0].ordem).toBe(1);
    });

    it('substitui um subprograma mantendo a posição e ordem na faixa', () => {
      const faixa = criarFaixaComposta({
        titulo: 'Faixa Infantil',
        subprogramas: [
          { id: 'sub-1', titulo: 'Desenho Antigo', temporada: 'T 01' },
          { id: 'sub-2', titulo: 'Desenho 2', temporada: 'T 01' }
        ]
      });

      const atualizada = substituirSubprograma(faixa, 'sub-1', {
        titulo: 'Desenho Novo',
        temporada: 'T 02'
      });

      expect(atualizada.subprogramas[0].titulo).toBe('Desenho Novo');
      expect(atualizada.subprogramas[0].temporada).toBe('T 02');
      expect(atualizada.subprogramas[0].ordem).toBe(1);
      expect(atualizada.subprogramas[1].titulo).toBe('Desenho 2');
    });

    it('remove um subprograma e reajusta as ordens sequenciais', () => {
      const faixa = criarFaixaComposta({
        titulo: 'Faixa Infantil',
        subprogramas: [
          { id: 's1', titulo: 'Atração 1' },
          { id: 's2', titulo: 'Atração 2' },
          { id: 's3', titulo: 'Atração 3' }
        ]
      });

      const atualizada = removerSubprograma(faixa, 's2');
      expect(atualizada.subprogramas).toHaveLength(2);
      expect(atualizada.subprogramas.map(s => s.titulo)).toEqual(['Atração 1', 'Atração 3']);
      expect(atualizada.subprogramas[1].ordem).toBe(2);
    });

    it('faz o parsing de texto com lista de atrações (ex: TV Brasil Animada da planilha)', () => {
      const texto = `TV BRASIL ANIMADA\n\nESSE E O BICHO - T 01\nLIA PEDRO E O MINIMUNDO - T 01\nMUNDO BITA - T 09`;
      const lista = parseSubprogramasTexto(texto);

      expect(lista).toHaveLength(3);
      expect(lista[0].titulo).toBe('ESSE E O BICHO');
      expect(lista[0].temporada).toBe('T 01');
      expect(lista[1].titulo).toBe('LIA PEDRO E O MINIMUNDO');
      expect(lista[2].titulo).toBe('MUNDO BITA');
      expect(lista[2].temporada).toBe('T 09');
    });
  });
});

import { describe, it, expect } from 'vitest';
import GradeRecorrenciaCore from '../../src/core/gradeRecorrenciaCore.js';

describe('GradeRecorrenciaCore — Etapa 3.1: Motor de Herança de Episódios Inéditos e Reprises', () => {
  const {
    TIPOS_SLOT,
    criarSlotRecorrente,
    normalizarBlocosEpisodio,
    normalizarEpisodio,
    vincularSlotReprise,
    propagarHerancaGradeSemana,
    atribuirEpisodioSlotMestre,
    desmembrarSlotEmItensRoteiro,
    validarConsistenciaReprises
  } = GradeRecorrenciaCore;

  describe('Normalização de Episódios e Estrutura de Blocos', () => {
    it('normaliza lista de blocos de programa com códigos e durações', () => {
      const blocosBrutos = [
        { duracao: '00:08:30', titulo: 'Bloco 1' },
        { duracao: '00:09:15', titulo: 'Bloco 2' },
        { duracao: '00:08:15', titulo: 'Bloco 3' }
      ];

      const blocos = normalizarBlocosEpisodio(blocosBrutos, '00:26:00', 'PAL_T01EP03');
      expect(blocos).toHaveLength(3);
      expect(blocos[0]).toEqual({
        bloco: 1,
        duracao: '00:08:30',
        code: 'PAL_T01EP03_B1',
        titulo: 'Bloco 1',
        midia: '0OMN'
      });
      expect(blocos[1].code).toBe('PAL_T01EP03_B2');
      expect(blocos[2].bloco).toBe(3);
    });

    it('gera bloco único padrão quando o programa não possui divisão em blocos', () => {
      const blocos = normalizarBlocosEpisodio([], '00:15:00', 'DESENHO_01');
      expect(blocos).toHaveLength(1);
      expect(blocos[0]).toEqual({
        bloco: 1,
        duracao: '00:15:00',
        code: 'DESENHO_01_B1',
        titulo: 'Bloco 1',
        midia: '0OMN'
      });
    });

    it('normaliza episódio completo com temporada, número, blocos e metadados', () => {
      const ep = normalizarEpisodio({
        titulo: 'O Desafio da Floresta',
        temporada: 2,
        episodioNumero: 5,
        codigo: 'PAL_T02EP05',
        classificacaoIndicativa: 'L',
        faixaOcupada: 'TV Brasil Animada',
        blocos: [
          { duracao: '00:13:00' },
          { duracao: '00:13:00' }
        ]
      });

      expect(ep.titulo).toBe('O Desafio da Floresta');
      expect(ep.temporada).toBe(2);
      expect(ep.episodioNumero).toBe(5);
      expect(ep.codigo).toBe('PAL_T02EP05');
      expect(ep.classificacaoIndicativa).toBe('L');
      expect(ep.faixaOcupada).toBe('TV Brasil Animada');
      expect(ep.blocos).toHaveLength(2);
      expect(ep.blocos[0].code).toBe('PAL_T02EP05_B1');
      expect(ep.blocos[1].code).toBe('PAL_T02EP05_B2');
    });
  });

  describe('Vínculo Mestre-Seguidor (Master-Follower)', () => {
    it('vincula um slot de reprise a um slot mestre inédito', () => {
      const slotMestre = criarSlotRecorrente({
        id: 'slot-seg-2000',
        diaSemana: 1, // Segunda
        horario: '20:00:00',
        programaNome: 'Caminhos da Reportagem',
        programaId: 'prog-caminhos',
        tipoExibicao: TIPOS_SLOT.INEDITO
      });
      slotMestre.episodio = normalizarEpisodio({
        titulo: 'Amazônia Sustentável',
        temporada: 1,
        episodioNumero: 10,
        codigo: 'CAM_T01EP10'
      });

      const slotReprise = criarSlotRecorrente({
        id: 'slot-qua-0200',
        diaSemana: 3, // Quarta
        horario: '02:00:00',
        programaNome: 'Caminhos da Reportagem',
        programaId: 'prog-caminhos'
      });

      const vinculado = vincularSlotReprise(slotReprise, slotMestre);
      expect(vinculado.tipoExibicao).toBe('reprise');
      expect(vinculado.mestreSlotId).toBe('slot-seg-2000');
      expect(vinculado.origemReprise).toEqual({ diaSemana: 1, horario: '20:00:00' });
      expect(vinculado.episodioHerdado).toBe(true);
      expect(vinculado.episodio.titulo).toBe('Amazônia Sustentável');
      expect(vinculado.episodio.codigo).toBe('CAM_T01EP10');
    });
  });

  describe('Propagação Automática de Episódios na Grade Semanal', () => {
    it('propaga episódio atribuído ao slot mestre para todas as suas reprises da semana', () => {
      // Grade da semana com 1 inédito (Segunda 20h) e 2 reprises (Quarta 02h e Domingo 16h)
      const gradeSemana = {
        1: [
          criarSlotRecorrente({
            id: 'mestre-seg',
            diaSemana: 1,
            horario: '20:00:00',
            programaNome: 'Palaloos',
            programaId: 'prg-palaloos',
            tipoExibicao: TIPOS_SLOT.INEDITO
          })
        ],
        3: [
          criarSlotRecorrente({
            id: 'reprise-qua',
            diaSemana: 3,
            horario: '02:00:00',
            programaNome: 'Palaloos',
            programaId: 'prg-palaloos',
            tipoExibicao: TIPOS_SLOT.REPRISE,
            origemReprise: { diaSemana: 1, horario: '20:00:00' }
          })
        ],
        0: [
          criarSlotRecorrente({
            id: 'reprise-dom',
            diaSemana: 0,
            horario: '16:00:00',
            programaNome: 'Palaloos',
            programaId: 'prg-palaloos',
            tipoExibicao: TIPOS_SLOT.REPRISE,
            origemReprise: { diaSemana: 1, horario: '20:00:00' }
          })
        ]
      };

      // Atribui o episódio T02EP04 ao slot mestre
      const gradeAtualizada = atribuirEpisodioSlotMestre(gradeSemana, 'mestre-seg', {
        titulo: 'A Grande Corrida',
        temporada: 2,
        episodioNumero: 4,
        codigo: 'PAL_T02EP04',
        classificacaoIndicativa: 'L',
        faixaOcupada: 'TV Brasil Animada',
        blocos: [
          { duracao: '00:08:00' },
          { duracao: '00:09:00' },
          { duracao: '00:09:00' }
        ]
      });

      // 1. Verifica se o mestre recebeu os dados completos
      const mestre = gradeAtualizada[1][0];
      expect(mestre.episodio.titulo).toBe('A Grande Corrida');
      expect(mestre.episodio.temporada).toBe(2);
      expect(mestre.episodio.episodioNumero).toBe(4);
      expect(mestre.episodio.blocos).toHaveLength(3);

      // 2. Verifica se a reprise da quarta-feira herdou tudo automaticamente
      const repriseQua = gradeAtualizada[3][0];
      expect(repriseQua.episodioHerdado).toBe(true);
      expect(repriseQua.episodio.titulo).toBe('A Grande Corrida');
      expect(repriseQua.episodio.codigo).toBe('PAL_T02EP04');
      expect(repriseQua.episodio.temporada).toBe(2);
      expect(repriseQua.episodio.episodioNumero).toBe(4);
      expect(repriseQua.episodio.blocos).toHaveLength(3);
      expect(repriseQua.classificacao).toBe('L');
      expect(repriseQua.faixaOcupada).toBe('TV Brasil Animada');

      // 3. Verifica se a reprise do domingo também herdou
      const repriseDom = gradeAtualizada[0][0];
      expect(repriseDom.episodioHerdado).toBe(true);
      expect(repriseDom.episodio.titulo).toBe('A Grande Corrida');
      expect(repriseDom.episodio.blocos).toHaveLength(3);
    });

    it('vincula reprise por programa mesmo sem origemReprise explícita (auto-pairing)', () => {
      const gradeSemana = {
        2: [
          criarSlotRecorrente({
            id: 'mestre-ter',
            diaSemana: 2,
            horario: '10:00:00',
            programaNome: 'Sem Censura',
            tipoExibicao: TIPOS_SLOT.INEDITO
          })
        ],
        4: [
          criarSlotRecorrente({
            id: 'reprise-qui',
            diaSemana: 4,
            horario: '23:00:00',
            programaNome: 'Sem Censura',
            tipoExibicao: TIPOS_SLOT.REPRISE
            // Sem origemReprise e sem mestreSlotId
          })
        ]
      };

      const gradeAtualizada = atribuirEpisodioSlotMestre(gradeSemana, 'mestre-ter', {
        titulo: 'Debate de Literatura',
        codigo: 'SC_LIT_01'
      });

      const reprise = gradeAtualizada[4][0];
      expect(reprise.episodioHerdado).toBe(true);
      expect(reprise.mestreSlotId).toBe('mestre-ter');
      expect(reprise.episodio.titulo).toBe('Debate de Literatura');
    });

    it('respeita bloquearHeranca em reprise recorrente', () => {
      const grade = {
        1: [{ id: 'master', diaSemana: 1, horario: '20:00', tipoExibicao: 'inedito', programaId: 'p1', episodio: { titulo: 'Episódio mestre' } }],
        3: [{ id: 'rerun', diaSemana: 3, horario: '20:00', tipoExibicao: 'reprise', programaId: 'p1', origemReprise: { diaSemana: 1, horario: '20:00' }, bloquearHeranca: true, episodio: { titulo: 'Episódio especial' } }]
      };
      const result = propagarHerancaGradeSemana(grade);
      expect(result[3][0].episodio.titulo).toBe('Episódio especial');
    });

    it('não sobrescreve reprise que possua exceção pontual bloqueada', () => {
      const gradeSemana = {
        1: [
          criarSlotRecorrente({
            id: 'mestre-seg',
            diaSemana: 1,
            horario: '20:00:00',
            programaNome: 'Programa Especial',
            tipoExibicao: TIPOS_SLOT.INEDITO
          })
        ],
        3: [
          {
            ...criarSlotRecorrente({
              id: 'reprise-qua',
              diaSemana: 3,
              horario: '20:00:00',
              programaNome: 'Programa Especial',
              tipoExibicao: TIPOS_SLOT.REPRISE,
              mestreSlotId: 'mestre-seg'
            }),
            isExcecao: true,
            bloquearHeranca: true,
            episodio: normalizarEpisodio({
              titulo: 'Episódio Antigo Clássico',
              codigo: 'ESP_CLASSICO'
            })
          }
        ]
      };

      const gradeAtualizada = atribuirEpisodioSlotMestre(gradeSemana, 'mestre-seg', {
        titulo: 'Novo Episódio 2026',
        codigo: 'ESP_2026'
      });

      // O mestre foi atualizado
      expect(gradeAtualizada[1][0].episodio.titulo).toBe('Novo Episódio 2026');

      // A reprise com bloqueio preservou o episódio de exceção
      expect(gradeAtualizada[3][0].episodio.titulo).toBe('Episódio Antigo Clássico');
      expect(gradeAtualizada[3][0].isExcecao).toBe(true);
    });
  });

  describe('Desmembramento de Slot para Alimentação do Roteiro', () => {
    it('desmembra slot de 3 blocos intercalando com breaks', () => {
      const slot = {
        id: 'slot-1',
        programaNome: 'Palaloos',
        programaId: 'prg-palaloos',
        isReprise: false,
        episodio: normalizarEpisodio({
          titulo: 'A Grande Corrida',
          temporada: 2,
          episodioNumero: 4,
          codigo: 'PAL_T02EP04',
          blocos: [
            { duracao: '00:08:00' },
            { duracao: '00:09:00' },
            { duracao: '00:09:00' }
          ]
        })
      };

      const itens = desmembrarSlotEmItensRoteiro(slot, {
        duracaoBreakPadrao: '00:03:00'
      });

      // 3 blocos geram 5 itens: Bloco 1, Break 1, Bloco 2, Break 2, Bloco 3
      expect(itens).toHaveLength(5);

      // Item 1: Bloco 1
      expect(itens[0].type).toBe('RPRO');
      expect(itens[0].code).toBe('PAL_T02EP04_B1');
      expect(itens[0].tempo).toBe('00:08:00');
      expect(itens[0].bloco).toBe(1);
      expect(itens[0].totalBlocos).toBe(3);

      // Item 2: Break 1
      expect(itens[1].type).toBe('BREAK');
      expect(itens[1].code).toBe('BREAK_1');
      expect(itens[1].tempo).toBe('00:03:00');
      expect(itens[1].ehBreak).toBe(true);

      // Item 3: Bloco 2
      expect(itens[2].type).toBe('RPRO');
      expect(itens[2].code).toBe('PAL_T02EP04_B2');
      expect(itens[2].tempo).toBe('00:09:00');
      expect(itens[2].bloco).toBe(2);

      // Item 4: Break 2
      expect(itens[3].type).toBe('BREAK');
      expect(itens[3].numeroBreak).toBe(2);

      // Item 5: Bloco 3
      expect(itens[4].type).toBe('RPRO');
      expect(itens[4].code).toBe('PAL_T02EP04_B3');
      expect(itens[4].tempo).toBe('00:09:00');
      expect(itens[4].bloco).toBe(3);
    });

    it('gera item único para slots de bloco único sem breaks internos', () => {
      const slot = {
        id: 'slot-jornal',
        programaNome: 'Repórter Brasil Noite',
        episodio: normalizarEpisodio({
          titulo: 'Edição de Terça',
          duracao: '00:55:00',
          codigo: 'RBN_20261117'
        })
      };

      const itens = desmembrarSlotEmItensRoteiro(slot);
      expect(itens).toHaveLength(1);
      expect(itens[0].type).toBe('RPRO');
      expect(itens[0].tempo).toBe('00:55:00');
      expect(itens[0].bloco).toBe(1);
      expect(itens[0].totalBlocos).toBe(1);
    });
  });

  describe('Validação de Consistência e Auditoria da Grade Semanal', () => {
    it('detecta quando uma reprise não encontra seu slot mestre na semana', () => {
      const gradeSemana = {
        1: [
          criarSlotRecorrente({
            id: 'reprise-orfa',
            diaSemana: 1,
            horario: '14:00:00',
            programaNome: 'Programa Desconhecido',
            tipoExibicao: TIPOS_SLOT.REPRISE,
            mestreSlotId: 'id-inexistente'
          })
        ]
      };

      const resultado = validarConsistenciaReprises(gradeSemana);
      expect(resultado.valido).toBe(false);
      expect(resultado.erros).toHaveLength(1);
      expect(resultado.erros[0].tipo).toBe('reprise_sem_mestre');
      expect(resultado.erros[0].slotId).toBe('reprise-orfa');
    });

    it('alerta quando uma reprise está agendada cronologicamente antes da estreia na semana', () => {
      const gradeSemana = {
        // Reprise na Segunda às 10h
        1: [
          criarSlotRecorrente({
            id: 'reprise-seg',
            diaSemana: 1,
            horario: '10:00:00',
            programaNome: 'Debate Semanal',
            tipoExibicao: TIPOS_SLOT.REPRISE,
            origemReprise: { diaSemana: 4, horario: '22:00:00' } // Estreia é só na Quinta!
          })
        ],
        // Inédito na Quinta às 22h
        4: [
          criarSlotRecorrente({
            id: 'mestre-qui',
            diaSemana: 4,
            horario: '22:00:00',
            programaNome: 'Debate Semanal',
            tipoExibicao: TIPOS_SLOT.INEDITO
          })
        ]
      };

      const resultado = validarConsistenciaReprises(gradeSemana);
      expect(resultado.valido).toBe(true); // Alerta não invalida a grade
      expect(resultado.alertas).toHaveLength(1);
      expect(resultado.alertas[0].tipo).toBe('reprise_precede_inedito');
    });

    it('fornece estatísticas consolidadas de cobertura de episódios e reprises', () => {
      const gradeSemana = {
        1: [
          criarSlotRecorrente({ id: 'm1', diaSemana: 1, tipoExibicao: TIPOS_SLOT.INEDITO }),
          criarSlotRecorrente({ id: 'f1', diaSemana: 1, tipoExibicao: TIPOS_SLOT.FIXO })
        ],
        3: [
          criarSlotRecorrente({ id: 'r1', diaSemana: 3, tipoExibicao: TIPOS_SLOT.REPRISE, mestreSlotId: 'm1' })
        ]
      };

      gradeSemana[1][0].episodio = normalizarEpisodio({ titulo: 'Ep 1' });
      const gradeAtualizada = propagarHerancaGradeSemana(gradeSemana);

      const relatorio = validarConsistenciaReprises(gradeAtualizada);
      expect(relatorio.estatisticas).toEqual({
        totalSlots: 3,
        totalIneditos: 1,
        totalReprises: 1,
        totalFixos: 1,
        reprisesVinculadas: 1,
        reprisesComEpisodio: 1,
        ineditosComEpisodio: 1
      });
    });
  });
});

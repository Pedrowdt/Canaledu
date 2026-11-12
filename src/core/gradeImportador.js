// src/core/gradeImportador.js
// Módulo de importação de grades para o Editor de Grade (CanalEdu White-Label).
// Suporta a grade padrão da TV Brasil (Semana 44) e parsing de CSV/JSON com pré-visualização.

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GradeImportador = factory(root.GradeEditorCore);
  }
})(typeof self !== 'undefined' ? self : this, function (GradeEditorCore) {
  'use strict';

  // Grade Oficial TV Brasil — Semana 44 (02 a 08 de Novembro de 2026)
  // Estruturada em blocos contínuos de 24h (das 06:00 às 06:00 do dia seguinte)
  const GRADE_TV_BRASIL_SEMANA_44 = {
    versao: 'Semana 44 (02 a 08/11/2026)',
    emissoraNome: 'TV Brasil',
    dias: {
      // 1: Segunda-feira
      1: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Raiz Brasileira', code: 'TV_SAGRES_T03_EP11', categoria: 'Regional' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:30:00', program: { title: 'Agro Amazonas', code: 'TV_AGUAS_T03_EP31', categoria: 'Agronegócio' }, tipoExibicao: 'inedito' },
        { time: '07:00:00', duration: '05:45:00', program: { title: 'TV Brasil Animada', code: 'FAIXA_INFANTIL_SEG', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '12:45:00', duration: '00:45:00', program: { title: 'Repórter Brasil Tarde', code: 'RBT_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'Nova Amazônia', code: 'TV_AGUAS_T09_EP07', categoria: 'Regional' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP01', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '14:30:00', duration: '00:30:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T03_EP11', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:00:00', duration: '00:30:00', program: { title: 'Parques do Brasil', code: 'PARQUES_T04_EP02', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:30:00', duration: '00:30:00', program: { title: 'Expedições', code: 'EXPED_T11_EP03', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '16:00:00', duration: '01:00:00', program: { title: 'TV Brasil Animada Tarde', code: 'INFANTIL_TARDE_01', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '17:00:00', duration: '01:15:00', program: { title: 'Sem Censura', code: 'SC_T26_EP126', categoria: 'Entrevistas' }, tipoExibicao: 'inedito' },
        { time: '18:15:00', duration: '00:45:00', program: { title: 'Trio de Ataque', code: 'TRIO_AOVIVO', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '01:15:00', program: { title: 'Repórter Brasil', code: 'RB_NOITE_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:30:00', program: { title: 'Um Milagre', code: 'MILAGRE_T01_EP109', categoria: 'Novela' }, tipoExibicao: 'inedito' },
        { time: '21:45:00', duration: '01:15:00', program: { title: 'Sessão de Cinema', code: 'CINE_SUJEITO_OCULTO', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:00:00', duration: '01:30:00', program: { title: 'Caminhos da Reportagem', code: 'CAMINHOS_REP_SEG', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '00:30:00', duration: '01:30:00', program: { title: 'Sem Censura (Reprise)', code: 'SC_T26_EP126', categoria: 'Entrevistas' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 1, horario: '17:00:00' } },
        { time: '02:00:00', duration: '01:15:00', program: { title: 'Um Milagre (Reprise)', code: 'MILAGRE_T01_EP109', categoria: 'Novela' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 1, horario: '20:15:00' } },
        { time: '03:15:00', duration: '01:15:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_SUJEITO_OCULTO', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 1, horario: '21:45:00' } },
        { time: '04:30:00', duration: '00:45:00', program: { title: 'Caminhos da Reportagem (Reprise)', code: 'CAMINHOS_REP_SEG', categoria: 'Jornalismo' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 1, horario: '23:00:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Trio de Ataque (Reprise)', code: 'TRIO_AOVIVO', categoria: 'Esportes' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 1, horario: '18:15:00' } },
      ],
      // 2: Terça-feira
      2: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Discotoca', code: 'TVC_PARA_T03_EP13', categoria: 'Música' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:30:00', program: { title: 'Agro Educativa', code: 'TV_MS_T02_EP43', categoria: 'Agronegócio' }, tipoExibicao: 'inedito' },
        { time: '07:00:00', duration: '05:45:00', program: { title: 'TV Brasil Animada', code: 'FAIXA_INFANTIL_TER', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '12:45:00', duration: '00:45:00', program: { title: 'Repórter Brasil Tarde', code: 'RBT_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'Destino Pernambuco', code: 'TV_PE_T01_EP14', categoria: 'Turismo' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP02', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '14:30:00', duration: '00:30:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T03_EP12', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:00:00', duration: '00:30:00', program: { title: 'Parques do Brasil', code: 'PARQUES_T04_EP03', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:30:00', duration: '00:30:00', program: { title: 'Expedições', code: 'EXPED_T11_EP04', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '16:00:00', duration: '01:00:00', program: { title: 'TV Brasil Animada Tarde', code: 'INFANTIL_TARDE_02', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '17:00:00', duration: '01:15:00', program: { title: 'Sem Censura', code: 'SC_T26_EP127', categoria: 'Entrevistas' }, tipoExibicao: 'inedito' },
        { time: '18:15:00', duration: '00:45:00', program: { title: 'Estádio CBN', code: 'ESTADIO_CBN', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '01:15:00', program: { title: 'Repórter Brasil', code: 'RB_NOITE_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:30:00', program: { title: 'Um Milagre', code: 'MILAGRE_T01_EP110', categoria: 'Novela' }, tipoExibicao: 'inedito' },
        { time: '21:45:00', duration: '01:15:00', program: { title: 'Sessão de Cinema', code: 'CINE_TERCA', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:00:00', duration: '01:30:00', program: { title: 'Brasil Visual', code: 'BRASIL_VISUAL', categoria: 'Artes' }, tipoExibicao: 'inedito' },
        { time: '00:30:00', duration: '01:30:00', program: { title: 'Sem Censura (Reprise)', code: 'SC_T26_EP127', categoria: 'Entrevistas' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 2, horario: '17:00:00' } },
        { time: '02:00:00', duration: '01:15:00', program: { title: 'Um Milagre (Reprise)', code: 'MILAGRE_T01_EP110', categoria: 'Novela' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 2, horario: '20:15:00' } },
        { time: '03:15:00', duration: '01:15:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_TERCA', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 2, horario: '21:45:00' } },
        { time: '04:30:00', duration: '00:45:00', program: { title: 'Brasil Visual (Reprise)', code: 'BRASIL_VISUAL', categoria: 'Artes' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 2, horario: '23:00:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP01', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
      ],
      // 3: Quarta-feira
      3: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Univerciência', code: 'TV_UESB_T08_EP06', categoria: 'Ciência' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:30:00', program: { title: 'Culturas do Campo', code: 'TVE_ES_T02_EP44', categoria: 'Agronegócio' }, tipoExibicao: 'inedito' },
        { time: '07:00:00', duration: '05:45:00', program: { title: 'TV Brasil Animada', code: 'FAIXA_INFANTIL_QUA', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '12:45:00', duration: '00:45:00', program: { title: 'Repórter Brasil Tarde', code: 'RBT_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'Vem Ver', code: 'VEM_VER_T02_EP10', categoria: 'Regional' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP03', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '14:30:00', duration: '00:30:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T03_EP13', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:00:00', duration: '00:30:00', program: { title: 'Parques do Brasil', code: 'PARQUES_T04_EP04', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:30:00', duration: '00:30:00', program: { title: 'Expedições', code: 'EXPED_T11_EP05', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '16:00:00', duration: '01:00:00', program: { title: 'TV Brasil Animada Tarde', code: 'INFANTIL_TARDE_03', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '17:00:00', duration: '01:15:00', program: { title: 'Sem Censura', code: 'SC_T26_EP128', categoria: 'Entrevistas' }, tipoExibicao: 'inedito' },
        { time: '18:15:00', duration: '00:45:00', program: { title: 'No Mundo da Bola', code: 'BOLA_QUA', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '01:15:00', program: { title: 'Repórter Brasil', code: 'RB_NOITE_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:30:00', program: { title: 'Um Milagre', code: 'MILAGRE_T01_EP111', categoria: 'Novela' }, tipoExibicao: 'inedito' },
        { time: '21:45:00', duration: '01:15:00', program: { title: 'Sessão de Cinema', code: 'CINE_QUARTA', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:00:00', duration: '01:30:00', program: { title: 'Doc Especial', code: 'DOC_ESPECIAL_QUA', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '00:30:00', duration: '01:30:00', program: { title: 'Sem Censura (Reprise)', code: 'SC_T26_EP128', categoria: 'Entrevistas' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 3, horario: '17:00:00' } },
        { time: '02:00:00', duration: '01:15:00', program: { title: 'Um Milagre (Reprise)', code: 'MILAGRE_T01_EP111', categoria: 'Novela' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 3, horario: '20:15:00' } },
        { time: '03:15:00', duration: '01:15:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_QUARTA', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 3, horario: '21:45:00' } },
        { time: '04:30:00', duration: '00:45:00', program: { title: 'Doc Especial (Reprise)', code: 'DOC_ESPECIAL_QUA', categoria: 'Documentário' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 3, horario: '23:00:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP02', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
      ],
      // 4: Quinta-feira
      4: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Vozes do Semiárido', code: 'TV_UERN_T01_EP03', categoria: 'Regional' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:30:00', program: { title: 'Agricultura Alto Vale', code: 'BELA_ALIANCA_T03_EP44', categoria: 'Agronegócio' }, tipoExibicao: 'inedito' },
        { time: '07:00:00', duration: '05:45:00', program: { title: 'TV Brasil Animada', code: 'FAIXA_INFANTIL_QUI', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '12:45:00', duration: '00:45:00', program: { title: 'Repórter Brasil Tarde', code: 'RBT_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'É Logo Ali', code: 'TVE_ES_T01_EP19', categoria: 'Regional' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP04', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '14:30:00', duration: '00:30:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T04_EP01', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:00:00', duration: '00:30:00', program: { title: 'Parques do Brasil', code: 'PARQUES_T04_EP05', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:30:00', duration: '00:30:00', program: { title: 'Expedições', code: 'EXPED_T11_EP06', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '16:00:00', duration: '01:00:00', program: { title: 'TV Brasil Animada Tarde', code: 'INFANTIL_TARDE_04', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '17:00:00', duration: '01:15:00', program: { title: 'Sem Censura', code: 'SC_T26_EP129', categoria: 'Entrevistas' }, tipoExibicao: 'inedito' },
        { time: '18:15:00', duration: '00:45:00', program: { title: 'Stadium', code: 'STADIUM_AOVIVO', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '01:15:00', program: { title: 'Repórter Brasil', code: 'RB_NOITE_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:30:00', program: { title: 'Um Milagre', code: 'MILAGRE_T01_EP112', categoria: 'Novela' }, tipoExibicao: 'inedito' },
        { time: '21:45:00', duration: '01:15:00', program: { title: 'Sessão de Cinema', code: 'CINE_QUINTA', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:00:00', duration: '01:30:00', program: { title: 'Grandes Musicais', code: 'GRANDES_MUSICAIS', categoria: 'Música' }, tipoExibicao: 'inedito' },
        { time: '00:30:00', duration: '01:30:00', program: { title: 'Sem Censura (Reprise)', code: 'SC_T26_EP129', categoria: 'Entrevistas' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 4, horario: '17:00:00' } },
        { time: '02:00:00', duration: '01:15:00', program: { title: 'Um Milagre (Reprise)', code: 'MILAGRE_T01_EP112', categoria: 'Novela' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 4, horario: '20:15:00' } },
        { time: '03:15:00', duration: '01:15:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_QUINTA', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 4, horario: '21:45:00' } },
        { time: '04:30:00', duration: '00:45:00', program: { title: 'Grandes Musicais (Reprise)', code: 'GRANDES_MUSICAIS', categoria: 'Música' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 4, horario: '23:00:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP03', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
      ],
      // 5: Sexta-feira
      5: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Olhar Independente', code: 'TVU_RN_T04_EP45', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:30:00', program: { title: 'Bem Viver', code: 'TVT_T03_EP39', categoria: 'Saúde' }, tipoExibicao: 'inedito' },
        { time: '07:00:00', duration: '05:45:00', program: { title: 'TV Brasil Animada', code: 'FAIXA_INFANTIL_SEX', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '12:45:00', duration: '00:45:00', program: { title: 'Repórter Brasil Tarde', code: 'RBT_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'Bem Bahia', code: 'TVE_BAHIA_T03_EP39', categoria: 'Regional' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP05', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '14:30:00', duration: '00:30:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T04_EP02', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:00:00', duration: '00:30:00', program: { title: 'Parques do Brasil', code: 'PARQUES_T04_EP06', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:30:00', duration: '00:30:00', program: { title: 'Expedições', code: 'EXPED_T11_EP07', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '16:00:00', duration: '01:00:00', program: { title: 'TV Brasil Animada Tarde', code: 'INFANTIL_TARDE_05', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '17:00:00', duration: '01:15:00', program: { title: 'Sem Censura', code: 'SC_T26_EP130', categoria: 'Entrevistas' }, tipoExibicao: 'inedito' },
        { time: '18:15:00', duration: '00:45:00', program: { title: 'Resumo Esportivo', code: 'RESUMO_ESP', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '01:15:00', program: { title: 'Repórter Brasil', code: 'RB_NOITE_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:30:00', program: { title: 'Um Milagre', code: 'MILAGRE_T01_EP113', categoria: 'Novela' }, tipoExibicao: 'inedito' },
        { time: '21:45:00', duration: '01:15:00', program: { title: 'Sessão de Cinema', code: 'CINE_SEXTA', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:00:00', duration: '01:30:00', program: { title: 'Cine Retrô', code: 'CINE_RETRO', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '00:30:00', duration: '01:30:00', program: { title: 'Sem Censura (Reprise)', code: 'SC_T26_EP130', categoria: 'Entrevistas' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 5, horario: '17:00:00' } },
        { time: '02:00:00', duration: '01:15:00', program: { title: 'Um Milagre (Reprise)', code: 'MILAGRE_T01_EP113', categoria: 'Novela' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 5, horario: '20:15:00' } },
        { time: '03:15:00', duration: '01:15:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_SEXTA', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 5, horario: '21:45:00' } },
        { time: '04:30:00', duration: '00:45:00', program: { title: 'Cine Retrô (Reprise)', code: 'CINE_RETRO', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 5, horario: '23:00:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP04', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
      ],
      // 6: Sábado
      6: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Som do Brasil', code: 'SOM_BRASIL_SAB', categoria: 'Música' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:30:00', program: { title: 'Vale Agrícola', code: 'VALE_AGRICOLA_SAB', categoria: 'Agronegócio' }, tipoExibicao: 'inedito' },
        { time: '07:00:00', duration: '05:30:00', program: { title: 'TV Brasil Animada Especial', code: 'INFANTIL_SABADO', categoria: 'Infantil' }, tipoExibicao: 'fixo' },
        { time: '12:30:00', duration: '00:30:00', program: { title: 'Cozinha Amazônia', code: 'COZINHA_AMAZONIA_T03_EP07', categoria: 'Culinária' }, tipoExibicao: 'inedito' },
        { time: '13:00:00', duration: '00:30:00', program: { title: 'Xodó de Cozinha', code: 'XODO_T01_EP25', categoria: 'Culinária' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'Duelo de Guitarras', code: 'GUITARRAS_T01_EP03', categoria: 'Música' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP01', categoria: 'Documentário' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 1, horario: '14:00:00' } },
        { time: '14:30:00', duration: '00:45:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T04_EP03', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:15:00', duration: '02:00:00', program: { title: 'Brasil Esporte Especial', code: 'BRASIL_ESPORTE_SAB', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '17:15:00', duration: '00:45:00', program: { title: 'Sessão de Cinema Curta', code: 'CINE_PEDRA_FAROL', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '18:00:00', duration: '00:30:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP05', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '18:30:00', duration: '00:30:00', program: { title: 'Estações', code: 'REDE_MINAS_T03_EP04', categoria: 'Cultura' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '00:30:00', program: { title: 'Repórter Brasil', code: 'RB_SAB_AOVIVO', categoria: 'Jornalismo' }, tipoExibicao: 'inedito' },
        { time: '19:30:00', duration: '00:45:00', program: { title: 'Afiadas', code: 'AFIADAS_T01_EP05', categoria: 'Debate' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:15:00', program: { title: 'Um Milagre', code: 'MILAGRE_T01_EP114', categoria: 'Novela' }, tipoExibicao: 'inedito' },
        { time: '21:30:00', duration: '02:00:00', program: { title: 'Sessão de Cinema Especial', code: 'CINE_ESPECIAL_SAB', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:30:00', duration: '01:30:00', program: { title: 'Noite dos Museus', code: 'MUSEUS_SAB', categoria: 'Cultura' }, tipoExibicao: 'inedito' },
        { time: '01:00:00', duration: '02:00:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_ESPECIAL_SAB', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 6, horario: '21:30:00' } },
        { time: '03:00:00', duration: '01:15:00', program: { title: 'Um Milagre (Reprise)', code: 'MILAGRE_T01_EP114', categoria: 'Novela' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 6, horario: '20:15:00' } },
        { time: '04:15:00', duration: '01:00:00', program: { title: 'Afiadas (Reprise)', code: 'AFIADAS_T01_EP05', categoria: 'Debate' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 6, horario: '19:30:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP05', categoria: 'Documentário' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 6, horario: '18:00:00' } },
      ],
      // 0: Domingo
      0: [
        { time: '06:00:00', duration: '00:30:00', program: { title: 'Retratos de Fé', code: 'RETRATOS_FE_T02_EP26', categoria: 'Religioso' }, tipoExibicao: 'inedito' },
        { time: '06:30:00', duration: '00:45:00', program: { title: 'De Volta às Escrituras', code: 'TV_GUARAPARI_T03_EP40', categoria: 'Religioso' }, tipoExibicao: 'inedito' },
        { time: '07:15:00', duration: '01:00:00', program: { title: 'Palavras de Vida', code: 'PALAVRAS_VIDA', categoria: 'Religioso' }, tipoExibicao: 'inedito' },
        { time: '08:15:00', duration: '01:00:00', program: { title: 'Santa Missa', code: 'MISSA_AOVIVO', categoria: 'Religioso' }, tipoExibicao: 'inedito' },
        { time: '09:15:00', duration: '01:00:00', program: { title: 'Vale Agrícola', code: 'VALE_AGRICOLA_DOM', categoria: 'Agronegócio' }, tipoExibicao: 'inedito' },
        { time: '10:15:00', duration: '02:15:00', program: { title: 'Futebol Feminino: Semifinal Paulista Sub-20', code: 'FUTEBOL_FEM_AOVIVO', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '12:30:00', duration: '01:00:00', program: { title: 'Canto e Sabor do Brasil', code: 'CANTO_SABOR_T02_EP43', categoria: 'Música' }, tipoExibicao: 'inedito' },
        { time: '13:30:00', duration: '00:30:00', program: { title: 'Samba na Gamboa', code: 'SAMBA_GAMBOA', categoria: 'Música' }, tipoExibicao: 'inedito' },
        { time: '14:00:00', duration: '00:30:00', program: { title: 'Faróis do Brasil', code: 'FAROIS_T01_EP02', categoria: 'Documentário' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 2, horario: '14:00:00' } },
        { time: '14:30:00', duration: '00:30:00', program: { title: 'Meu Pedaço do Brasil', code: 'PEDUS_T04_EP04', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:00:00', duration: '00:30:00', program: { title: 'Parques do Brasil', code: 'PARQUES_T01_EP01', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
        { time: '15:30:00', duration: '00:30:00', program: { title: 'Expedições', code: 'EXPED_T11_EP08', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '16:00:00', duration: '01:30:00', program: { title: 'Sessão Família', code: 'SESSAO_FAMILIA', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '17:30:00', duration: '01:30:00', program: { title: 'Sessão de Cinema: Dança', code: 'CINE_MARCIA_HAYDEE', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '19:00:00', duration: '00:45:00', program: { title: 'Recordar TV', code: 'RECORDAR_T05_EP01', categoria: 'Memória' }, tipoExibicao: 'inedito' },
        { time: '19:45:00', duration: '00:30:00', program: { title: 'Um Ano Selvagem na Terra', code: 'SELVAGEM_T01_EP05', categoria: 'Natureza' }, tipoExibicao: 'inedito' },
        { time: '20:15:00', duration: '01:15:00', program: { title: 'Estádio CBN Domingo', code: 'ESTADIO_CBN_DOM', categoria: 'Esportes' }, tipoExibicao: 'inedito' },
        { time: '21:30:00', duration: '02:00:00', program: { title: 'Sessão de Cinema Clássico', code: 'CINE_DOMINGO', categoria: 'Cinema' }, tipoExibicao: 'inedito' },
        { time: '23:30:00', duration: '01:30:00', program: { title: 'Canto e Sabor do Brasil (Reprise)', code: 'CANTO_SABOR_T02_EP43', categoria: 'Música' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 0, horario: '12:30:00' } },
        { time: '01:00:00', duration: '02:00:00', program: { title: 'Sessão de Cinema (Reprise)', code: 'CINE_DOMINGO', categoria: 'Cinema' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 0, horario: '21:30:00' } },
        { time: '03:00:00', duration: '01:30:00', program: { title: 'Samba na Gamboa (Reprise)', code: 'SAMBA_GAMBOA', categoria: 'Música' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 0, horario: '13:30:00' } },
        { time: '04:30:00', duration: '00:45:00', program: { title: 'Recordar TV (Reprise)', code: 'RECORDAR_T05_EP01', categoria: 'Memória' }, tipoExibicao: 'reprise', repriseDe: { diaSemana: 0, horario: '19:00:00' } },
        { time: '05:15:00', duration: '00:45:00', program: { title: 'Brasil Sobre Duas Rodas', code: 'DUAS_RODAS_T01_EP06', categoria: 'Documentário' }, tipoExibicao: 'inedito' },
      ],
    },
  };

  /**
   * Converte o preset ou um objeto estruturado em blocos e acervo prontos para o Editor de Grade.
   */
  function prepararPreviaImportacao(dadosGrade, acervoAtual = []) {
    if (!dadosGrade || !dadosGrade.dias) {
      throw new Error('Formato de dados de grade inválido. Objeto com chave "dias" é esperado.');
    }

    const acervoMap = new Map();
    (acervoAtual || []).forEach(p => {
      if (p && p.title) {
        acervoMap.set(p.title.trim().toUpperCase(), p);
      }
    });

    const novosProgramas = [];
    const programasIdentificados = new Map();
    let totalSlots = 0;
    const diasResumo = {};
    const slotsPorDia = {};
    const recorrenciaSugerida = { slots: {}, episodeQueues: {}, dateExceptions: {} };

    // Dias 0 a 6
    [1, 2, 3, 4, 5, 6, 0].forEach(d => {
      const items = dadosGrade.dias[d] || [];
      diasResumo[d] = {
        nome: getNomeDia(d),
        totalSlots: items.length,
        duracaoTotalSec: 0,
        programasUnicos: new Set(),
      };

      const blocks = [];
      items.forEach((item, idx) => {
        totalSlots++;
        const prog = item.program || {};
        const title = (prog.title || 'Livre').trim();
        const code = (prog.code || '').trim();
        const categoria = prog.categoria || 'Geral';
        const durStr = item.duration || '00:30:00';
        const durSec = timeToSec(durStr);
        diasResumo[d].duracaoTotalSec += durSec;
        diasResumo[d].programasUnicos.add(title);

        if (title !== 'Livre') {
          const keyUpper = title.toUpperCase();
          if (!acervoMap.has(keyUpper) && !programasIdentificados.has(keyUpper)) {
            const novo = {
              title: title,
              code: code,
              categoria: categoria,
              tempo: durStr,
            };
            novosProgramas.push(novo);
            programasIdentificados.set(keyUpper, novo);
          }
        }

        const block = {
          id: `slot_imp_${d}_${idx}_${(item.time || '00:00:00').replace(/:/g, '')}`,
          index: idx,
          time: item.time || '06:00:00',
          duration: durStr,
          durationSec: durSec,
          endTime: addSeconds(item.time || '06:00:00', durSec),
          program: title !== 'Livre' ? { title, code, categoria } : null,
        };
        blocks.push(block);

        // Regras de exibição / recorrência
        if (item.tipoExibicao) {
          const slotKey = `${d}:${item.time || '06:00:00'}`;
          recorrenciaSugerida.slots[slotKey] = {
            tipoExibicao: item.tipoExibicao,
            origemInedito: item.repriseDe || null,
          };
        }
      });

      slotsPorDia[d] = blocks;
      diasResumo[d].programasUnicosCount = diasResumo[d].programasUnicos.size;
    });

    return {
      versao: dadosGrade.versao || 'Grade Semanal',
      emissoraNome: dadosGrade.emissoraNome || 'Emissora',
      totalSlots,
      diasResumo,
      novosProgramas,
      totalNovosProgramas: novosProgramas.length,
      slotsPorDia,
      recorrenciaSugerida,
    };
  }

  /**
   * Converte texto CSV em objeto estruturado de grade semanal.
   * Formato de colunas: dia;horario;duracao;programa;codigo;categoria;tipo
   */
  function parseCsvGrade(csvText) {
    if (!csvText || typeof csvText !== 'string') {
      throw new Error('Conteúdo CSV vazio ou inválido.');
    }

    const lines = csvText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'));

    if (lines.length === 0) {
      throw new Error('O arquivo CSV não possui linhas válidas.');
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const header = lines[0].split(delimiter).map(c => c.trim().toLowerCase());

    const idxDia = header.findIndex(h => h.includes('dia') || h === 'dow');
    const idxHora = header.findIndex(h => h.includes('hora') || h.includes('time'));
    const idxDur = header.findIndex(h => h.includes('dur') || h.includes('tempo'));
    const idxProg = header.findIndex(h => h.includes('prog') || h.includes('titulo') || h.includes('title'));
    const idxCode = header.findIndex(h => h.includes('cod') || h.includes('code'));
    const idxCat = header.findIndex(h => h.includes('cat'));
    const idxTipo = header.findIndex(h => h.includes('tipo'));

    if (idxProg === -1 && idxHora === -1) {
      throw new Error('Cabeçalho do CSV deve conter pelo menos as colunas "dia", "horario" e "programa".');
    }

    const dias = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 2) continue;

      const rawDia = idxDia !== -1 ? cols[idxDia] : '1';
      const dow = normalizarDiaSemana(rawDia);
      const time = idxHora !== -1 ? normalizarHorario(cols[idxHora]) : '06:00:00';
      const dur = idxDur !== -1 ? normalizarHorario(cols[idxDur]) : '00:30:00';
      const title = idxProg !== -1 ? cols[idxProg] : 'Livre';
      const code = idxCode !== -1 ? cols[idxCode] : '';
      const categoria = idxCat !== -1 ? cols[idxCat] : 'Geral';
      const tipoExibicao = idxTipo !== -1 ? cols[idxTipo] : 'inedito';

      if (dow !== null) {
        dias[dow].push({
          time,
          duration: dur,
          program: { title, code, categoria },
          tipoExibicao: tipoExibicao.toLowerCase().includes('reprise') ? 'reprise' : (tipoExibicao.toLowerCase().includes('fixo') ? 'fixo' : 'inedito'),
        });
      }
    }

    return {
      versao: 'Importação CSV',
      emissoraNome: 'Arquivo CSV',
      dias,
    };
  }

  function normalizarDiaSemana(val) {
    if (val === null || val === undefined) return 1;
    const s = String(val).trim().toLowerCase();
    if (s === '0' || s.startsWith('dom')) return 0;
    if (s === '1' || s.startsWith('seg')) return 1;
    if (s === '2' || s.startsWith('ter')) return 2;
    if (s === '3' || s.startsWith('qua')) return 3;
    if (s === '4' || s.startsWith('qui')) return 4;
    if (s === '5' || s.startsWith('sex')) return 5;
    if (s === '6' || s.startsWith('sab') || s.startsWith('sáb')) return 6;
    const n = parseInt(s, 10);
    return !isNaN(n) && n >= 0 && n <= 6 ? n : null;
  }

  function normalizarHorario(t) {
    if (!t) return '00:30:00';
    const s = String(t).trim();
    const parts = s.split(':').map(Number);
    if (parts.length === 3) {
      return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}:${String(parts[2]).padStart(2, '0')}`;
    }
    if (parts.length === 2) {
      return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}:00`;
    }
    return '00:30:00';
  }

  function timeToSec(t) {
    if (!t) return 0;
    const parts = String(t).trim().split(':').map(Number);
    if (parts.length >= 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    if (parts.length === 2) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60;
    return 0;
  }

  function secToTime(s) {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600) % 24;
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function addSeconds(timeStr, seconds) {
    const s = timeToSec(timeStr) + seconds;
    return secToTime(s);
  }

  function getNomeDia(dow) {
    const nomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return nomes[dow] || 'Dia';
  }

  return {
    GRADE_TV_BRASIL_SEMANA_44,
    prepararPreviaImportacao,
    parseCsvGrade,
    normalizarDiaSemana,
    normalizarHorario,
  };
});

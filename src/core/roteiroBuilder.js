// src/core/roteiroBuilder.js
// Geração automática do roteiro a partir da lista de programas do dia.
// Módulo puro e testável em Node — sem `state`, sem DOM, sem REGRAS global.
// Tudo que a função precisa vem por parâmetro.
//
// DIFERENÇA DE DESIGN em relação à implementação equivalente em app.js:
// As vinhetas "VH A SEGUIR <programa>" e "VH VC ESTA ASSISTINDO <programa>"
// no app.js são duas listas hardcoded (uma por programa). Aqui elas vêm de
// `catalogo` (o retorno de `pecasCatalog.catalogFromCadastro`), derivado das
// peças que a equipe já cadastra na tela de Peças e Programas como "VH A
// SEGUIR <PROGRAMA>" — dado, não código. Sem `catalogo`, essas duas vinhetas
// simplesmente não são inseridas (comportamento seguro/inerte).
//
// VH de classificação indicativa e as assinaturas (infantil/jovem/adulto),
// por outro lado, são só configuração (`regras.vh*`), sem depender de
// catálogo.

import { baseProgramTitle, getEpisodeId, timeToSec, secToTime, normalizeKey } from './normalize.js';

const START_SECONDS_DEFAULT = 6 * 3600; // 06:00:00 — início padrão do roteiro

function normProgKey(desc) {
  return normalizeKey(baseProgramTitle(desc || ''));
}

/** VH de classificação indicativa — só regras, sem catálogo. */
function getVhClassificacao(regras) {
  const cfg = (regras && regras.vhClassificacao) || {};
  if (cfg.ativo === false) return null;
  return {
    code: cfg.code || '85283',
    descricao: cfg.descricao || 'VH CLASSIFICAÇAO INDICATIVA LIVRE',
    tempo: cfg.tempo || '00:00:06',
    midia: '0OMN',
    type: 'EVNH',
  };
}

/** VH "A SEGUIR <programa>" — vem do catálogo (peças cadastradas), casada por palavra-chave. */
function findVhSeguir(desc, regras, catalogo) {
  if (regras && regras.vhSeguirAtivo === false) return null;
  const key = normProgKey(desc);
  if (!key) return null;
  const mapa = (catalogo && catalogo.vhSeguirMap) || [];
  for (const vh of mapa) {
    if ((vh.keywords || []).some((k) => normalizeKey(k) === key)) return { ...vh };
  }
  return null;
}

/** VH "VC ESTA ASSISTINDO <programa>" — idem, do catálogo. */
function findVhAssistindo(desc, regras, catalogo) {
  if (regras && regras.vhAssistindoAtivo === false) return null;
  const key = normProgKey(desc);
  if (!key) return null;
  const mapa = (catalogo && catalogo.vhAssistindoMap) || [];
  for (const vh of mapa) {
    if ((vh.keywords || []).some((k) => normalizeKey(k) === key)) return { ...vh };
  }
  return null;
}

/**
 * Faixa de assinatura declarada no CADASTRO (instância Peças e Programas).
 *
 * Espelha `assinatura-programa.js` (versão UMD usada pelo navegador); aqui a
 * lógica é replicada para o módulo permanecer puro e sem dependência de DOM.
 *
 * Casamento com o bloco do roteiro:
 *   a) por `code` (exato);
 *   b) por título base normalizado ("PGM PALALOOS - BL 02" -> "PALALOOS").
 *
 * Programas inativos ou sem tag não decidem nada (retorna null -> fallback).
 *
 * @param {Object|string} item      bloco do roteiro ou sua descrição
 * @param {Array} programasCadastro lista de programas cadastrados
 * @returns {'infantil'|'jovem'|'adulto'|null}
 */
function faixaDoCadastro(item, programasCadastro) {
  const lista = programasCadastro || [];
  if (!lista.length) return null;
  const bloco = typeof item === 'string' ? { descricao: item } : item || {};
  const code = bloco.code ? String(bloco.code).trim() : '';
  const key = normProgKey(bloco.descricao);
  let porTitulo = null;

  for (const p of lista) {
    if (!p || p.ativo === false) continue;
    const bruto = Array.isArray(p.assinatura) ? p.assinatura[0] : p.assinatura;
    const faixa = String(bruto || '').trim().toLowerCase();
    if (!['infantil', 'jovem', 'adulto'].includes(faixa)) continue;
    if (code && String(p.code || '').trim() === code) return faixa; // match forte
    if (!porTitulo && key && normProgKey(p.descricao) === key) porTitulo = faixa;
  }
  return porTitulo;
}

/**
 * Assinatura (infantil/jovem/adulto) a inserir após o último bloco de um
 * programa.
 *
 * PRIORIDADE:
 *   0) TAG do cadastro do programa (Peças e Programas)      <- decisória
 *   1) `regras.classificacaoPrograma` (modal do Admin)      <- fallback
 *   2) palavras-chave `regras.vhAssinatura*Keywords`        <- fallback
 *   3) jovem (padrão)                                       <- fallback
 *
 * O cadastro decide QUAL faixa; as REGRAS seguem decidindo COMO ela entra
 * (code, descrição, tempo e `ativo`). Sem catálogo.
 *
 * @param {Object|string} desc      bloco do roteiro ou sua descrição
 * @param {Object} regras           configuração do Admin
 * @param {Array} [programasCadastro] programas cadastrados (fonte da verdade)
 */
function pickAssinatura(desc, regras, programasCadastro) {
  const r = regras || {};
  const bloco = typeof desc === 'string' ? { descricao: desc } : desc || {};
  desc = bloco.descricao || '';
  const u = normalizeKey(desc);
  const infKw = String(r.vhAssinaturaInfantilKeywords || '').split(',').map((k) => k.trim()).filter(Boolean);
  const adKw = String(r.vhAssinaturaAdultoKeywords || '').split(',').map((k) => k.trim()).filter(Boolean);
  const cfgInf = r.vhAssinaturaInfantil || {};
  const cfgJov = r.vhAssinaturaJovem || {};
  const cfgAdt = r.vhAssinaturaAdulto || {};

  const progKey = normProgKey(desc);
  // Prioridade 0: tag do cadastro; se ausente, cai na configuração do Admin.
  const classifExplicita =
    faixaDoCadastro(bloco, programasCadastro || r.programasCadastro) ||
    (r.classificacaoPrograma || {})[progKey];

  let cfg, defaultCode, defaultDesc;
  if (classifExplicita === 'infantil') {
    cfg = cfgInf; defaultCode = '85331'; defaultDesc = 'ASSINATURA_INFANTIL';
  } else if (classifExplicita === 'adulto') {
    cfg = cfgAdt; defaultCode = '85332'; defaultDesc = 'ASSINATURA_ADULTO';
  } else if (classifExplicita === 'jovem') {
    cfg = cfgJov; defaultCode = '85330'; defaultDesc = 'ASSINATURA_JOVEM';
  } else if (infKw.some((k) => u.includes(normalizeKey(k)))) {
    cfg = cfgInf; defaultCode = '85331'; defaultDesc = 'ASSINATURA_INFANTIL';
  } else if (adKw.some((k) => u.includes(normalizeKey(k)))) {
    cfg = cfgAdt; defaultCode = '85332'; defaultDesc = 'ASSINATURA_ADULTO';
  } else {
    cfg = cfgJov; defaultCode = '85330'; defaultDesc = 'ASSINATURA_JOVEM';
  }

  if (cfg.ativo === false) return null;
  return {
    code: cfg.code || defaultCode,
    descricao: cfg.descricao || defaultDesc,
    tempo: cfg.tempo || '00:00:05',
    midia: '0OMN',
    type: 'EVNH',
  };
}

/**
 * Injeta as peças fixas nas posições configuradas.
 *   - 'inicio'          → antes de tudo, na ordem em que aparecem
 *   - 'fim'              → depois de tudo
 *   - 'antes_programa'    → antes de cada item cujo type é 'RPRO'
 *   - 'apos_assinatura'   → depois de cada item cuja descrição começa com "ASSINATURA_"
 */
function injectPecasFixas(roteiro, pecasFixas) {
  const fixas = (pecasFixas || []).filter((f) => f && f.ativo !== false);
  if (!fixas.length) return roteiro;

  const makeFixed = (f) => ({
    code: f.code, descricao: f.descricao, tempo: f.tempo,
    midia: f.midia || '0OMN', type: f.type, _fixa: true,
  });

  const fInicio = fixas.filter((f) => f.posicao === 'inicio');
  const fFim = fixas.filter((f) => f.posicao === 'fim');
  const fAntesPrograma = fixas.filter((f) => f.posicao === 'antes_programa');
  const fAposAssinatura = fixas.filter((f) => f.posicao === 'apos_assinatura');

  let out = roteiro.slice();

  if (fAntesPrograma.length || fAposAssinatura.length) {
    const withMeio = [];
    out.forEach((item) => {
      if (item.type === 'RPRO') fAntesPrograma.forEach((f) => withMeio.push(makeFixed(f)));
      withMeio.push(item);
      if (item.descricao && item.descricao.startsWith('ASSINATURA_')) {
        fAposAssinatura.forEach((f) => withMeio.push(makeFixed(f)));
      }
    });
    out = withMeio;
  }

  return [...fInicio.map(makeFixed), ...out, ...fFim.map(makeFixed)];
}

/**
 * Gera o roteiro a partir da lista de programas do dia (na ordem em que
 * devem ir ao ar). Agrupa blocos consecutivos do mesmo programa/episódio,
 * ajusta o horário de início de cada programa contra a grade fornecida
 * (injetando um "__GAP__" quando sobra tempo) e insere vinhetas/breaks.
 *
 * @param {Array} programs      Lista de blocos de programa (na ordem do dia)
 * @param {Object} regras       Config equivalente a REGRAS_DEFAULT (vh*, etc.)
 * @param {Object} [grade]      Mapa "Título do programa [nª]" -> "HH:MM:SS" esperado
 * @param {Array} [pecasFixas]  Peças fixas a injetar (code, descricao, tempo, type, posicao, ativo)
 * @param {Object} [catalogo]   Retorno de pecasCatalog.catalogFromCadastro (vhSeguirMap/vhAssistindoMap)
 * @param {number} [startSeconds] Segundo inicial do roteiro (padrão 06:00:00)
 * @param {Array} [programasCadastro] Programas cadastrados em Peças e Programas.
 *        A tag `assinatura` (infantil/jovem/adulto) de cada programa é a fonte
 *        decisória da VH de assinatura; as regras do Admin viram fallback.
 * @returns {Array} itens do roteiro, na ordem de exibição
 */
export function buildRoteiroFromPrograms(programs, regras, grade, pecasFixas, catalogo, startSeconds, programasCadastro) {
  const r = regras || {};
  const gradeDiaria = grade || {};
  const START_SECONDS = typeof startSeconds === 'number' ? startSeconds : START_SECONDS_DEFAULT;

  const roteiro = [];
  let cumSec = START_SECONDS;
  const occurrenceCount = {};
  const list = programs || [];

  let i = 0;
  while (i < list.length) {
    const prog = list[i];
    const baseTitle = baseProgramTitle(prog.descricao);

    const n = occurrenceCount[baseTitle] || 0;
    occurrenceCount[baseTitle] = n + 1;
    const ordinal = n + 1;
    const gradeKey = ordinal === 1 ? baseTitle : `${baseTitle} [${ordinal}ª]`;

    // ── Ajuste contra a grade ──
    const expectedTimeStr = gradeDiaria[gradeKey];
    if (expectedTimeStr) {
      let expectedSec = timeToSec(expectedTimeStr);
      if (expectedSec < START_SECONDS) expectedSec += 86400;
      if (expectedSec > cumSec) {
        const gapSec = expectedSec - cumSec;
        roteiro.push({
          code: '__GAP__',
          descricao: `[ AJUSTE PARA GRADE — Aguardando ${gradeKey} às ${expectedTimeStr} ]`,
          tempo: secToTime(gapSec),
          midia: '0OMN',
          type: '__SLOT__',
          _gap: true,
        });
        cumSec = expectedSec;
      }
    }

    // Coleta todos os blocos consecutivos deste programa
    const blocks = [prog];
    let j = i + 1;
    while (j < list.length && baseProgramTitle(list[j].descricao) === baseTitle) {
      blocks.push(list[j]);
      j++;
    }

    // ── Antes do 1º bloco: VH A SEGUIR ──
    const vhSeguir = findVhSeguir(prog.descricao, r, catalogo);
    if (vhSeguir) { roteiro.push({ ...vhSeguir }); cumSec += timeToSec(vhSeguir.tempo); }

    // ── Blocos + breaks ──
    blocks.forEach((block, bIdx) => {
      if (!/BL\s*0[2-5]/i.test(block.descricao || '')) {
        const vhClassif = getVhClassificacao(r);
        if (vhClassif) { roteiro.push({ ...vhClassif }); cumSec += timeToSec(vhClassif.tempo); }
      }

      roteiro.push({ ...block });
      cumSec += timeToSec(block.tempo);

      const isLastBlock = bIdx === blocks.length - 1;
      if (!isLastBlock) {
        const nextBlock = blocks[bIdx + 1];
        const sameEpisode = getEpisodeId(block.descricao) === getEpisodeId(nextBlock.descricao);

        if (sameEpisode) {
          const vhAss = findVhAssistindo(block.descricao, r, catalogo);
          if (vhAss) { roteiro.push({ ...vhAss }); cumSec += timeToSec(vhAss.tempo); }
          roteiro.push({ code: '__BREAK__', descricao: '[ BREAK — chamada ]', tempo: '00:00:00', midia: '0OMN', type: '__SLOT__', _break: true });
          roteiro.push({ code: '__BREAK__', descricao: '[ BREAK — interprograma ]', tempo: '00:00:00', midia: '0OMN', type: '__SLOT__', _break: true });
          if (vhAss) { roteiro.push({ ...vhAss }); cumSec += timeToSec(vhAss.tempo); }
        } else {
          roteiro.push({ code: '__BREAK__', descricao: '[ BREAK — chamada ]', tempo: '00:00:00', midia: '0OMN', type: '__SLOT__', _break: true });
          roteiro.push({ code: '__BREAK__', descricao: '[ BREAK — interprograma ]', tempo: '00:00:00', midia: '0OMN', type: '__SLOT__', _break: true });
        }
      } else {
        const ass = pickAssinatura(block, r, programasCadastro);
        if (ass) { roteiro.push(ass); cumSec += timeToSec(ass.tempo); }
      }
    });

    i = j;
  }

  return injectPecasFixas(roteiro, pecasFixas);
}

export { getVhClassificacao, findVhSeguir, findVhAssistindo, pickAssinatura, injectPecasFixas, faixaDoCadastro };

// src/core/roteiroBuilder.js
// CONFECÇÃO DE ROTEIROS — função central, pura e testável.
// Alimentada pelo cadastro de Peças e Programas (via pecasCatalog) e pelas
// REGRAS de negócio. Não toca em DOM, localStorage nem Supabase.

import { baseProgramTitle, getEpisodeId, normalizeKey, timeToSec, secToTime } from './normalize.js';
import { catalogFromCadastro } from './pecasCatalog.js';

const START_SECONDS_DEFAULT = 6 * 3600;

const ASSINATURA_DEFAULTS = {
  infantil: { key: 'vhAssinaturaInfantil', code: '85331', descricao: 'ASSINATURA_INFANTIL' },
  jovem: { key: 'vhAssinaturaJovem', code: '85330', descricao: 'ASSINATURA_JOVEM' },
  adulto: { key: 'vhAssinaturaAdulto', code: '85332', descricao: 'ASSINATURA_ADULTO' },
};

const slot = (code, descricao, flag) => ({
  code,
  descricao,
  tempo: '00:00:00',
  midia: '0OMN',
  type: '__SLOT__',
  [flag]: true,
});

function findVh(map, descricao) {
  const base = normalizeKey(baseProgramTitle(descricao));
  if (!base) return null;
  for (const vh of map || []) {
    if ((vh.keywords || []).some((k) => normalizeKey(k) === base)) return { ...vh };
  }
  return null;
}

function splitKeywords(csv) {
  return String(csv || '')
    .split(',')
    .map((k) => normalizeKey(k))
    .filter(Boolean);
}

/** VH de classificação indicativa, com prioridade para a peça cadastrada. */
export function getVhClassificacao(regras = {}, catalogo = {}) {
  const cfg = regras.vhClassificacao || {};
  if (cfg.ativo === false) return null;
  if (catalogo.vhClassificacao) return { ...catalogo.vhClassificacao };
  if (!cfg.code && !regras.vhClassificacao) return null;
  return {
    code: cfg.code || '85283',
    descricao: cfg.descricao || 'VH CLASSIFICAÇAO INDICATIVA LIVRE',
    tempo: cfg.tempo || '00:00:06',
    midia: '0OMN',
    type: 'EVNH',
  };
}

/**
 * Faixa de assinatura do programa. Prioridade:
 * 1) assinatura marcada no CADASTRO do programa
 * 2) classificação explícita nas regras
 * 3) keywords das regras
 * 4) jovem (padrão)
 */
export function resolveFaixa(descricao, regras = {}, catalogo = {}) {
  const base = normalizeKey(baseProgramTitle(descricao));
  const prog = (catalogo.programas || []).find((p) => normalizeKey(baseProgramTitle(p.descricao)) === base);
  const doCadastro = (prog?.assinatura || [])[0];
  if (doCadastro && ASSINATURA_DEFAULTS[String(doCadastro).toLowerCase()]) {
    return String(doCadastro).toLowerCase();
  }
  const explicita = (regras.classificacaoPrograma || {})[base];
  if (explicita && ASSINATURA_DEFAULTS[explicita]) return explicita;
  if (splitKeywords(regras.vhAssinaturaInfantilKeywords).some((k) => base.includes(k))) return 'infantil';
  if (splitKeywords(regras.vhAssinaturaAdultoKeywords).some((k) => base.includes(k))) return 'adulto';
  return 'jovem';
}

/** Objeto da VH de assinatura para o programa (ou null se desativada). */
export function pickAssinatura(descricao, regras = {}, catalogo = {}) {
  const faixa = resolveFaixa(descricao, regras, catalogo);
  const def = ASSINATURA_DEFAULTS[faixa];
  const cfg = regras[def.key] || {};
  if (cfg.ativo === false) return null;
  if (!Object.prototype.hasOwnProperty.call(regras, def.key)) return null;
  return {
    code: cfg.code || def.code,
    descricao: cfg.descricao || def.descricao,
    tempo: cfg.tempo || '00:00:05',
    midia: '0OMN',
    type: 'EVNH',
    _faixa: faixa,
  };
}

/**
 * Injeta as peças fixas cadastradas nas posições configuradas.
 * posicao: 'inicio' | 'fim' | 'antes_programa' | 'apos_assinatura'
 */
export function injectPecasFixas(roteiro, fixas = []) {
  const ativas = (fixas || []).filter((f) => f && f.ativo !== false);
  if (!ativas.length) return roteiro.slice();

  const at = (pos) => ativas.filter((f) => f.posicao === pos).map((f) => ({ ...f, _fixa: true }));
  const out = [];

  for (const item of roteiro) {
    if (item.type === 'RPRO' && !/BL\s*0[2-5]/i.test(item.descricao || '')) out.push(...at('antes_programa'));
    out.push(item);
    if (item.type === 'EVNH' && /^ASSINATURA_/i.test(normalizeKey(item.descricao))) out.push(...at('apos_assinatura'));
  }

  return [...at('inicio'), ...out, ...at('fim')];
}

/** Calcula IN/OUT acumulados a partir do horário de início do roteiro. */
export function computeTimeline(roteiro, inicioSec = START_SECONDS_DEFAULT) {
  let cum = inicioSec;
  return roteiro.map((item) => {
    const dur = timeToSec(item.tempo);
    const withTimes = { ...item, IN: secToTime(cum), OUT: secToTime(cum + dur) };
    cum += dur;
    return withTimes;
  });
}

/**
 * Gera o roteiro completo a partir da lista de programas.
 *
 * @param {Array}  programs  blocos de programa em ordem de exibição
 * @param {Object} regras    REGRAS de negócio (VHs, início, etc.)
 * @param {Object} grade     grade do dia { 'TITULO': 'HH:MM:SS' }
 * @param {Array}  fixas     peças fixas ([{code,...,posicao}])
 * @param {Object} opts      { pecas, programas, ref, inicioSec, withTimes }
 * @returns {Array} itens do roteiro
 */
export function buildRoteiroFromPrograms(programs, regras = {}, grade = {}, fixas = [], opts = {}) {
  const catalogo = catalogFromCadastro({
    pecas: opts.pecas || [],
    programas: opts.programas || [],
    ref: opts.ref || new Date(),
  });
  const inicioSec = opts.inicioSec ?? regras.inicioRoteiro ?? START_SECONDS_DEFAULT;
  const fixasEfetivas = (fixas && fixas.length ? fixas : catalogo.fixas) || [];
  const usarFixas = regras.injetarFixas !== false;

  const roteiro = [];
  let cumSec = inicioSec;
  const occurrence = {};

  let i = 0;
  while (i < (programs || []).length) {
    const prog = programs[i];
    const baseTitle = baseProgramTitle(prog.descricao);

    const n = occurrence[baseTitle] || 0;
    occurrence[baseTitle] = n + 1;
    const ordinal = n + 1;
    const gradeKey = ordinal === 1 ? baseTitle : `${baseTitle} [${ordinal}ª]`;

    // ── Ancoragem na grade: injeta AJUSTE PARA GRADE quando sobra tempo ──
    const expected = (grade || {})[gradeKey];
    if (expected) {
      let expectedSec = timeToSec(expected);
      if (expectedSec < inicioSec) expectedSec += 86400;
      if (expectedSec > cumSec) {
        roteiro.push({
          ...slot('__GAP__', `[ AJUSTE PARA GRADE — Aguardando ${gradeKey} às ${expected} ]`, '_gap'),
          tempo: secToTime(expectedSec - cumSec),
        });
        cumSec = expectedSec;
      }
    }

    // Agrupa os blocos do mesmo programa
    const blocks = [prog];
    let j = i + 1;
    while (j < programs.length && baseProgramTitle(programs[j].descricao) === baseTitle) {
      blocks.push(programs[j]);
      j++;
    }

    // VH A SEGUIR antes do 1º bloco
    if (regras.vhSeguirAtivo !== false) {
      const vhSeguir = findVh(catalogo.vhSeguirMap.length ? catalogo.vhSeguirMap : opts.vhSeguirMap, prog.descricao);
      if (vhSeguir) {
        roteiro.push({ ...vhSeguir });
        cumSec += timeToSec(vhSeguir.tempo);
      }
    }

    blocks.forEach((block, bIdx) => {
      if (!/BL\s*0[2-5]/i.test(block.descricao || '')) {
        const vhClassif = getVhClassificacao(regras, catalogo);
        if (vhClassif) {
          roteiro.push({ ...vhClassif });
          cumSec += timeToSec(vhClassif.tempo);
        }
      }

      roteiro.push({ ...block });
      cumSec += timeToSec(block.tempo);

      const isLast = bIdx === blocks.length - 1;
      if (!isLast) {
        const next = blocks[bIdx + 1];
        const sameEpisode = getEpisodeId(block.descricao) === getEpisodeId(next.descricao);
        const vhAss =
          regras.vhAssistindoAtivo === false || !sameEpisode
            ? null
            : findVh(catalogo.vhAssistindoMap.length ? catalogo.vhAssistindoMap : opts.vhAssistindoMap, block.descricao);

        if (vhAss) {
          roteiro.push({ ...vhAss });
          cumSec += timeToSec(vhAss.tempo);
        }
        const slots = Math.max(1, regras.breakSlotsPorBloco ?? 2);
        const rotulos = ['[ BREAK — chamada ]', '[ BREAK — interprograma ]'];
        for (let s = 0; s < slots; s++) {
          roteiro.push(slot('__BREAK__', rotulos[s] || `[ BREAK — ${s + 1} ]`, '_break'));
        }
        if (vhAss) {
          roteiro.push({ ...vhAss });
          cumSec += timeToSec(vhAss.tempo);
        }
      } else {
        const ass = pickAssinatura(block.descricao, regras, catalogo);
        if (ass) {
          roteiro.push(ass);
          cumSec += timeToSec(ass.tempo);
        }
      }
    });

    i = j;
  }

  const comFixas = usarFixas ? injectPecasFixas(roteiro, fixasEfetivas) : roteiro;
  return opts.withTimes ? computeTimeline(comFixas, inicioSec) : comFixas;
}

export default buildRoteiroFromPrograms;

// src/core/pecasCatalog.js
// Ponte entre o CADASTRO (Peças e Programas) e a CONFECÇÃO DE ROTEIROS.
// Tudo que o builder precisa saber sobre o banco cadastrado é derivado aqui.

import { normalizeKey, hhmmToSec, timeToSec } from './normalize.js';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

/** Prefixos que identificam o papel de uma vinheta cadastrada. */
const VH_PREFIXES = {
  seguir: 'VH A SEGUIR',
  assistindo: 'VH VC ESTA ASSISTINDO',
  daquiAPouco: 'VH DAQUI A POUCO',
  classificacao: 'VH CLASSIFICACAO',
};

/** Normaliza um registro do cadastro para o formato consumido pelo roteiro. */
export function toRoteiroItem(peca) {
  return {
    code: String(peca.code || ''),
    descricao: peca.descricao || '',
    tempo: peca.tempo || '00:00:00',
    midia: peca.midia || '0OMN',
    type: peca.type || 'EVNH',
  };
}

/**
 * A peça está vigente na data de referência?
 * Sem validade cadastrada => sempre vigente.
 */
export function isPecaVigente(peca, ref = new Date()) {
  if (!peca || !peca.validade) return true;
  const d = new Date(`${peca.validade}T23:59:59`);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() >= ref.getTime();
}

/** A peça pode ir ao ar neste dia da semana (0=dom)? */
export function isPecaDoDia(peca, dow) {
  const dias = peca?.dias || [];
  if (!dias.length) return true;
  return dias.map((d) => String(d).toLowerCase()).includes(DIAS[dow]);
}

/** A peça pode ir ao ar neste segundo do dia (janela hIni–hFim do cadastro)? */
export function isPecaNaJanela(peca, sec) {
  if (sec == null) return true;
  const ini = hhmmToSec(peca?.hIni);
  const fim = hhmmToSec(peca?.hFim);
  if (ini == null && fim == null) return true;
  const s = ((sec % 86400) + 86400) % 86400;
  if (ini != null && fim != null) {
    // Janela com fim < início atravessa a madrugada.
    return ini <= fim ? s >= ini && s <= fim : s >= ini || s <= fim;
  }
  if (ini != null) return s >= ini;
  return s <= fim;
}

/**
 * Peças elegíveis para um dia/horário/categoria — é o que a tela de roteiro
 * oferece ao operador e o que a geração automática pode inserir.
 */
export function selectPecasDoDia(pecas, { dow = new Date().getDay(), sec = null, categoria = null, type = null, ref = new Date() } = {}) {
  return (pecas || []).filter((p) => {
    if (!p || p.ativo === false) return false;
    if (categoria && p.categoria !== categoria) return false;
    if (type && p.type !== type) return false;
    return isPecaVigente(p, ref) && isPecaDoDia(p, dow) && isPecaNaJanela(p, sec);
  });
}

function vhRole(descricao) {
  const u = normalizeKey(descricao);
  for (const [role, prefix] of Object.entries(VH_PREFIXES)) {
    if (u.startsWith(prefix)) return { role, keyword: u.slice(prefix.length).trim() };
  }
  return null;
}

/**
 * Monta os mapas de vinhetas a partir das peças cadastradas.
 * Cada VH cadastrada como "VH A SEGUIR <PROGRAMA>" passa a valer
 * automaticamente para o programa <PROGRAMA> na geração do roteiro.
 */
export function buildVhMaps(pecas, ref = new Date()) {
  const maps = { seguir: [], assistindo: [], daquiAPouco: [], classificacao: null };
  for (const p of pecas || []) {
    if (!p || p.ativo === false || !isPecaVigente(p, ref)) continue;
    const info = vhRole(p.descricao);
    if (!info) continue;
    const item = toRoteiroItem(p);
    if (info.role === 'classificacao') {
      if (!maps.classificacao) maps.classificacao = item;
      continue;
    }
    if (!info.keyword) continue;
    maps[info.role].push({ ...item, keywords: [info.keyword] });
  }
  return maps;
}

/** Peças marcadas como fixas no cadastro, na ordem configurada. */
export function pecasFixasFromCadastro(pecas, ref = new Date()) {
  return (pecas || [])
    .filter((p) => p && p.posicao && p.ativo !== false && isPecaVigente(p, ref))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((p) => ({ ...toRoteiroItem(p), posicao: p.posicao, ativo: true }));
}

/** Duração total (segundos) de uma lista de peças/itens. */
export function somaTempo(itens) {
  return (itens || []).reduce((acc, it) => acc + timeToSec(it?.tempo), 0);
}

// =====================================================
// VH "DAQUI A POUCO" — casamento com o próximo programa
// Extraído para função pura/testável e reutilizado por
// pecas_dia.js (cópia não-modular, ver comentário lá).
// =====================================================

/** Palavras curtas/estruturais que não ajudam a identificar o programa. */
const VH_STOP_WORDS = new Set([
  'PARA', 'COMO', 'MAIS', 'PELO', 'PELA', 'NUMA', 'COM', 'DOS', 'DAS', 'NOS', 'NAS',
  'DAQUI', 'POUCO', 'PGM', 'SEGUIR', 'ASSISTINDO', 'ESTA', 'VOCE',
]);

/** Remove acentos e pontuação, colapsa espaços, MAIÚSCULAS. */
function normalizeForMatch(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/gi, ' ') // pontuação -> espaço (evita "DAQUI," não casar)
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Palavras significativas (≥4 chars, fora da stop list) de um título já normalizado. */
function significantWords(normalized) {
  return normalized.split(' ').filter((w) => w.length >= 4 && !VH_STOP_WORDS.has(w));
}

/**
 * Escolhe, dentre as VHs "DAQUI A POUCO" cadastradas, a que melhor casa com o
 * título do próximo programa — nunca a primeira que compartilhar uma palavra
 * qualquer. Primeiro tenta resolver direto por `funcao`/`programaRelacionado`
 * (Fase 2 do MVP de cadastro); sem isso preenchido, cai no casamento por
 * cobertura de palavras significativas do programa (todas, ou ao menos
 * `minCoverage`, o que for menor) e desempata pela maior cobertura; sem VH
 * suficientemente boa, ou em empate real, não insere nada (comportamento
 * conservador — melhor pular do que inserir a VH errada).
 *
 * @param {string} nextProgramTitle título do próximo programa (idealmente já passado por baseProgramTitle)
 * @param {Array<{descricao:string, funcao?:string, programaRelacionado?:string, ativo?:boolean}>} vhCandidates peças EVNH cujo texto contém "DAQUI A POUCO"
 * @param {number} minCoverage fração mínima de cobertura exigida (default 0.7)
 * @returns {object|null} a melhor VH candidata, ou null
 */
export function matchVhDaquiForNext(nextProgramTitle, vhCandidates, minCoverage = 0.7) {
  if (!nextProgramTitle || !vhCandidates || !vhCandidates.length) return null;

  const normTitle = normalizeForMatch(nextProgramTitle);

  // Passo 0 (Fase 2 do MVP de cadastro, ver PROMPT-FASE-2-MOTOR-DISTRIBUICAO.md):
  // peça cadastrada com funcao='vh_daqui_a_pouco' e programaRelacionado
  // batendo exatamente com o próximo programa tem prioridade sobre o
  // casamento por cobertura de palavras abaixo — que continua sendo o
  // fallback para peças sem os campos novos preenchidos.
  const doCadastro = vhCandidates.find((vh) =>
    vh.funcao === 'vh_daqui_a_pouco' && vh.ativo !== false &&
    vh.programaRelacionado && normalizeForMatch(vh.programaRelacionado) === normTitle
  );
  if (doCadastro) return doCadastro;

  const keywords = significantWords(normTitle);
  if (!keywords.length) return null;

  let best = null;
  let bestScore = 0;
  let tie = false;

  for (const vh of vhCandidates) {
    // Remove o prefixo completo "VH DAQUI A POUCO" (regex ancorada no início,
    // não um replace de substring — assim "DAQUI"/"POUCO" do próprio rótulo
    // não voltam a participar do casamento).
    const vhProg = normalizeForMatch(vh.descricao).replace(/^VH\s+DAQUI\s+A\s+POUCO\s*/, '').trim();
    if (!vhProg) continue;
    const vhWords = new Set(vhProg.split(' '));
    const hits = keywords.filter((kw) => vhWords.has(kw)).length;
    const coverage = hits / keywords.length;
    const required = Math.min(minCoverage, keywords.length === 1 ? 1 : minCoverage);
    if (coverage < required) continue;

    if (coverage > bestScore) {
      best = vh;
      bestScore = coverage;
      tie = false;
    } else if (coverage === bestScore) {
      tie = true;
    }
  }

  if (!best || tie) return null; // sem VH suficientemente boa, ou empate real -> não insere
  return best;
}

/**
 * Catálogo completo derivado do cadastro — entrada única do builder.
 * @param {{pecas?:Array, programas?:Array, ref?:Date}} arg
 */
export function catalogFromCadastro({ pecas = [], programas = [], ref = new Date() } = {}) {
  const vh = buildVhMaps(pecas, ref);
  return {
    vhSeguirMap: vh.seguir,
    vhAssistindoMap: vh.assistindo,
    vhDaquiAPoucoMap: vh.daquiAPouco,
    vhClassificacao: vh.classificacao,
    fixas: pecasFixasFromCadastro(pecas, ref),
    programas: (programas || []).filter((p) => p && p.ativo !== false),
    pecas: (pecas || []).filter((p) => p && p.ativo !== false),
  };
}

// =====================================================
// IDENTIDADE ESTRUTURADA DO PROGRAMA (MVP-CADASTRO.md, Fase 1)
// Extraídas de app.js (onde já existiam, sem cobertura de teste) —
// nenhuma mudança de comportamento, só passaram a ter testes e a poder
// ser reaproveitadas de forma idêntica em pecas-programas.js. app.js
// mantém sua própria cópia (réplica não-modular, mesmo padrão do resto
// do projeto); qualquer ajuste de regra deve ser replicado nos dois
// lugares — estes testes (pecasCatalog.test.js) são a referência.
// =====================================================

/** Remove sufixos de bloco/temporada/episódio/observações da descrição para obter o título base do programa (ex.: "PGM PALALOOS - T01 EP03 - BL02" -> "PALALOOS"). Usado na comparação com a grade semanal e, na Fase 2, no casamento de VHs pelo `programa_relacionado`. */
export function baseProgramTitle(desc) {
  return String(desc || '')
    .replace(/^\s*PGM\s+/i, '')                    // remove prefixo "PGM " no início
    .replace(/\s*-\s*T\s*\d+\s*EP\s*\d+.*$/i, '')   // remove " - T 01 EP 03 - ..." até o fim
    .replace(/\s*T\d+\s*EP\s*\d+.*$/i, '')          // variante sem hífen antes de "T01 EP16"
    .replace(/\s*-\s*BL\s*\d+\s*$/i, '')            // remove " - BL 01"
    .replace(/\s*BL\s*\d+\s*$/i, '')                // remove " BL01" ou " BL 01"
    .replace(/\s*\(.*?\)\s*$/, '')                  // remove parênteses no final (ex: "(reprise quarta 22h)")
    .replace(/\s*\d+'\s*$/, '')                     // remove sufixo de minutagem da grade, ex: " 10'"
    .trim();
}

/** Extrai o identificador combinado do episódio (ex.: "T01EP01") para agrupar blocos do mesmo episódio. */
export function getEpisodeId(desc) {
  if (!desc) return '';
  const m = String(desc).toUpperCase().match(/T\s*\d+\s*EP\s*\d+|EP\s*\d+/);
  return m ? m[0].replace(/\s+/g, '') : '';
}

/**
 * Extrai temporada/episódio/bloco como números separados (para gravar nos
 * campos estruturados `programas.temporada/episodio/bloco` — ver
 * db/007_funcao_peca.sql). Qualquer parte não encontrada vem `null`, não
 * `0` — "não informado" é diferente de "zero".
 */
export function parseEpisodioInfo(desc) {
  const s = String(desc || '').toUpperCase();
  const mTE = s.match(/T\s*(\d+)\s*EP\s*(\d+)/);
  const mBL = s.match(/BL\s*(\d+)/);
  return {
    temporada: mTE ? Number(mTE[1]) : null,
    episodio: mTE ? Number(mTE[2]) : null,
    bloco: mBL ? Number(mBL[1]) : null,
  };
}


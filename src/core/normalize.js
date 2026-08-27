// src/core/normalize.js
// Helpers puros de texto/tempo compartilhados pelo cadastro (Peças e Programas)
// e pela confecção de roteiros. Sem dependência de DOM — testável em Node.

/** Remove acentos, colapsa espaços e devolve em MAIÚSCULAS. */
export function normalizeKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Título base do programa: remove prefixo PGM, temporada/episódio, bloco, parênteses e minutagem. */
export function baseProgramTitle(desc) {
  return String(desc || '')
    .replace(/^\s*PGM\s+/i, '')
    .replace(/\s*-\s*T\s*\d+\s*EP\s*\d+.*$/i, '')
    .replace(/\s*T\d+\s*EP\s*\d+.*$/i, '')
    .replace(/\s*-\s*BL\s*\d+\s*$/i, '')
    .replace(/\s*BL\s*\d+\s*$/i, '')
    .replace(/\s*\(.*?\)\s*$/, '')
    .replace(/\s*\d+'\s*$/, '')
    .trim();
}

/** Identificador do episódio (T01EP03 / EP03) usado para agrupar blocos. */
export function getEpisodeId(desc) {
  if (!desc) return '';
  const m = String(desc).toUpperCase().match(/T\s*\d+\s*EP\s*\d+|EP\s*\d+/);
  return m ? m[0].replace(/\s+/g, '') : '';
}

/** "HH:MM:SS" | "MM:SS" -> segundos. */
export function timeToSec(t) {
  if (!t) return 0;
  const parts = String(t).split(':').map(Number);
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  return 0;
}

/** segundos -> "HH:MM:SS" (com wrap de 24h, pois o roteiro cruza a madrugada). */
export function secToTime(sec) {
  const s = ((Math.round(sec) % 86400) + 86400) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return [h, m, ss].map((n) => String(n).padStart(2, '0')).join(':');
}

/** "HH:MM" -> segundos (campos hIni/hFim do cadastro). */
export function hhmmToSec(s) {
  if (!s) return null;
  const [h, m] = String(s).split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return (h || 0) * 3600 + (m || 0) * 60;
}

// =====================================================
// VALIDADE (kill date) — formato único
// O cadastro (Peças e Programas) grava sempre AAAA-MM-DD
// (formato nativo de <input type="date">). O import de Excel
// de "peças do dia" grava DD/MM/AA. Este é o único ponto que
// entende os dois formatos + serial de data do Excel, para que
// `isExpired`/comparações no Roteiro nunca dependam de qual
// tela originou o dado.
//
// Réplica não-modular: como app.js e pecas_dia.js são carregados
// como <script> clássico (sem `import`), eles mantêm uma cópia
// funcionalmente idêntica destas três funções. Qualquer ajuste de
// regra feito aqui deve ser replicado lá também — os testes deste
// arquivo (normalize.test.js) são a referência de comportamento.
// =====================================================

/** Serial de data do Excel (dias desde 1899-12-30) -> Date (meio-dia local, evita drift de fuso). */
function excelSerialToDate(n) {
  const utcDays = Math.round(n) - 25569; // 25569 = dias entre 1899-12-30 e 1970-01-01
  const utcMs = utcDays * 86400 * 1000;
  const d = new Date(utcMs);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
}

/**
 * Interpreta uma validade em qualquer formato aceito pelo sistema:
 *   - AAAA-MM-DD (input[type=date] do cadastro, coluna `date` do banco)
 *   - DD/MM/AAAA ou DD/MM/AA (import legado de Excel / digitação manual)
 *   - serial numérico de data do Excel
 * Devolve um Date (meio-dia local) ou null se a entrada estiver vazia
 * ou não for reconhecida.
 */
export function parseValidade(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v) && v >= 1000) {
    const d = excelSerialToDate(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (!s || s === 'None') return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // AAAA-MM-DD
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); // DD/MM/AAAA ou DD/MM/AA
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, Number(m[2]) - 1, Number(m[1]), 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/** Forma canônica AAAA-MM-DD, para armazenamento/comparação. '' se não reconhecida/vazia. */
export function validadeToISO(v) {
  const d = parseValidade(v);
  if (!d) return '';
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** DD/MM/AAAA, só para exibição/exportação. '' se não reconhecida/vazia. */
export function formatValidade(v) {
  const d = parseValidade(v);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  return `${dd}/${mm}/${yyyy}`;
}

/** A validade (qualquer formato aceito) já passou em relação a `ref` (default: agora)? */
export function isValidadeExpired(v, ref = new Date()) {
  const d = parseValidade(v);
  if (!d) return false;
  const fimDoDia = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return fimDoDia.getTime() < ref.getTime();
}

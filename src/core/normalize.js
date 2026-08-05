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

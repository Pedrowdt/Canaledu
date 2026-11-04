// src/core/gradeEditorCore.js
// Lógica pura de confecção e manipulação de grade em blocos de 30 minutos.
// Suporta modularidade (ESM / CommonJS / Browser Global).

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GradeEditorCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const START_SECONDS = 6 * 3600; // 06:00:00
  const DEFAULT_INTERVAL_MIN = 30; // 30 minutos
  const DEFAULT_DURATION_SEC = DEFAULT_INTERVAL_MIN * 60; // 1800s
  const TOTAL_DAY_SEC = 24 * 3600; // 86400s

  function timeToSec(t) {
    if (!t) return 0;
    const parts = String(t).trim().split(/[:;]/).map(Number);
    if (parts.length >= 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    if (parts.length === 2) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60;
    return 0;
  }

  function secToTime(s) {
    if (!Number.isFinite(s)) s = 0;
    s = Math.max(0, Math.floor(s));
    const total = s % TOTAL_DAY_SEC;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function addSeconds(timeStr, seconds) {
    const s = timeToSec(timeStr) + seconds;
    return secToTime(s);
  }

  /**
   * Converte horário linear em segundos relativos ao início do dia da emissora (06:00:00).
   * Horários entre 00:00 e 05:59 contam como +86400 (madrugada do dia seguinte).
   */
  function gradeSeconds(t) {
    const sec = timeToSec(t);
    return sec < START_SECONDS ? sec + TOTAL_DAY_SEC : sec;
  }

  /**
   * Gera os 48 blocos base de 30 minutos a partir das 06:00:00 até 05:30:00.
   */
  function generateBaseSlots(startHour = 6, intervalMinutes = 30) {
    const slots = [];
    const intervalSec = intervalMinutes * 60;
    const totalSlots = Math.floor(TOTAL_DAY_SEC / intervalSec);
    let curSec = startHour * 3600;

    for (let i = 0; i < totalSlots; i++) {
      const timeStr = secToTime(curSec);
      const endStr = secToTime(curSec + intervalSec);
      slots.push({
        id: `slot_${i}_${timeStr.replace(/:/g, '')}`,
        index: i,
        time: timeStr,
        duration: secToTime(intervalSec),
        durationSec: intervalSec,
        endTime: endStr,
        program: null,
      });
      curSec = (curSec + intervalSec) % TOTAL_DAY_SEC;
    }
    return slots;
  }

  /**
   * Ajusta a duração de um bloco e opcionalmente recalcula os horários subsequentes em cascata.
   */
  function adjustBlockDuration(blocks, blockIndex, newDurationSec, options = {}) {
    if (!Array.isArray(blocks) || blockIndex < 0 || blockIndex >= blocks.length) return blocks;
    const cascade = options.cascade !== false;
    const cloned = blocks.map(b => ({ ...b, program: b.program ? { ...b.program } : null }));

    const dur = Math.max(60, Math.floor(newDurationSec)); // mínimo 1 minuto
    cloned[blockIndex].durationSec = dur;
    cloned[blockIndex].duration = secToTime(dur);

    const startSec = timeToSec(cloned[blockIndex].time);
    cloned[blockIndex].endTime = secToTime(startSec + dur);

    if (cascade) {
      let nextStartSec = startSec + dur;
      for (let i = blockIndex + 1; i < cloned.length; i++) {
        cloned[i].time = secToTime(nextStartSec);
        const bDur = cloned[i].durationSec || DEFAULT_DURATION_SEC;
        cloned[i].durationSec = bDur;
        cloned[i].duration = secToTime(bDur);
        cloned[i].endTime = secToTime(nextStartSec + bDur);
        nextStartSec += bDur;
      }
    }
    return cloned;
  }

  /**
   * Atribui um programa a um slot especificado.
   */
  function assignProgramToSlot(blocks, blockIndex, programData, options = {}) {
    if (!Array.isArray(blocks) || blockIndex < 0 || blockIndex >= blocks.length) return blocks;
    const cloned = blocks.map(b => ({ ...b, program: b.program ? { ...b.program } : null }));
    const slot = cloned[blockIndex];

    const progDurationSec = programData.tempo ? timeToSec(programData.tempo) : 0;
    const adoptDuration = options.adoptDuration !== false && progDurationSec >= 300; // >= 5 min

    slot.program = {
      title: programData.title || programData.nome || programData.descricao || 'SEM TÍTULO',
      code: programData.code || '',
      tempo: programData.tempo || slot.duration,
      categoria: programData.categoria || '',
      cor: programData.cor || null,
    };

    if (adoptDuration) {
      return adjustBlockDuration(cloned, blockIndex, progDurationSec, { cascade: options.cascade !== false });
    }

    return cloned;
  }

  /**
   * Remove programa de um slot.
   */
  function removeProgramFromSlot(blocks, blockIndex) {
    if (!Array.isArray(blocks) || blockIndex < 0 || blockIndex >= blocks.length) return blocks;
    const cloned = blocks.map(b => ({ ...b, program: b.program ? { ...b.program } : null }));
    cloned[blockIndex].program = null;
    return cloned;
  }

  /**
   * Detecta intervalos vazios (buracos) e sobreposições na grade.
   */
  function detectGapsAndOverlaps(blocks) {
    const issues = [];
    if (!Array.isArray(blocks) || blocks.length < 2) return issues;

    for (let i = 0; i < blocks.length - 1; i++) {
      const cur = blocks[i];
      const next = blocks[i + 1];
      const curEndSec = gradeSeconds(cur.endTime);
      const nextStartSec = gradeSeconds(next.time);

      if (curEndSec > nextStartSec) {
        issues.push({
          type: 'overlap',
          index: i,
          nextIndex: i + 1,
          time: cur.time,
          diffSec: curEndSec - nextStartSec,
          message: `Sobreposição de ${Math.round((curEndSec - nextStartSec) / 60)} min entre "${cur.program?.title || cur.time}" e "${next.program?.title || next.time}"`,
        });
      } else if (curEndSec < nextStartSec) {
        issues.push({
          type: 'gap',
          index: i,
          nextIndex: i + 1,
          time: cur.endTime,
          diffSec: nextStartSec - curEndSec,
          message: `Buraco de ${Math.round((nextStartSec - curEndSec) / 60)} min entre ${cur.endTime} e ${next.time}`,
        });
      }
    }
    return issues;
  }

  /**
   * Converte a lista de blocos para o formato oficial gradeByDay e gradeOrderByDay
   * com sufixos [2ª], [3ª] para programas repetidos.
   */
  function blocksToGrade(blocks) {
    const grade = {};
    const order = [];
    const occurrences = {};

    blocks.forEach(b => {
      if (!b.program || !b.program.title) return;
      const baseTitle = b.program.title.replace(/\s*\[\d+ª\]$/, '').trim();
      occurrences[baseTitle] = (occurrences[baseTitle] || 0) + 1;
      const occNum = occurrences[baseTitle];
      const finalTitle = occNum === 1 ? baseTitle : `${baseTitle} [${occNum}ª]`;

      grade[finalTitle] = b.time;
      order.push(finalTitle);
    });

    return { grade, order };
  }

  /**
   * Reconstitui os blocos a partir de gradeByDay / gradeOrderByDay salvos.
   */
  function gradeToBlocks(gradeObj = {}, orderList = [], programCatalog = []) {
    const baseSlots = generateBaseSlots(6, 30);
    const catalogMap = new Map();
    (programCatalog || []).forEach(p => {
      const codeOrTitle = (p.code || p.title || p.nome || p.descricao || '').toUpperCase().trim();
      if (codeOrTitle) catalogMap.set(codeOrTitle, p);
      if (p.descricao) catalogMap.set(p.descricao.toUpperCase().trim(), p);
    });

    const entries = [];
    const seenTitles = new Set();

    (orderList || []).forEach(title => {
      if (!title || seenTitles.has(title)) return;
      seenTitles.add(title);
      const time = gradeObj[title];
      if (time) entries.push({ title, time });
    });

    Object.entries(gradeObj || {}).forEach(([title, time]) => {
      if (!seenTitles.has(title) && !title.startsWith('_' /* meta */)) {
        seenTitles.add(title);
        entries.push({ title, time });
      }
    });

    // Ordena pelo horário da emissora (06:00 -> 05:59)
    entries.sort((a, b) => gradeSeconds(a.time) - gradeSeconds(b.time));

    if (entries.length === 0) return baseSlots;

    // Se temos itens com horário, mapeamos para os blocos
    const resultBlocks = [];
    for (let i = 0; i < entries.length; i++) {
      const cur = entries[i];
      const next = entries[i + 1];
      const startTime = cur.time;
      let durationSec = DEFAULT_DURATION_SEC;

      if (next) {
        const diff = gradeSeconds(next.time) - gradeSeconds(cur.time);
        if (diff > 0 && diff <= 14400) { // até 4 horas
          durationSec = diff;
        }
      }

      const cleanTitle = cur.title.replace(/\s*\[\d+ª\]$/, '').trim();
      const meta = catalogMap.get(cleanTitle.toUpperCase()) || {};

      resultBlocks.push({
        id: `slot_${i}_${startTime.replace(/:/g, '')}`,
        index: i,
        time: startTime,
        duration: secToTime(durationSec),
        durationSec: durationSec,
        endTime: addSeconds(startTime, durationSec),
        program: {
          title: cur.title,
          code: meta.code || '',
          tempo: meta.tempo || secToTime(durationSec),
          categoria: meta.categoria || meta.faixa || '',
        },
      });
    }

    return resultBlocks;
  }

  return {
    START_SECONDS,
    DEFAULT_INTERVAL_MIN,
    DEFAULT_DURATION_SEC,
    timeToSec,
    secToTime,
    addSeconds,
    gradeSeconds,
    generateBaseSlots,
    adjustBlockDuration,
    assignProgramToSlot,
    removeProgramFromSlot,
    detectGapsAndOverlaps,
    blocksToGrade,
    gradeToBlocks,
  };
});

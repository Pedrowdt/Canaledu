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

    const faixaOcupada = (programData.faixaOcupada || programData.faixa_ocupada || '').trim();

    slot.program = {
      title: programData.title || programData.nome || programData.descricao || 'SEM TÍTULO',
      code: programData.code || '',
      tempo: programData.tempo || slot.duration,
      categoria: programData.categoria || '',
      cor: programData.cor || null,
      type: programData.type || '',
      faixaOcupada: faixaOcupada,
      faixaNome: faixaOcupada || slot.program?.faixaNome || '',
      programaTitulo: programData.programaTitulo || programData.programa_titulo || '',
      temporada: programData.temporada ?? null,
      episodio: programData.episodio ?? null,
      bloco: programData.bloco ?? null,
    };

    if (faixaOcupada) {
      slot.faixaNome = faixaOcupada;
    }

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
  function normalizarTituloGrade(valor) {
    if (typeof GradeRoteiroSyncCore !== 'undefined' && typeof GradeRoteiroSyncCore.normalizarTituloCatalogo === 'function') {
      return GradeRoteiroSyncCore.normalizarTituloCatalogo(valor);
    }
    if (!valor) return '';
    let s = String(valor)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase();

    s = s.replace(/&/g, ' E ');
    s = s.replace(/^\s*(?:PGM|PROGRAMA|INTPGM|INTERPROGRAMA|RPRO|GPRO|IPRO)(?:\s*[-–—:]\s*|\s+)/i, '');
    s = s.replace(/\s*-?\s*T\s*\d+\s*EP\s*\d+.*$/i, '');
    s = s.replace(/\s*-?\s*EP\s*\d+.*$/i, '');
    s = s.replace(/\s*-?\s*BL\s*0*\d+.*$/i, '');
    s = s.replace(/\s*\[\s*\d+\s*[ªaº°]?\s*\]/gi, '');
    s = s.replace(/\s*\[[^\]]*\]/g, '');
    s = s.replace(/\s*\(REPRISE\)/gi, '');
    s = s.replace(/\s*\([^)]*\)\s*$/g, '');
    s = s.replace(/\s*\d+\s*['’]\s*/g, ' ');
    s = s.replace(/_\d+/g, ' ');

    const semCanal = s.replace(/\s*[-–—:]?\s*(?:CANAL\s+EDUCACAO|TV\s+BRASIL|CANAL\s+GOV).*$/i, '');
    if (semCanal.trim()) s = semCanal;

    s = s.replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    const CONECTIVOS = new Set(['E', 'DE', 'DA', 'DO', 'DAS', 'DOS']);
    const palavras = s.split(' ').filter(p => p && !CONECTIVOS.has(p));
    if (palavras.length > 0) {
      s = palavras.join(' ');
    }
    return s;
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
      // Indexa também pelo título canônico normalizado
      const tit = p.programaTitulo || p.programa_titulo || p.title || p.nome || p.descricao || '';
      const kTit = normalizarTituloGrade(tit);
      if (kTit && !catalogMap.has(kTit)) catalogMap.set(kTit, p);
      if (p.descricao) {
        const kDesc = normalizarTituloGrade(p.descricao);
        if (kDesc && !catalogMap.has(kDesc)) catalogMap.set(kDesc, p);
      }
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
      const normClean = normalizarTituloGrade(cleanTitle);
      const meta = catalogMap.get(cleanTitle.toUpperCase()) || (normClean ? catalogMap.get(normClean) : null) || {};
      const faixaOcupada = (meta.faixaOcupada || meta.faixa_ocupada || meta.faixa || '').trim();

      resultBlocks.push({
        id: `slot_${i}_${startTime.replace(/:/g, '')}`,
        index: i,
        time: startTime,
        duration: secToTime(durationSec),
        durationSec: durationSec,
        endTime: addSeconds(startTime, durationSec),
        faixaNome: faixaOcupada || undefined,
        program: {
          title: cur.title,
          code: meta.code || '',
          tempo: meta.tempo || secToTime(durationSec),
          categoria: meta.categoria || meta.faixa || '',
          cor: meta.cor || null,
          type: meta.type || '',
          faixaOcupada: faixaOcupada,
          faixaNome: faixaOcupada,
          programaTitulo: meta.programaTitulo || meta.programa_titulo || '',
          temporada: meta.temporada ?? null,
          episodio: meta.episodio ?? null,
          bloco: meta.bloco ?? null,
        },
      });
    }

    return resultBlocks;
  }

  function moveOrSwapSlot(blocksByDay, fromDow, fromSlotIdx, toDow, toSlotIdx, options = {}) {
    const copy = { ...blocksByDay };
    const sourceBlocks = (copy[fromDow] || []).map(b => ({ ...b, program: b.program ? { ...b.program } : null }));
    const targetBlocks = fromDow === toDow ? sourceBlocks : (copy[toDow] || []).map(b => ({ ...b, program: b.program ? { ...b.program } : null }));

    const sourceSlot = sourceBlocks[fromSlotIdx];
    const targetSlot = targetBlocks[toSlotIdx];
    if (!sourceSlot || !targetSlot) return blocksByDay;

    const sourceProg = sourceSlot.program;
    const targetProg = targetSlot.program;

    if (options.copyOnly) {
      targetSlot.program = sourceProg ? { ...sourceProg } : null;
    } else {
      targetSlot.program = sourceProg ? { ...sourceProg } : null;
      sourceSlot.program = targetProg ? { ...targetProg } : null;
    }

    copy[fromDow] = sourceBlocks;
    copy[toDow] = targetBlocks;
    return copy;
  }

  /**
   * Constrói uma tabela consolidada da semana toda para renderização matricial e exportação em PDF.
   */
  /**
   * Calcula estatísticas consolidadas e resumo executivo da semana para a grade e exportação de relatórios/PDF.
   */
  function calcularResumoExecutivoGrade(blocksByDay, options = {}) {
    const days = [1, 2, 3, 4, 5, 6, 0];
    let totalSlots = 0;
    let totalIneditos = 0;
    let totalReprises = 0;
    let totalFixos = 0;
    let reprisesVinculadas = 0;
    let ineditosComEpisodio = 0;
    let reprisesComEpisodio = 0;
    let totalComEpisodio = 0;
    let totalSegundos = 0;
    const faixasSet = new Set();
    const programasSet = new Set();

    days.forEach(d => {
      const blocks = blocksByDay[d] || [];
      blocks.forEach((b, idx) => {
        if (!b.program || !b.program.title) return;
        totalSlots++;
        programasSet.add(b.program.title.trim().toUpperCase());
        totalSegundos += b.durationSec || timeToSec(b.duration);

        const slotKey = `${d}_${idx}`;
        const recSlot = options.recurrenceState?.slots?.[slotKey] || {};
        const tipo = b.tipoExibicao || recSlot.tipoExibicao || 'fixo';
        const origem = b.origemReprise || recSlot.origemReprise;
        const ep = b.episodio || recSlot.episodio;
        const faixa = b.faixaOcupada || recSlot.faixaNome || (b.program && (b.program.faixaOcupada || b.program.faixa_ocupada));

        if (faixa) faixasSet.add(faixa.trim());

        if (tipo === 'inedito') {
          totalIneditos++;
          if (ep && ep.titulo) ineditosComEpisodio++;
        } else if (tipo === 'reprise') {
          totalReprises++;
          if (origem && (origem.diaSemana !== undefined || origem.horario)) reprisesVinculadas++;
          if (ep && ep.titulo) reprisesComEpisodio++;
        } else {
          totalFixos++;
        }

        if (ep && ep.titulo) totalComEpisodio++;
      });
    });

    const horasProgramadas = (totalSegundos / 3600).toFixed(1);

    return {
      totalSlots,
      totalIneditos,
      totalReprises,
      totalFixos,
      reprisesVinculadas,
      ineditosComEpisodio,
      reprisesComEpisodio,
      totalComEpisodio,
      totalProgramasUnicos: programasSet.size,
      faixasIdentificadas: Array.from(faixasSet),
      horasProgramadas: Number(horasProgramadas),
      taxaVinculoReprises: totalReprises > 0 ? Math.round((reprisesVinculadas / totalReprises) * 100) : 100
    };
  }

  function buildWeeklyTable(blocksByDay, options = {}) {
    const days = [1, 2, 3, 4, 5, 6, 0];
    const dayNames = { 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado', 0: 'Domingo' };
    const intervalMinutes = options.intervalMinutes || 30;
    const intervalSec = intervalMinutes * 60;
    const startHour = options.startHour !== undefined ? options.startHour : 6;

    // Coleta todos os horários únicos de início presentes em qualquer dia
    const timeSet = new Set();
    let curSec = startHour * 3600;
    for (let i = 0; i < Math.floor(TOTAL_DAY_SEC / intervalSec); i++) {
      timeSet.add(secToTime(curSec));
      curSec = (curSec + intervalSec) % TOTAL_DAY_SEC;
    }

    days.forEach(d => {
      (blocksByDay[d] || []).forEach(b => {
        if (b.time) timeSet.add(b.time);
      });
    });

    const sortedTimes = Array.from(timeSet).sort((a, b) => gradeSeconds(a) - gradeSeconds(b));

    const headers = ['Horário', ...days.map(d => dayNames[d])];
    const rows = [];

    sortedTimes.forEach(tStr => {
      const tSec = gradeSeconds(tStr);
      const row = [tStr.substring(0, 5)];

      days.forEach(d => {
        const blocks = blocksByDay[d] || [];
        const activeBlock = blocks.find(b => {
          const bStart = gradeSeconds(b.time);
          const bEnd = gradeSeconds(b.endTime);
          return tSec >= bStart && tSec < bEnd;
        });

        if (activeBlock && activeBlock.program && activeBlock.program.title) {
          const isStart = activeBlock.time === tStr;
          let label = isStart
            ? (activeBlock.program.title + ' (' + activeBlock.duration.substring(0, 5) + ')')
            : ('↳ ' + activeBlock.program.title);

          if (options.incluirMetadados && isStart) {
            const blockIdx = blocks.indexOf(activeBlock);
            const slotKey = `${d}_${blockIdx}`;
            const recSlot = options.recurrenceState?.slots?.[slotKey] || {};
            const tipo = activeBlock.tipoExibicao || recSlot.tipoExibicao;
            const origem = activeBlock.origemReprise || recSlot.origemReprise;
            const ep = activeBlock.episodio || recSlot.episodio;
            const faixa = activeBlock.faixaOcupada || recSlot.faixaNome || (activeBlock.program && (activeBlock.program.faixaOcupada || activeBlock.program.faixa_ocupada));

            const tags = [];
            if (tipo === 'inedito') {
              tags.push('[INÉDITO]');
            } else if (tipo === 'reprise') {
              if (origem && origem.diaSemana !== undefined) {
                const diaNome = dayNames[origem.diaSemana] || '';
                const horaStr = (origem.horario || '').substring(0, 5);
                tags.push(`[REP ${diaNome.substring(0, 3)} ${horaStr}]`);
              } else {
                tags.push('[REPRISE]');
              }
            }
            if (faixa) {
              tags.push(`🎪 ${faixa}`);
            }
            if (tags.length > 0) {
              label += '\n' + tags.join(' ');
            }
            if (ep && ep.titulo) {
              const epNum = (ep.temporada && ep.episodioNumero)
                ? `T${String(ep.temporada).padStart(2, '0')}E${String(ep.episodioNumero).padStart(2, '0')}: `
                : (ep.codigo ? `${ep.codigo}: ` : '');
              label += `\n📺 ${epNum}${ep.titulo}`;
            }
          }

          row.push(label);
        } else {
          row.push('');
        }
      });

      rows.push(row);
    });

    return { headers, rows, days, sortedTimes };
  }


  /**
   * Vincula um intervalo de horários da grade a uma Faixa (ex: 07:30 às 12:15 -> TV Brasil Animada),
   * dividindo o intervalo em slots de 15 minutos e opcionalmente preenchendo-os com os programas do catálogo.
   */
  function vincularFaixaIntervalo(blocks, options = {}) {
    if (!Array.isArray(blocks)) return blocks;
    const {
      faixaNome = '',
      inicio = '07:30:00',
      fim = '12:15:00',
      duracaoSlotSec = 900, // 15 minutos padrão
      programasFaixa = [],
      classificacao = 'licenciado',
    } = options;

    if (!faixaNome || !inicio || !fim) return blocks;

    const startSec = timeToSec(inicio);
    const endSec = timeToSec(fim);
    const totalSec = endSec >= startSec ? (endSec - startSec) : ((TOTAL_DAY_SEC - startSec) + endSec);
    if (totalSec <= 0) return blocks;

    const numSlots = Math.floor(totalSec / duracaoSlotSec);
    if (numSlots <= 0) return blocks;

    // Gera os novos slots de 15 minutos da faixa
    const novosSlotsFaixa = [];
    let curSec = startSec;
    for (let i = 0; i < numSlots; i++) {
      const timeStr = secToTime(curSec);
      const nextSec = (curSec + duracaoSlotSec) % TOTAL_DAY_SEC;
      const endStr = secToTime(curSec + duracaoSlotSec);

      const prog = programasFaixa[i] || null;
      let programObj = null;
      if (prog) {
        programObj = {
          title: prog.title || prog.nome || prog.descricao || ('Atração ' + (i + 1)),
          code: prog.code || '',
          tempo: prog.tempo || secToTime(duracaoSlotSec),
          categoria: prog.categoria || 'Infantil',
          type: prog.type || 'RPRO',
          faixaOcupada: faixaNome,
          faixaNome: faixaNome,
          programaTitulo: prog.programaTitulo || prog.programa_titulo || '',
          temporada: prog.temporada ?? null,
          episodio: prog.episodio ?? null,
          bloco: prog.bloco ?? null,
        };
      }

      novosSlotsFaixa.push({
        id: `slot_faixa_${timeStr.replace(/:/g, '')}_${i}`,
        index: i,
        time: timeStr,
        duration: secToTime(duracaoSlotSec),
        durationSec: duracaoSlotSec,
        endTime: endStr,
        faixaNome: faixaNome,
        classificacao: classificacao,
        program: programObj,
      });

      curSec = nextSec;
    }

    // Se houver resto entre (startSec + numSlots * duracaoSlotSec) e endSec
    const remSec = totalSec % duracaoSlotSec;
    if (remSec > 0) {
      const timeStr = secToTime(curSec);
      const endStr = secToTime(curSec + remSec);
      novosSlotsFaixa.push({
        id: `slot_faixa_${timeStr.replace(/:/g, '')}_rem`,
        index: novosSlotsFaixa.length,
        time: timeStr,
        duration: secToTime(remSec),
        durationSec: remSec,
        endTime: endStr,
        faixaNome: faixaNome,
        classificacao: classificacao,
        program: null,
      });
    }

    // Substitui os blocos que estavam dentro de [normStart, normEnd)
    const antes = [];
    const depois = [];
    const normStart = gradeSeconds(inicio);
    const normEnd = gradeSeconds(fim);

    for (const b of blocks) {
      const bStart = gradeSeconds(b.time);
      const bDur = b.durationSec || (b.duration ? timeToSec(b.duration) : duracaoSlotSec);
      const bEnd = bStart + bDur;

      if (bEnd <= normStart) {
        antes.push(b);
      } else if (bStart >= normEnd) {
        depois.push(b);
      } else {
        if (bStart < normStart) {
          const splitDur = normStart - bStart;
          antes.push({
            ...b,
            duration: secToTime(splitDur),
            durationSec: splitDur,
            endTime: secToTime(timeToSec(b.time) + splitDur),
          });
        }
        if (bEnd > normEnd) {
          const splitDur = bEnd - normEnd;
          const splitTime = secToTime(timeToSec(fim));
          depois.push({
            ...b,
            id: `slot_${splitTime.replace(/:/g, '')}_post`,
            time: splitTime,
            duration: secToTime(splitDur),
            durationSec: splitDur,
            endTime: secToTime(timeToSec(splitTime) + splitDur),
          });
        }
      }
    }

    const resultadoFinal = [...antes, ...novosSlotsFaixa, ...depois];
    resultadoFinal.forEach((b, idx) => {
      b.index = idx;
    });

    return resultadoFinal;
  }

  function limparDia(blocksByDay, dow, options = {}) {
    const startHour = options.startHour !== undefined ? options.startHour : 6;
    const intervalMinutes = options.intervalMinutes !== undefined ? options.intervalMinutes : 30;
    const nextBlocks = { ...(blocksByDay || {}) };
    nextBlocks[dow] = generateBaseSlots(startHour, intervalMinutes);
    return nextBlocks;
  }

  function limparSemana(blocksByDay, options = {}) {
    const startHour = options.startHour !== undefined ? options.startHour : 6;
    const intervalMinutes = options.intervalMinutes !== undefined ? options.intervalMinutes : 30;
    const nextBlocks = {};
    for (let dow = 0; dow <= 6; dow++) {
      nextBlocks[dow] = generateBaseSlots(startHour, intervalMinutes);
    }
    return nextBlocks;
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
    moveOrSwapSlot,
    buildWeeklyTable,
    calcularResumoExecutivoGrade,
    gradeToBlocks,
    vincularFaixaIntervalo,
    limparDia,
    limparSemana,
    normalizarTituloGrade,
  };
});

// =====================================================
// PEÇAS DO DIA — IMPORT & SMART INSERTION ENGINE
// =====================================================

/** Lê o arquivo XLSX da planilha de peças de inserção usando SheetJS. Detecta a aba correta pela data (formato "DD MMM YY") ou pelo dia da semana em A3. Parseia seções e extrai code, nome, tempo e qtd. */
async function importPecasDiaExcel(file) {
  const XLSX = window.XLSX;
  if (!XLSX) { toast('Biblioteca SheetJS não carregada', 'error'); return; }

  let buf;
  try { buf = await file.arrayBuffer(); }
  catch(e) { toast('Erro ao ler o arquivo', 'error'); return; }

  let wb;
  try { wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: true }); }
  catch(e) { toast('Erro ao abrir planilha Excel', 'error'); return; }

  // --- Find the right sheet by date ---
  // Sheet names look like "22 MAR 26", "19 MAR 26", etc.
  const d = state.currentDate;
  const months = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const targetName = `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;

  let ws = null;
  let foundName = '';

  // 1. Exact match
  if (wb.Sheets[targetName]) {
    ws = wb.Sheets[targetName];
    foundName = targetName;
  }

  // 2. Fuzzy: find sheet whose name contains the same DD and month abbreviation
  if (!ws) {
    const dd  = String(d.getDate()).padStart(2,'0');
    const mon = months[d.getMonth()];
    for (const name of wb.SheetNames) {
      if (name.includes(dd) && name.toUpperCase().includes(mon)) {
        ws = wb.Sheets[name];
        foundName = name;
        break;
      }
    }
  }

  // 3. Last resort: match by day-of-week name in cell A3
  // But only pick the one whose index in SheetNames is closest to the expected date
  if (!ws) {
    const dayPT = ['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO'];
    const expectedDay = dayPT[d.getDay()].toUpperCase();
    const candidates = [];
    for (const name of wb.SheetNames) {
      if (['LIMPA','BÚSSOLAS'].includes(name)) continue;
      const s = wb.Sheets[name];
      const a3 = s['A3'] ? String(s['A3'].v || '').toUpperCase() : '';
      if (a3 === expectedDay) candidates.push(name);
    }
    if (candidates.length > 0) {
      // Pick the last one (most recent matching day in the file)
      ws = wb.Sheets[candidates[candidates.length - 1]];
      foundName = candidates[candidates.length - 1];
    }
  }

  if (!ws) {
    const available = wb.SheetNames.filter(n => !['LIMPA','BÚSSOLAS'].includes(n)).join(', ');
    toast(`Aba "${targetName}" não encontrada. Disponíveis: ${available}`, 'error');
    return;
  }

  // --- Parse rows ---
  // SheetJS raw:true gives us raw cell values; time cells are stored as fractional day numbers
  // We use sheet_to_json with header:1 to get arrays
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const pecasDia = parsePecasDiaRows(rows);

  if (pecasDia.length === 0) {
    toast(`Aba "${foundName}" encontrada mas sem peças válidas`, 'error');
    return;
  }

  state.pecasDia = pecasDia;
  const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  if (!saved.pecasDia) saved.pecasDia = {};
  saved.pecasDia[dateKey(d)] = pecasDia;
  localStorage.setItem('roteiroApp', JSON.stringify(saved));
  // Mescla peças importadas no banco permanente automaticamente
  if (typeof mergeBancoFromRoteiro === 'function') mergeBancoFromRoteiro(pecasDia);

  renderPecasDiaPanel();
  toast(`${pecasDia.length} peças importadas da aba "${foundName}"`, 'success');
}

// Convert SheetJS fractional day (e.g. 0.020833 = 0:30:00) to HH:MM:SS
function xlsxTimeToStr(v) {
  if (v == null) return '00:01:00';
  // It's a fractional day: 1 day = 86400 seconds
  const totalSec = Math.round(Number(v) * 86400);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Check whether a cell value looks like a time (number between 0 and 1)
function isTimeValue(v) {
  return typeof v === 'number' && v >= 0 && v < 1;
}

// Check whether a cell value is a date serial (number >= 1, like 46000+)
function isDateSerial(v) {
  return typeof v === 'number' && v >= 1000;
}

function parsePecasDiaRows(rows) {
  const pecas = [];
  let categoria = '';
  const SECTIONS = ['CHAMADA QUENTE', 'RCOM', 'RPOL', 'INTERPROGRAMAS GOV'];

  for (const row of rows) {
    const c0 = row[0] != null ? String(row[0]).trim() : '';
    const c1 = row[1] != null ? String(row[1]).trim() : '';
    const c2 = row[2]; // raw value — could be number (fractional day), string, or null
    const c3 = row[3] != null ? String(row[3]).trim() : '0OMN';
    const c4 = row[4] != null ? String(row[4]).trim() : '';
    const c5 = row[5]; // validade — could be date serial or string
    const c6 = row[6] != null ? String(row[6]).trim() : '';

    // Section header detection
    if (SECTIONS.includes(c0) && c2 == null) {
      categoria = c0;
      continue;
    }
    // Skip header rows
    if (c0 === 'CODE' || c0 === 'CODES') continue;
    // Skip title rows
    if (c0.includes('PEÇAS EM EXIBIÇÃO') || c0.length <= 2) continue;
    // Must have code, description, and a time value
    if (!c0 || !c1) continue;
    if (c2 == null) continue;
    // Skip if c2 is a string that's not a time (e.g. "TEMPO" header)
    if (typeof c2 === 'string' && !c2.includes(':')) continue;

    // Parse tempo
    let tempo = '00:01:00';
    if (isTimeValue(c2)) {
      tempo = xlsxTimeToStr(c2);
    } else if (typeof c2 === 'string' && c2.includes(':')) {
      // Already a string like "0:01:30" — normalize to HH:MM:SS
      const parts = c2.split(':').map(Number);
      if (parts.length === 3) {
        tempo = `${String(parts[0]).padStart(2,'0')}:${String(parts[1]).padStart(2,'0')}:${String(parts[2]).padStart(2,'0')}`;
      } else if (parts.length === 2) {
        tempo = `${String(parts[0]).padStart(2,'0')}:${String(parts[1]).padStart(2,'0')}:00`;
      }
    }

    // Skip rows where tempo came out as 00:00:00 AND code is not numeric (likely a garbage row)
    if (tempo === '00:00:00' && !/^\d+$/.test(c0) && !c0.startsWith('CE') && !c0.startsWith('AD')) continue;

    // Parse validade
    let validade = '';
    if (c5 != null) {
      if (isDateSerial(c5)) {
        // Convert Excel date serial to DD/MM/YY
        const date = new Date(Math.round((c5 - 25569) * 86400 * 1000));
        const dd = String(date.getUTCDate()).padStart(2,'0');
        const mm = String(date.getUTCMonth() + 1).padStart(2,'0');
        const yy = String(date.getUTCFullYear()).slice(2);
        validade = `${dd}/${mm}/${yy}`;
      } else {
        validade = String(c5).trim();
      }
    }

    // Extract quantity from obs
    let qtd = 1;
    const qtdMatch = c6.toUpperCase().match(/PROGRAMAR\s+(\d+)X/);
    if (qtdMatch) qtd = parseInt(qtdMatch[1]);

    // Extract time restriction
    let restricao = '';
    const entreMatch = c6.toUpperCase().match(/ENTRE\s+(\d+H\d*)\s+E\s+(\d+H\d*)/);
    const ateMatch   = c6.toUpperCase().match(/ATÉ\s+(\d+H\d*)/);
    const aposMatch  = c6.toUpperCase().match(/APÓS\s+(\d+H\d*)/);
    if (entreMatch) restricao = `${entreMatch[1]}–${entreMatch[2]}`;
    else if (ateMatch) restricao = `até ${ateMatch[1].toLowerCase()}`;
    else if (aposMatch) restricao = `após ${aposMatch[1].toLowerCase()}`;
    else if (validade && !validade.match(/\d{2}\/\d{2}\/\d{2}/)) restricao = validade;

    // Clean code (remove .0 from numeric floats)
    const code = c0.endsWith('.0') ? c0.slice(0, -2) : c0;

    pecas.push({
      code,
      descricao: c1,
      tempo,
      midia: c3 || '0OMN',
      type: c4,
      validade,
      obs: c6,
      categoria,
      qtd,
      restricao,
      usado: 0,
    });
  }
  return pecas;
}

// =====================================================
// RENDER PEÇAS DO DIA PANEL
// =====================================================
/** Renderiza os cards da aba Peças do Dia aplicando filtros de busca e tipo. Cada card é clicável (duplo clique insere no roteiro) e arrastável. Exibe o contador de uso de cada peça. */
function renderPecasDiaPanel() {
  const panel = document.getElementById('pecas-dia-content');
  if (!panel) return;

  if (!state.pecasDia || !state.pecasDia.length) {
    const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
    state.pecasDia = saved.pecasDia?.[dateKey(state.currentDate)] || [];
  }

  const search     = (document.getElementById('pd-search')?.value || '').toLowerCase();
  const filterType = document.getElementById('pd-filter')?.value || '';
  const cats = ['CHAMADA QUENTE', 'RCOM', 'RPOL', 'INTERPROGRAMAS GOV'];

  const grouped = {};
  for (const cat of cats) grouped[cat] = [];

  for (const p of (state.pecasDia || [])) {
    if (search && !p.descricao.toLowerCase().includes(search) && !p.code.toLowerCase().includes(search)) continue;
    if (filterType && p.type !== filterType) continue;
    const cat = p.categoria || 'INTERPROGRAMAS GOV';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }

  if (!state.pecasDia?.length) {
    panel.innerHTML = `<div class="empty"><div class="icon">📂</div>
      <p>Nenhuma peça importada para este dia.<br>Clique em "Importar Planilha" para carregar.</p></div>`;
    document.getElementById('badge-pecas-dia').textContent = '0';
    return;
  }

  let html = '';
  for (const cat of cats) {
    const items = grouped[cat] || [];
    if (!items.length) continue;
    html += `<div class="pd-section">
      <div class="pd-section-head">${cat}</div>
      ${items.map(p => {
        const done = p.qtd > 0 && p.usado >= p.qtd;
        const usageStr = p.qtd > 1 ? `${p.usado}/${p.qtd}×` : p.usado > 0 ? '✓' : '';
        return `<div class="peca-item${done ? ' pd-done' : ''}" draggable="true"
          ondragstart="dragFromSidebar(event,'${escAttr(p.code)}')"
          ondblclick="addPecaDia('${escAttr(p.code)}')">
          <div class="peca-code">${escHtml(p.code)}</div>
          <div class="peca-name">${escHtml(p.descricao)}</div>
          <div class="peca-meta">
            <span class="peca-dur">${p.tempo}</span>
            <span class="type-badge badge-${p.type}">${p.type}</span>
            ${p.restricao ? `<span style="font-size:9px;color:var(--amber)">${escHtml(p.restricao)}</span>` : ''}
            ${usageStr ? `<span style="font-size:9px;color:var(--green);margin-left:auto">${usageStr}</span>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }
  panel.innerHTML = html;

  const total = state.pecasDia?.length || 0;
  document.getElementById('badge-pecas-dia').textContent = total;
}

/** Limpa todas as peças do dia importadas para a data selecionada, após confirmação. Remove do state e do localStorage. */
function clearPecasDia() {
  if (!confirm('Limpar todas as peças do dia importadas?')) return;
  state.pecasDia = [];
  const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  if (saved.pecasDia) {
    const key = typeof dateKey === 'function' ? dateKey(state.currentDate) : '';
    if (key) delete saved.pecasDia[key];
    localStorage.setItem('roteiroApp', JSON.stringify(saved));
  }
  renderPecasDiaPanel();
  toast('Peças do dia limpas', 'success');
}

/** Abre o modal de adição manual de peça do dia, limpando todos os campos e colocando foco no campo de código. */
function openAddPecaDiaModal() {
  // Reset fields
  ['apd-code','apd-desc','apd-dur'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('apd-type').value = 'EINT';
  document.getElementById('apd-cat').value  = 'INTERPROGRAMAS GOV';
  document.getElementById('apd-qtd').value  = '1';
  document.getElementById('modal-add-peca-dia').style.display = 'flex';
  setTimeout(() => document.getElementById('apd-code').focus(), 50);
}

/** Valida os campos do modal de adição manual, cria o objeto de peça e o adiciona a state.pecasDia. Persiste no localStorage e atualiza o painel. */
function saveAddPecaDia() {
  const code  = document.getElementById('apd-code').value.trim();
  const desc  = document.getElementById('apd-desc').value.trim();
  const dur   = document.getElementById('apd-dur').value.trim() || '00:01:00';
  const type  = document.getElementById('apd-type').value;
  const cat   = document.getElementById('apd-cat').value;
  const qtd   = parseInt(document.getElementById('apd-qtd').value) || 1;

  if (!code) { document.getElementById('apd-code').focus(); toast('Informe o code', 'error'); return; }
  if (!desc) { document.getElementById('apd-desc').focus(); toast('Informe a descrição', 'error'); return; }

  // Normalize duration HH:MM → HH:MM:SS
  let tempo = dur;
  if (/^\d{1,2}:\d{2}$/.test(tempo)) tempo += ':00';
  if (!/^\d{2}:\d{2}:\d{2}$/.test(tempo)) tempo = '00:01:00';

  const peca = {
    code, descricao: desc, tempo, midia: '0OMN',
    type, categoria: cat, qtd, restricao: '', obs: '', validade: '', usado: 0,
  };

  if (!state.pecasDia) state.pecasDia = [];
  state.pecasDia.push(peca);

  // Persist
  const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  if (!saved.pecasDia) saved.pecasDia = {};
  const key = typeof dateKey === 'function' ? dateKey(state.currentDate) : '';
  if (key) saved.pecasDia[key] = state.pecasDia;
  localStorage.setItem('roteiroApp', JSON.stringify(saved));

  closeModal('modal-add-peca-dia');
  renderPecasDiaPanel();
  toast(`"${desc.substring(0,35)}" adicionada às peças do dia`, 'success');
}

function addPecaDia(code) {
  const p = (state.pecasDia || []).find(x => x.code === code) || findPeca(code);
  if (!p) return;
  const cleanItem = {...p, usado: undefined, qtd: undefined, restricao: undefined};
  if (state.selectedRow !== null) {
    const insertAt = state.selectedRow + 1;
    state.roteiro.splice(insertAt, 0, cleanItem);
    state.selectedRow = insertAt;
  } else {
    state.roteiro.push(cleanItem);
  }
  if (state.pecasDia) {
    const idx = state.pecasDia.findIndex(x => x.code === code);
    if (idx >= 0) state.pecasDia[idx].usado = (state.pecasDia[idx].usado || 0) + 1;
  }
  recalcTimes();
  saveState();
  renderRoteiro();
  renderPecasDiaPanel();
  toast(`"${p.descricao.substring(0,40)}" adicionada`, 'success');
}

// =====================================================
// SMART INSERTION
// =====================================================
/** Função principal de inserção inteligente. Chama buildSmartRoteiro() com o roteiro atual e as peças do dia importadas. Substitui state.roteiro pelo resultado, salva e re-renderiza. */
function smartInsertPecas() {
  if (!state.pecasDia?.length) {
    toast('Importe a planilha de peças do dia primeiro', 'error');
    return;
  }
  if (!state.roteiro.length) {
    toast('Monte o roteiro de programas primeiro', 'error');
    return;
  }

  const ok = confirm(
    `Distribuir ${state.pecasDia.length} peças automaticamente no roteiro (${state.roteiro.length} itens)?\n\n` +
    `• Chamadas nunca ficarão adjacentes\n` +
    `• Peças políticas (RPOL) inseridas entre 19h30–22h30\n` +
    `• Comerciais (RCOM) distribuídos pelo dia\n\n` +
    `O roteiro existente será mantido — as peças serão inseridas nos intervalos.`
  );
  if (!ok) return;

  const newRoteiro = buildSmartRoteiro([...state.roteiro], state.pecasDia);
  state.roteiro = newRoteiro;
  recalcTimes();
  saveState();
  renderRoteiro();
  renderPecasDiaPanel();
  renderWeekSelector();
  toast(`Roteiro atualizado — ${newRoteiro.length} itens`, 'success');
}

/** Motor de distribuição automática de peças nos breaks. Identifica slots __SLOT__ (dentro de breaks) e transSlots (após assinaturas), ordena as peças por prioridade e preenche os slots respeitando todas as regras de negócio. */
function buildSmartRoteiro(roteiro, pecasDia) {
  // Time constants
  const rpolStart = (typeof REGRAS !== 'undefined' ? REGRAS.rpolInicio : 19 * 3600 + 30 * 60);
  const rpolEnd   = (typeof REGRAS !== 'undefined' ? REGRAS.rpolFim   : 22 * 3600 + 30 * 60);
  const CHAMADA_TYPES = ['ECHM', 'ECHE'];

  // --- Find insertion slots ---
  // Priority 1: __SLOT__ break positions (between blocks of same program)
  // Priority 2: right after ASSINATURA_ (between different programs)
  const breakSlots = [];
  const transSlots = [];
  for (let i = 0; i < roteiro.length; i++) {
    if (roteiro[i].type === '__SLOT__') {
      breakSlots.push(i);
    } else if (roteiro[i].descricao?.startsWith('ASSINATURA_')) {
      transSlots.push(i + 1);
    }
  }
  // Use break slots first, then transition slots
  const slots = [...breakSlots, ...transSlots];
  if (slots.length === 0) {
    // Last fallback: gaps between programs
    for (let i = 1; i < roteiro.length; i++) {
      if (roteiro[i].type === 'RPRO' && roteiro[i-1].type !== 'RPRO') slots.push(i);
    }
  }
  if (slots.length === 0) return roteiro;

  // --- Build queue of items to insert ---
  // Separate by priority
  const eche  = pecasDia.filter(p => p.type === 'ECHE');
  const rcom  = pecasDia.filter(p => p.type === 'RCOM');
  const echm  = pecasDia.filter(p => p.type === 'ECHM');
  const eint  = pecasDia.filter(p => p.type === 'EINT');
  const rpol  = pecasDia.filter(p => p.type === 'RPOL');
  // VH daqui a pouco — indexed by the program name they reference
  // e.g. "VH DAQUI A POUCO PALALOOS" → only use when PALALOOS is the next program
  const allVhDaqui = pecasDia.filter(p =>
    p.type === 'EVNH' && p.descricao.toUpperCase().includes('DAQUI A POUCO')
  );

  /**
   * Retorna uma VH "DAQUI A POUCO" APENAS se ela referenciar especificamente
   * o programa informado. Nunca retorna uma VH de outro programa como fallback.
   * Exige que pelo menos 1 palavra significativa do programa (≥4 chars) esteja
   * no texto da VH após remover "DAQUI A POUCO".
   */
  function findVhDaquiForNext(nextBase) {
    if (!nextBase || !allVhDaqui.length) return null;
    const _norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
    const normBase = _norm(nextBase);
    // Palavras significativas do programa (≥4 chars, sem artigos/preposições)
    const stop = new Set(['PARA','COMO','MAIS','PELO','PELA','NUMA','COM','DOS','DAS','DAS']);
    const keywords = normBase.split(/\s+/).filter(w => w.length >= 4 && !stop.has(w));
    if (!keywords.length) return null;
    return allVhDaqui.find(vh => {
      // Remove "DAQUI A POUCO" para isolar o programa referenciado na VH
      const vhProg = _norm(vh.descricao).replace('DAQUI A POUCO','').trim();
      // A VH precisa mencionar ao menos 1 keyword do programa
      return keywords.some(kw => vhProg.includes(kw));
    }) || null; // Null = sem VH adequada, não insere nada
  }

  // SEM fallback genérico — se não há VH específica para o próximo programa,
  // não insere nenhuma VH (melhor pular do que inserir VH errada)
  const vhDaquiGeneric = null;

  const queue = []; // { item, timeRange }

  // ECHE: 1x each, high priority, no time restriction
  for (const p of eche) queue.push({ item: {...p}, times: 1, priority: 1 });

  // RCOM: distribute up to qtd
  for (const p of rcom) {
    const times = p.qtd || 2;
    queue.push({ item: {...p}, times, priority: 2 });
  }

  // ECHM: respect quantity/frequency hints
  for (const p of echm) {
    const hint = (p.obs || '').toUpperCase();
    let times = p.qtd || 1;
    if (hint.includes('HORA EM HORA')) times = Math.min(slots.length, 8);
    else if (hint.includes('6X')) times = 6;
    queue.push({ item: {...p}, times, priority: 3 });
  }

  // EINT: 1x each
  for (const p of eint) queue.push({ item: {...p}, times: 1, priority: 4 });

  // RPOL: between 19h30 and 22h30
  for (const p of rpol) queue.push({ item: {...p}, times: 1, priority: 5, timeRange: [rpolStart, rpolEnd] });

  // --- Calculate cumulative time at each slot position ---
  function timeAtPos(pos) {
    let sec = START_SECONDS;
    for (let i = 0; i < Math.min(pos, roteiro.length); i++) {
      sec += timeToSec(roteiro[i].tempo);
    }
    return sec;
  }

  // Build slot time map
  const slotTimes = slots.map(pos => ({ pos, sec: timeAtPos(pos) }));

  // --- Round-robin assignment ---
  // Track what's pending at each slot to detect chamada adjacency
  const insertions = []; // { pos, item }
  let slotRoundRobin = 0;

  for (const { item, times, priority, timeRange } of queue) {
    for (let rep = 0; rep < times; rep++) {
      let placed = false;

      for (let attempt = 0; attempt < slotTimes.length; attempt++) {
        const si = (slotRoundRobin + attempt) % slotTimes.length;
        const { pos, sec } = slotTimes[si];

        // Check time range restriction
        if (timeRange && (sec < timeRange[0] || sec > timeRange[1])) continue;

        // Chamada adjacency check: look at what's already at/around this position
        const itemIsChamada = CHAMADA_TYPES.includes(item.type);
        if (itemIsChamada) {
          // Check if the item before pos in the current roteiro is also a chamada
          const prevItem = roteiro[pos - 1];
          const prevIsChamada = prevItem && CHAMADA_TYPES.includes(prevItem.type);
          // Check if there's already a chamada insertion right before this slot
          const prevInsertion = insertions.find(ins => ins.pos === pos - 1 || ins.pos === pos);
          const prevInsIsChamada = prevInsertion && CHAMADA_TYPES.includes(prevInsertion.item.type);

          if (prevIsChamada || prevInsIsChamada) {
            // Insert a VH daqui a pouco que se refere ao PRÓXIMO programa.
            // IMPORTANTE: blocos do mesmo episódio (BL 01, BL 02, ...) continuam
            // sendo o MESMO programa. Não devemos anunciar "daqui a pouco X" dentro
            // do próprio programa X — só quando há transição real para outro programa.
            let currentProgBase = null;
            for (let pi = pos - 1; pi >= 0; pi--) {
              if (roteiro[pi].type === 'RPRO') {
                currentProgBase = baseProgramTitle(roteiro[pi].descricao);
                break;
              }
            }
            let nextProgBase = null;
            for (let ni = pos; ni < roteiro.length; ni++) {
              if (roteiro[ni].type === 'RPRO') {
                const base = baseProgramTitle(roteiro[ni].descricao);
                if (base !== currentProgBase) { nextProgBase = base; break; }
              }
            }
            // Só insere VH Daqui a Pouco se: (a) habilitada nas REGRAS,
            // (b) existe próximo programa DIFERENTE do atual, e (c) existe VH específica.
            const _vhDaqOk = typeof REGRAS === 'undefined' || REGRAS.vhDaquiAPouco !== false;
            const vhSep = (_vhDaqOk && nextProgBase) ? (findVhDaquiForNext(nextProgBase) || vhDaquiGeneric) : null;
            if (vhSep) {
              const vh = {...vhSep};
              delete vh.qtd; delete vh.usado; delete vh.restricao;
              insertions.push({ pos, item: vh, priority: 0 });
            } else {
              // No separator available — skip this slot
              continue;
            }
          }
        }

        insertions.push({ pos, item: {...item, qtd: undefined, usado: undefined, restricao: undefined}, priority });
        slotRoundRobin = (si + 1) % slotTimes.length;
        placed = true;
        break;
      }

      // High-priority items that couldn't be placed: force at end
      if (!placed && priority <= 2) {
        const lastSlot = slotTimes[slotTimes.length - 1];
        insertions.push({ pos: lastSlot.pos, item: {...item, qtd: undefined, usado: undefined, restricao: undefined}, priority });
      }
    }
  }

  // --- Apply insertions (reverse order to preserve indices) ---
  // Group by position, sort each group by priority
  const byPos = {};
  for (const ins of insertions) {
    if (!byPos[ins.pos]) byPos[ins.pos] = [];
    byPos[ins.pos].push(ins);
  }

  const positions = Object.keys(byPos).map(Number).sort((a, b) => b - a);
  for (const pos of positions) {
    const items = byPos[pos].sort((a, b) => a.priority - b.priority).map(i => i.item);
    roteiro.splice(pos, 0, ...items);
  }

  // Remove any __SLOT__ placeholders that weren't filled by peças
  return roteiro.filter(item => item.type !== '__SLOT__');
}

// =====================================================
// IMPORT PEÇAS DO DIA FROM CSV (Google Sheets export)
// =====================================================
// Called when user imports the planilha as CSV instead of xlsx
// Structure mirrors the xlsx but times are strings like "0:01:00"
/** Parseia as linhas de um CSV de peças do dia. Detecta seções pelo cabeçalho (CHAMADA QUENTE, RCOM, RPOL, INTERPROGRAMAS GOV) e extrai code, nome, tempo, qtd e obs de cada peça. */
function importPecasDiaCSV(lines, sep) {
  sep = sep || ',';

  // Find which day this sheet is for — look for day name in first few rows
  const DIAS = ['SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO','DOMINGO'];
  let sheetDay = '';
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const val = lines[i].split(sep)[0].replace(/"/g,'').trim().toUpperCase();
    if (DIAS.includes(val)) { sheetDay = val; break; }
  }

  // Convert CSV lines to row arrays (same shape as xlsx rows)
  const rows = lines.map(line => {
    const cols = parseCSVLine(line, sep);
    return cols.map(c => {
      if (!c || c === '') return null;
      c = c.trim().replace(/^"(.*)"$/, '$1').trim(); // strip quotes
      return c === '' ? null : c;
    });
  });

  // Re-use the same parser — but patch time values:
  // xlsx gives fractional numbers; CSV gives strings like "0:01:00"
  // parsePecasDiaRows already handles string times with the colon check
  const pecasDia = parsePecasDiaRows(rows);

  if (pecasDia.length === 0) {
    toast('Nenhuma peça encontrada no CSV. Verifique se exportou a aba correta.', 'error');
    return;
  }

  const d = state.currentDate;
  state.pecasDia = pecasDia;
  const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  if (!saved.pecasDia) saved.pecasDia = {};
  saved.pecasDia[dateKey(d)] = pecasDia;
  localStorage.setItem('roteiroApp', JSON.stringify(saved));

  // Switch to Peças do Dia tab automatically
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-pecas-dia').classList.add('active');
  document.querySelectorAll('.tab').forEach(t => {
    if (t.textContent.includes('Peças do Dia')) t.classList.add('active');
  });

  renderPecasDiaPanel();
  const dayLabel = sheetDay ? ` (${sheetDay})` : '';
  toast(`${pecasDia.length} peças importadas do CSV${dayLabel}`, 'success');
}

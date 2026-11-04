// grade-editor.js — Lógica da tela de Confecção de Grade Semanal
// Particionado por emissora e sincronizado com Roteiro / Supabase

(function () {
  'use strict';

  const DOW_NAMES = {
    1: 'Segunda-feira',
    2: 'Terça-feira',
    3: 'Quarta-feira',
    4: 'Quinta-feira',
    5: 'Sexta-feira',
    6: 'Sábado',
    0: 'Domingo',
  };

  const PALETTE = [
    '#185FA5', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#06b6d4', '#84cc16', '#ef4444', '#a855f7', '#14b8a6',
    '#f97316', '#6366f1', '#22c55e', '#e11d48', '#0ea5e9'
  ];

  let supabaseClient = null;
  let currentUser = null;
  let currentDow = 1; // 1 = Segunda
  let viewMode = 'day'; // 'day' | 'week'
  let programas = [];
  let blocksByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  let isDirty = false;

  const colorCache = {};
  let colorIdx = 0;
  function getProgColor(title) {
    if (!title) return '#ccc';
    const base = title.replace(/\s*\[\d+ª\]$/, '').trim().toUpperCase();
    if (!colorCache[base]) {
      colorCache[base] = PALETTE[colorIdx++ % PALETTE.length];
    }
    return colorCache[base];
  }

  function getStorageKey() {
    const emissoraId = window.EmissoraContext ? window.EmissoraContext.getEmissoraAtivaId() : null;
    return emissoraId ? `roteiroApp_${emissoraId}` : 'roteiroApp';
  }

  function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = type;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  function setSyncStatus(msg) {
    const el = document.getElementById('sync-status');
    if (el) el.textContent = msg;
  }

  function setGateMessage(msg) {
    const el = document.getElementById('gate-msg');
    if (el) el.textContent = msg;
  }

  function isCascadeEnabled() {
    const chk = document.getElementById('toggle-cascade');
    return chk ? chk.checked : true;
  }

  /* ══════════════════════════════════════════════════════════
     INICIALIZAÇÃO & AUTENTICAÇÃO
     ══════════════════════════════════════════════════════════ */
  async function boot() {
    try {
      if (window.CanalAuth) {
        supabaseClient = window.CanalAuth.getClient();
      }
    } catch (e) {
      console.warn('Falha ao iniciar cliente Supabase:', e);
    }

    if (window.CanalAuth) {
      window.CanalAuth.rememberReturnTo('grade-editor.html');
      window.CanalAuth.onAuthChange((event) => {
        if (event === 'SIGNED_OUT') location.reload();
      });
    }

    // Tenta obter sessão do usuário
    let session = null;
    if (window.CanalAuth && typeof window.CanalAuth.resolveSession === 'function') {
      session = await window.CanalAuth.resolveSession();
    }

    if (!session && supabaseClient) {
      const { data } = await supabaseClient.auth.getSession();
      session = data?.session;
    }

    if (session && session.user) {
      startApp(session.user);
    } else {
      // Exibe gate de login inline
      document.getElementById('gate-msg').style.display = 'none';
      document.getElementById('gate-login').style.display = 'block';
      setupGateLogin();
    }
  }

  function setupGateLogin() {
    const btn = document.getElementById('gate-submit');
    const emailInput = document.getElementById('gate-email');
    const passInput = document.getElementById('gate-password');
    const errEl = document.getElementById('gate-error');

    async function doLogin() {
      errEl.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Entrando...';
      try {
        if (window.CanalAuth) {
          const user = await window.CanalAuth.signIn(emailInput.value, passInput.value);
          startApp(user);
        } else if (supabaseClient) {
          const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: emailInput.value.trim(),
            password: passInput.value,
          });
          if (error) throw error;
          startApp(data.user);
        }
      } catch (err) {
        errEl.textContent = err.message || 'Falha no login';
        btn.disabled = false;
        btn.textContent = 'Entrar';
      }
    }

    btn.onclick = doLogin;
    passInput.onkeydown = (e) => { if (e.key === 'Enter') doLogin(); };
  }

  async function startApp(user) {
    currentUser = user;
    const gate = document.getElementById('gate');
    if (gate) gate.style.display = 'none';

    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl) userEmailEl.textContent = user.email || '';

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.onclick = async () => {
        if (window.CanalAuth) await window.CanalAuth.signOut('index.html');
        else if (supabaseClient) await supabaseClient.auth.signOut();
        location.href = 'index.html';
      };
    }

    // Carrega emissoras
    if (window.EmissoraContext && supabaseClient) {
      try {
        const emissoras = await window.EmissoraContext.carregarEmissoras(supabaseClient, user.id);
        if (emissoras && emissoras.length > 0) {
          const ativa = window.EmissoraContext.resolverEmissoraAtiva(emissoras);
          popularSeletorEmissoras(emissoras, ativa?.id);
          atualizarBranding(ativa);
        }
      } catch (e) {
        console.warn('Erro ao carregar emissoras:', e);
      }
    }

    // Atualiza botão de admin se tiver papel admin
    if (window.AdminPainel) {
      const linkAdmin = document.getElementById('admin-nav-link');
      if (linkAdmin) linkAdmin.style.display = 'inline-block';
    }

    // Carrega dados da emissora ativa
    await carregarDadosEmissora();

    // Atalho de teclado Ctrl+S / Cmd+S para salvar
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvarGrade();
      }
    });
  }

  function popularSeletorEmissoras(emissoras, ativaId) {
    const wrap = document.getElementById('emissora-wrap');
    const sel = document.getElementById('select-emissora');
    if (!wrap || !sel) return;
    sel.innerHTML = emissoras.map(e => `<option value="${e.id}" ${e.id === ativaId ? 'selected' : ''}>${escapeHtml(e.nome)}</option>`).join('');
    wrap.style.display = emissoras.length > 1 ? 'flex' : 'none';
  }

  function atualizarBranding(emissora) {
    const titleEl = document.getElementById('page-brand-title');
    if (!titleEl) return;
    const nome = (emissora?.nome || 'CANAL EDUCAÇÃO').toUpperCase();
    titleEl.innerHTML = `${escapeHtml(nome)} · <span>CONFECÇÃO DE GRADE</span>`;
  }

  /* ══════════════════════════════════════════════════════════
     CARREGAMENTO E SINCRONIZAÇÃO DE DADOS
     ══════════════════════════════════════════════════════════ */
  async function carregarDadosEmissora() {
    setSyncStatus('Carregando dados...');
    const storageKey = getStorageKey();
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');

    // 1. Carrega acervo de programas
    programas = [];
    if (window.PecasRepo && typeof window.PecasRepo.loadAll === 'function') {
      try {
        if (window.EmissoraContext) {
          window.PecasRepo.setEmissoraId(window.EmissoraContext.getEmissoraAtivaId());
        }
        const repoData = await window.PecasRepo.loadAll();
        if (Array.isArray(repoData.programas)) {
          programas = repoData.programas;
        }
      } catch (e) {
        console.warn('Falha ao buscar programas no PecasRepo:', e);
      }
    }

    // Fallback: junta com programas salvos localmente
    if (Array.isArray(saved.programas)) {
      const existingCodes = new Set(programas.map(p => (p.code || p.title || p.nome || '').toUpperCase()));
      saved.programas.forEach(sp => {
        const key = (sp.code || sp.title || sp.nome || '').toUpperCase();
        if (key && !existingCodes.has(key)) {
          existingCodes.add(key);
          programas.push(sp);
        }
      });
    }

    // Se ainda vazio e Canal Educação, extrai programas de GRADE_BASE
    if (programas.length === 0 && typeof GRADE_BASE !== 'undefined') {
      const found = new Set();
      Object.values(GRADE_BASE.gradeOrderByDay || {}).forEach(arr => {
        arr.forEach(title => {
          const clean = title.replace(/\s*\[\d+ª\]$/, '').trim();
          if (!found.has(clean.toUpperCase())) {
            found.add(clean.toUpperCase());
            programas.push({
              title: clean,
              code: '',
              tempo: '00:30:00',
              categoria: 'Geral',
            });
          }
        });
      });
    }

    // 2. Carrega blocos para cada dia da semana (0 a 6)
    const isCanalEdu = !window.EmissoraContext || window.EmissoraContext.getEmissoraAtivaId() === '00000000-0000-0000-0000-000000000001';

    for (let dow = 0; dow <= 6; dow++) {
      if (saved.gradeBlocksByDay && Array.isArray(saved.gradeBlocksByDay[dow]) && saved.gradeBlocksByDay[dow].length > 0) {
        blocksByDay[dow] = saved.gradeBlocksByDay[dow];
      } else if (saved.gradeByDay && saved.gradeByDay[dow] && Object.keys(saved.gradeByDay[dow]).length > 0) {
        const order = (saved.gradeOrderByDay && saved.gradeOrderByDay[dow]) || [];
        blocksByDay[dow] = window.GradeEditorCore.gradeToBlocks(saved.gradeByDay[dow], order, programas);
      } else if (isCanalEdu && typeof GRADE_BASE !== 'undefined' && GRADE_BASE.gradeByDay && GRADE_BASE.gradeByDay[dow]) {
        const order = GRADE_BASE.gradeOrderByDay ? GRADE_BASE.gradeOrderByDay[dow] : [];
        blocksByDay[dow] = window.GradeEditorCore.gradeToBlocks(GRADE_BASE.gradeByDay[dow], order, programas);
      } else {
        blocksByDay[dow] = window.GradeEditorCore.generateBaseSlots(6, 30);
      }
    }

    renderAcervo();
    atualizarBadgesDias();
    renderActiveView();
    setSyncStatus('Pronto');
  }

  async function trocarEmissoraGrade(novaId) {
    if (isDirty) {
      if (!confirm('Você tem alterações não salvas nesta grade. Deseja salvar antes de trocar de emissora?')) {
        // descarta
      } else {
        await salvarGrade();
      }
    }

    if (window.EmissoraContext) {
      window.EmissoraContext.setEmissoraAtivaId(novaId);
      const emissoras = window.EmissoraContext.getEmissorasCache();
      const ativa = emissoras.find(e => e.id === novaId);
      atualizarBranding(ativa);
    }

    await carregarDadosEmissora();
    showToast('Emissora alterada com sucesso.', 'success');
  }

  /* ══════════════════════════════════════════════════════════
     RENDERIZAÇÃO
     ══════════════════════════════════════════════════════════ */
  function renderAcervo() {
    const container = document.getElementById('program-list-container');
    const countEl = document.getElementById('acervo-count');
    if (!container) return;

    const term = (document.getElementById('search-programas')?.value || '').toLowerCase().trim();
    const filtered = programas.filter(p => {
      const t = (p.title || p.nome || p.descricao || '').toLowerCase();
      const c = (p.code || '').toLowerCase();
      return !term || t.includes(term) || c.includes(term);
    });

    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:20px;color:#888;font-size:12px">Nenhum programa encontrado.</div>`;
      return;
    }

    container.innerHTML = filtered.map((p, idx) => {
      const title = p.title || p.nome || p.descricao || 'SEM TÍTULO';
      const dur = p.tempo || '00:30:00';
      const code = p.code ? `<span class="tag-duration">${escapeHtml(p.code)}</span>` : '';
      const cat = p.categoria ? `<span style="font-size:10px;color:#888">• ${escapeHtml(p.categoria)}</span>` : '';

      return `
        <div class="program-card" draggable="true" data-idx="${idx}"
             ondragstart="onProgDragStart(event, ${idx})">
          <span class="drag-handle" title="Arrastar para um slot da grade">⠿</span>
          <div class="prog-info">
            <div class="prog-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
            <div class="prog-meta">
              <span class="tag-duration">⏱ ${dur}</span>
              ${code}
              ${cat}
            </div>
          </div>
          <button type="button" class="btn-quick-add" onclick="quickAddToNextSlot(${idx})" title="Adicionar no primeiro slot livre">+</button>
        </div>
      `;
    }).join('');
  }

  function renderActiveView() {
    if (viewMode === 'week') {
      document.getElementById('timeline-view').style.display = 'none';
      document.getElementById('week-matrix-view').style.display = 'block';
      renderWeekMatrix();
    } else {
      document.getElementById('timeline-view').style.display = 'flex';
      document.getElementById('week-matrix-view').style.display = 'none';
      renderTimeline();
    }
  }

  function renderTimeline() {
    const container = document.getElementById('slots-container');
    const dayTitleEl = document.getElementById('active-day-title');
    const statsEl = document.getElementById('timeline-stats');
    if (!container) return;

    if (dayTitleEl) dayTitleEl.textContent = DOW_NAMES[currentDow] || 'Grade do Dia';

    const blocks = blocksByDay[currentDow] || [];
    let filledCount = 0;
    blocks.forEach(b => { if (b.program && b.program.title) filledCount++; });

    if (statsEl) {
      statsEl.textContent = `${blocks.length} blocos · ${filledCount} preenchidos · ${blocks.length - filledCount} livres`;
    }

    verificarAlertas(blocks);

    container.innerHTML = blocks.map((b, idx) => {
      const hasProg = b.program && b.program.title;
      const color = hasProg ? getProgColor(b.program.title) : '#ccc';
      const isEmptyClass = hasProg ? '' : 'is-empty';

      let contentHtml = '';
      if (hasProg) {
        contentHtml = `
          <div class="slot-color-bar" style="background:${color}"></div>
          <span class="drag-handle" draggable="true" ondragstart="onSlotDragStart(event, ${idx})" title="Arrastar para trocar de horário" style="font-size:16px;cursor:grab">⠿</span>
          <div class="slot-details">
            <div class="slot-title" title="${escapeHtml(b.program.title)}">${escapeHtml(b.program.title)}</div>
            <div class="slot-meta">
              ${b.program.code ? `<span>Cód: <strong>${escapeHtml(b.program.code)}</strong></span>` : ''}
              ${b.program.categoria ? `<span>• ${escapeHtml(b.program.categoria)}</span>` : ''}
            </div>
          </div>
        `;
      } else {
        contentHtml = `
          <div class="slot-color-bar" style="background:#e0e0dc"></div>
          <div class="slot-empty-prompt">
            <span>➕ Slot Livre (${b.duration})</span> — Solte um programa aqui
          </div>
        `;
      }

      return `
        <div class="timeline-slot ${isEmptyClass}" id="slot-${idx}" data-slot-idx="${idx}"
             ondragover="onSlotDragOver(event, ${idx})"
             ondragleave="onSlotDragLeave(event, ${idx})"
             ondrop="onSlotDrop(event, ${idx})">
          
          <!-- Horário -->
          <div class="slot-time">
            <div class="slot-time-range">${b.time} ➔ ${b.endTime}</div>
            <div class="slot-duration-tag">Duração: ${b.duration}</div>
          </div>

          <!-- Conteúdo -->
          <div class="slot-content">
            ${contentHtml}
          </div>

          <!-- Controles de Duração -->
          <div class="slot-controls">
            <div class="duration-stepper" title="Ajustar tempo deste bloco">
              <button type="button" class="step-btn" onclick="ajustarTempoSlot(${idx}, -15)">-15m</button>
              <button type="button" class="step-btn" onclick="ajustarTempoSlot(${idx}, -5)">-5m</button>
              <input type="text" class="step-input" value="${b.duration}"
                     onchange="definirTempoSlot(${idx}, this.value)"
                     title="Editar duração exata (HH:MM:SS)">
              <button type="button" class="step-btn" onclick="ajustarTempoSlot(${idx}, 5)">+5m</button>
              <button type="button" class="step-btn" onclick="ajustarTempoSlot(${idx}, 15)">+15m</button>
              <button type="button" class="step-btn" onclick="ajustarTempoSlot(${idx}, 30)">+30m</button>
            </div>

            ${hasProg ? `
              <button type="button" class="btn-slot-clear" onclick="limparSlot(${idx})" title="Remover programa deste slot">×</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderWeekMatrix() {
    const container = document.getElementById('matrix-grid-container');
    if (!container) return;

    const days = [1, 2, 3, 4, 5, 6, 0];
    const headers = [`<div class="matrix-header">Horário</div>`];
    days.forEach(d => {
      headers.push(`<div class="matrix-header">${DOW_NAMES[d]}</div>`);
    });

    const rowsHtml = [];
    const baseSlots = window.GradeEditorCore.generateBaseSlots(6, 30);

    baseSlots.forEach((slotRef, sIdx) => {
      let row = `<div class="matrix-time-col">${slotRef.time.substring(0,5)}</div>`;
      days.forEach(d => {
        const blocks = blocksByDay[d] || [];
        const match = blocks[sIdx] || blocks.find(b => b.time.startsWith(slotRef.time.substring(0,5)));
        if (match && match.program && match.program.title) {
          const color = getProgColor(match.program.title);
          row += `
            <div class="matrix-cell" style="border-left: 3px solid ${color}" onclick="goToDayAndSlot(${d}, ${sIdx})" title="${escapeHtml(match.program.title)} (${match.time} - ${match.endTime})">
              <div class="cell-title">${escapeHtml(match.program.title)}</div>
              <div class="cell-time">${match.time.substring(0,5)} - ${match.duration.substring(3)}</div>
            </div>
          `;
        } else {
          row += `
            <div class="matrix-cell" style="background:#fafafa;color:#bbb" onclick="goToDayAndSlot(${d}, ${sIdx})">
              <span style="font-size:10px;font-style:italic">Livre</span>
            </div>
          `;
        }
      });
      rowsHtml.push(row);
    });

    container.innerHTML = headers.join('') + rowsHtml.join('');
  }

  function verificarAlertas(blocks) {
    const alertBox = document.getElementById('timeline-alert');
    const alertText = document.getElementById('timeline-alert-text');
    if (!alertBox || !alertText) return;

    const issues = window.GradeEditorCore.detectGapsAndOverlaps(blocks);
    if (issues.length > 0) {
      const overlaps = issues.filter(i => i.type === 'overlap').length;
      const gaps = issues.filter(i => i.type === 'gap').length;
      let msg = `⚠️ Atenção: `;
      if (overlaps > 0) msg += `${overlaps} sobreposição(ões) de horário detectada(s). `;
      if (gaps > 0) msg += `${gaps} intervalo(s) vago(s) (buracos) entre programas.`;
      alertText.textContent = msg;
      alertBox.style.display = 'flex';
    } else {
      alertBox.style.display = 'none';
    }
  }

  function atualizarBadgesDias() {
    [0, 1, 2, 3, 4, 5, 6].forEach(d => {
      const badgeId = { 1: 'badge-seg', 2: 'badge-ter', 3: 'badge-qua', 4: 'badge-qui', 5: 'badge-sex', 6: 'badge-sab', 0: 'badge-dom' }[d];
      const el = document.getElementById(badgeId);
      if (el) {
        const blocks = blocksByDay[d] || [];
        const count = blocks.filter(b => b.program && b.program.title).length;
        el.textContent = count;
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
     AÇÕES DO USUÁRIO & MANIPULAÇÃO DA GRADE
     ══════════════════════════════════════════════════════════ */
  window.switchDay = function (dow) {
    currentDow = Number(dow);
    viewMode = 'day';
    document.querySelectorAll('#day-tabs-container .day-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-dow') === String(dow));
    });
    renderActiveView();
  };

  window.switchViewMode = function (mode) {
    viewMode = mode;
    document.querySelectorAll('#day-tabs-container .day-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-dow') === mode);
    });
    renderActiveView();
  };

  window.goToDayAndSlot = function (dow, slotIdx) {
    window.switchDay(dow);
    setTimeout(() => {
      const el = document.getElementById(`slot-${slotIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('drag-over');
        setTimeout(() => el.classList.remove('drag-over'), 800);
      }
    }, 100);
  };

  window.filtrarProgramas = function () {
    renderAcervo();
  };

  window.quickAddToNextSlot = function (progIdx) {
    const p = programas[progIdx];
    if (!p) return;
    const blocks = blocksByDay[currentDow] || [];
    // Encontra o primeiro slot livre
    let emptyIdx = blocks.findIndex(b => !b.program || !b.program.title);
    if (emptyIdx === -1) emptyIdx = blocks.length - 1;

    blocksByDay[currentDow] = window.GradeEditorCore.assignProgramToSlot(
      blocks, emptyIdx, p, { cascade: isCascadeEnabled(), adoptDuration: true }
    );
    isDirty = true;
    renderTimeline();
    atualizarBadgesDias();
    showToast(`"${p.title || p.nome}" adicionado às ${blocksByDay[currentDow][emptyIdx].time}`);
  };

  window.ajustarTempoSlot = function (slotIdx, deltaMin) {
    const blocks = blocksByDay[currentDow] || [];
    const cur = blocks[slotIdx];
    if (!cur) return;
    const curSec = cur.durationSec || window.GradeEditorCore.timeToSec(cur.duration);
    const newSec = Math.max(60, curSec + deltaMin * 60);

    blocksByDay[currentDow] = window.GradeEditorCore.adjustBlockDuration(
      blocks, slotIdx, newSec, { cascade: isCascadeEnabled() }
    );
    isDirty = true;
    renderTimeline();
    showToast(`Duração alterada para ${window.GradeEditorCore.secToTime(newSec)}`);
  };

  window.definirTempoSlot = function (slotIdx, valStr) {
    const blocks = blocksByDay[currentDow] || [];
    const newSec = window.GradeEditorCore.timeToSec(valStr);
    if (!newSec || newSec < 60) {
      renderTimeline(); // restaura
      return;
    }
    blocksByDay[currentDow] = window.GradeEditorCore.adjustBlockDuration(
      blocks, slotIdx, newSec, { cascade: isCascadeEnabled() }
    );
    isDirty = true;
    renderTimeline();
  };

  window.limparSlot = function (slotIdx) {
    const blocks = blocksByDay[currentDow] || [];
    blocksByDay[currentDow] = window.GradeEditorCore.removeProgramFromSlot(blocks, slotIdx);
    isDirty = true;
    renderTimeline();
    atualizarBadgesDias();
  };

  window.compactarGrade = function () {
    const blocks = blocksByDay[currentDow] || [];
    const filled = blocks.filter(b => b.program && b.program.title);
    if (filled.length === 0) {
      showToast('Não há programas para compactar neste dia.');
      return;
    }
    // Reorganiza a partir das 06:00:00 sem espaços vazios
    let curSec = 6 * 3600;
    const reordered = [];
    filled.forEach((b, i) => {
      const durSec = b.durationSec || window.GradeEditorCore.timeToSec(b.duration) || 1800;
      const startTime = window.GradeEditorCore.secToTime(curSec);
      const endTime = window.GradeEditorCore.secToTime(curSec + durSec);
      reordered.push({
        ...b,
        index: i,
        time: startTime,
        duration: window.GradeEditorCore.secToTime(durSec),
        durationSec: durSec,
        endTime: endTime,
      });
      curSec += durSec;
    });

    // Se faltar para completar 48 slots, preenche o restante
    const base = window.GradeEditorCore.generateBaseSlots(6, 30);
    while (reordered.length < 48) {
      const i = reordered.length;
      const startTime = window.GradeEditorCore.secToTime(curSec);
      const durSec = 1800;
      reordered.push({
        id: `slot_${i}_${startTime.replace(/:/g, '')}`,
        index: i,
        time: startTime,
        duration: '00:30:00',
        durationSec: durSec,
        endTime: window.GradeEditorCore.secToTime(curSec + durSec),
        program: null,
      });
      curSec += durSec;
    }

    blocksByDay[currentDow] = reordered;
    isDirty = true;
    renderTimeline();
    showToast('Grade compactada com sucesso!', 'success');
  };

  window.limparDiaAtual = function () {
    if (!confirm(`Tem certeza que deseja limpar todos os programas de ${DOW_NAMES[currentDow]}?`)) return;
    blocksByDay[currentDow] = window.GradeEditorCore.generateBaseSlots(6, 30);
    isDirty = true;
    renderTimeline();
    atualizarBadgesDias();
    showToast(`Programação de ${DOW_NAMES[currentDow]} limpa.`);
  };

  window.resolverConflitos = function () {
    window.compactarGrade();
  };

  /* ══════════════════════════════════════════════════════════
     DRAG AND DROP NATIVO (HTML5)
     ══════════════════════════════════════════════════════════ */
  let dragSource = null; // { type: 'acervo', data } | { type: 'slot', slotIndex }

  window.onProgDragStart = function (e, progIdx) {
    const p = programas[progIdx];
    if (!p) return;
    dragSource = { type: 'acervo', data: p };
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'acervo', data: p }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  window.onSlotDragStart = function (e, slotIdx) {
    dragSource = { type: 'slot', slotIndex: slotIdx };
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'slot', slotIndex: slotIdx }));
    e.dataTransfer.effectAllowed = 'move';
  };

  window.onSlotDragOver = function (e, slotIdx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const el = document.getElementById(`slot-${slotIdx}`);
    if (el) el.classList.add('drag-over');
  };

  window.onSlotDragLeave = function (e, slotIdx) {
    const el = document.getElementById(`slot-${slotIdx}`);
    if (el) el.classList.remove('drag-over');
  };

  window.onSlotDrop = function (e, targetIdx) {
    e.preventDefault();
    const el = document.getElementById(`slot-${targetIdx}`);
    if (el) el.classList.remove('drag-over');

    let payload = null;
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) payload = JSON.parse(raw);
    } catch (_) {}

    if (!payload && dragSource) payload = dragSource;
    if (!payload) return;

    const blocks = blocksByDay[currentDow] || [];

    if (payload.type === 'acervo') {
      blocksByDay[currentDow] = window.GradeEditorCore.assignProgramToSlot(
        blocks, targetIdx, payload.data, { cascade: isCascadeEnabled(), adoptDuration: true }
      );
      isDirty = true;
      renderTimeline();
      atualizarBadgesDias();
      showToast(`"${payload.data.title || payload.data.nome}" colocado às ${blocksByDay[currentDow][targetIdx].time}`);
    } else if (payload.type === 'slot') {
      const fromIdx = payload.slotIndex;
      if (fromIdx === targetIdx) return;

      // Troca ou move
      const sourceSlot = blocks[fromIdx];
      const targetSlot = blocks[targetIdx];

      const tempProg = sourceSlot.program;
      sourceSlot.program = targetSlot.program;
      targetSlot.program = tempProg;

      isDirty = true;
      renderTimeline();
      atualizarBadgesDias();
      showToast(`Programas movidos entre ${sourceSlot.time} e ${targetSlot.time}`);
    }

    dragSource = null;
  };

  /* ══════════════════════════════════════════════════════════
     MODAL: COPIAR DIA
     ══════════════════════════════════════════════════════════ */
  window.openCopyDayModal = function () {
    const modal = document.getElementById('modal-copy-day');
    const nameEl = document.getElementById('copy-source-day-name');
    if (!modal) return;
    if (nameEl) nameEl.textContent = DOW_NAMES[currentDow];
    // Desmarca todos
    document.querySelectorAll('input[name="copy-dest"]').forEach(chk => {
      chk.checked = false;
      chk.disabled = (Number(chk.value) === currentDow);
    });
    modal.style.display = 'flex';
  };

  window.closeCopyDayModal = function () {
    const modal = document.getElementById('modal-copy-day');
    if (modal) modal.style.display = 'none';
  };

  window.selecionarDiasUteis = function () {
    document.querySelectorAll('input[name="copy-dest"]').forEach(chk => {
      const v = Number(chk.value);
      chk.checked = (v >= 1 && v <= 5 && v !== currentDow);
    });
  };

  window.selecionarFimDeSemana = function () {
    document.querySelectorAll('input[name="copy-dest"]').forEach(chk => {
      const v = Number(chk.value);
      chk.checked = ((v === 6 || v === 0) && v !== currentDow);
    });
  };

  window.confirmarCopiaDia = function () {
    const targets = [];
    document.querySelectorAll('input[name="copy-dest"]:checked').forEach(chk => {
      targets.push(Number(chk.value));
    });

    if (targets.length === 0) {
      alert('Selecione pelo menos um dia de destino.');
      return;
    }

    const sourceBlocks = blocksByDay[currentDow] || [];
    targets.forEach(destDow => {
      blocksByDay[destDow] = sourceBlocks.map(b => ({
        ...b,
        id: `slot_${b.index}_${b.time.replace(/:/g, '')}`,
        program: b.program ? { ...b.program } : null,
      }));
    });

    isDirty = true;
    closeCopyDayModal();
    atualizarBadgesDias();
    showToast(`Programação copiada para ${targets.length} dia(s).`, 'success');
  };

  /* ══════════════════════════════════════════════════════════
     MODAL: NOVO PROGRAMA RÁPIDO
     ══════════════════════════════════════════════════════════ */
  window.abrirNovoProgramaRapido = function () {
    const m = document.getElementById('modal-quick-prog');
    if (m) m.style.display = 'flex';
    document.getElementById('quick-prog-title')?.focus();
  };

  window.closeQuickProgModal = function () {
    const m = document.getElementById('modal-quick-prog');
    if (m) m.style.display = 'none';
  };

  window.salvarNovoProgramaRapido = function () {
    const title = document.getElementById('quick-prog-title')?.value.trim();
    const code = document.getElementById('quick-prog-code')?.value.trim();
    const dur = document.getElementById('quick-prog-dur')?.value.trim() || '00:30:00';

    if (!title) {
      alert('Informe o título do programa.');
      return;
    }

    const novo = {
      title,
      code,
      tempo: dur,
      categoria: 'Geral',
    };
    programas.unshift(novo);
    closeQuickProgModal();
    renderAcervo();
    showToast(`Programa "${title}" adicionado ao acervo.`, 'success');
  };

  /* ══════════════════════════════════════════════════════════
     SALVAMENTO & PUBLICAÇÃO
     ══════════════════════════════════════════════════════════ */
  window.salvarGrade = async function () {
    setSyncStatus('Salvando grade...');

    const storageKey = getStorageKey();
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');

    const gradeByDay = saved.gradeByDay || {};
    const gradeOrderByDay = saved.gradeOrderByDay || {};
    const gradeBlocksByDay = {};

    for (let dow = 0; dow <= 6; dow++) {
      const blocks = blocksByDay[dow] || [];
      gradeBlocksByDay[dow] = blocks;
      const { grade, order } = window.GradeEditorCore.blocksToGrade(blocks);
      gradeByDay[dow] = grade;
      gradeOrderByDay[dow] = order;
    }

    saved.gradeByDay = gradeByDay;
    saved.gradeOrderByDay = gradeOrderByDay;
    saved.gradeBlocksByDay = gradeBlocksByDay;
    saved.gradeSemanalInfo = {
      descricao: `Editada em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(storageKey, JSON.stringify(saved));

    // Sincroniza com Supabase se usuário estiver logado
    if (supabaseClient && currentUser) {
      try {
        const emissoraId = window.EmissoraContext ? window.EmissoraContext.getEmissoraAtivaId() : null;
        if (emissoraId) {
          await supabaseClient.from('user_data').upsert({
            user_id: currentUser.id,
            emissora_id: emissoraId,
            grade_by_day: gradeByDay,
            grade_order_by_day: gradeOrderByDay,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id, emissora_id' });
        }
      } catch (err) {
        console.warn('Falha ao persistir grade no Supabase:', err);
      }
    }

    isDirty = false;
    setSyncStatus('Salvo');
    showToast('Grade semanal salva com sucesso! Disponível no Roteiro.', 'success');
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

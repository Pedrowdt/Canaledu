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
  let viewMode = 'week'; // 'day' | 'week'
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
    sel.onchange = (e) => {
      if (typeof window.trocarEmissoraGrade === 'function') {
        window.trocarEmissoraGrade(e.target.value);
      }
    };
  }

  function atualizarBranding(emissora) {
    const titleEl = document.getElementById('page-brand-title');
    if (!titleEl) return;
    if (emissora && emissora.nome) {
      const cor = emissora.cor_primaria || "#0066cc";
      const logoUrl = emissora.logo_url || null;
      let logoHtml = "";
      if (logoUrl) {
        logoHtml = `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(emissora.nome)}" style="height:20px;max-width:40px;object-fit:contain;vertical-align:middle;margin-right:6px;border-radius:3px">`;
      }
      titleEl.innerHTML = `${logoHtml}<span style="background:${escapeHtml(cor)};color:#fff;padding:2px 7px;border-radius:4px;font-size:10.5px;font-weight:700;letter-spacing:0.03em">${escapeHtml(emissora.nome.toUpperCase())}</span> <span style="color:#94a3b8;font-weight:400;margin-left:4px">· CONFECÇÃO DE GRADE</span>`;
      document.title = `Confecção de Grade — ${emissora.nome}`;
    } else {
      titleEl.innerHTML = '<span>CONFECÇÃO DE GRADE</span>';
      document.title = 'Confecção de Grade · RoteiroHub';
    }
    const sel = document.getElementById("select-emissora");
    if (sel && emissora && emissora.cor_primaria) {
      sel.style.borderColor = emissora.cor_primaria;
    }
  }

  if (typeof window !== "undefined") {
    window.atualizarBrandingGrade = atualizarBranding;
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

    // 2. Isolamento estrito de emissora: SÓ o Canal Educação pode usar dados de GRADE_BASE.
    // Qualquer outra emissora (ex: TV Brasil) NUNCA herda dados do Canal Educação.
    const emissoraId = window.EmissoraContext ? window.EmissoraContext.getEmissoraAtivaId() : null;
    const isCanalEdu = !emissoraId || emissoraId === '00000000-0000-0000-0000-000000000001';

    if (supabaseClient && currentUser && emissoraId) {
      try {
        const { data: userRow } = await supabaseClient
          .from('user_data')
          .select('grade_by_day, grade_order_by_day, updated_at')
          .eq('user_id', currentUser.id)
          .eq('emissora_id', emissoraId)
          .maybeSingle();
        if (userRow) {
          if (userRow.grade_by_day && Object.keys(userRow.grade_by_day).length > 0) {
            saved.gradeByDay = userRow.grade_by_day;
            // gradeBlocksByDay é um cache local expandido da grade. Quando há
            // uma grade remota para esta emissora, reconstrói os blocos dela.
            saved.gradeBlocksByDay = null;
          }
          if (userRow.grade_order_by_day && Object.keys(userRow.grade_order_by_day).length > 0) {
            saved.gradeOrderByDay = userRow.grade_order_by_day;
          }
        }
      } catch (err) {
        console.warn('Falha ao buscar grade remota no Supabase:', err);
      }
    }

    blocksByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

    if (isCanalEdu && programas.length === 0 && typeof GRADE_BASE !== 'undefined') {
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

  window.trocarEmissoraGrade = async function (novaId) {
    if (isDirty) {
      if (!confirm('Você tem alterações não salvas nesta grade. Deseja salvar antes de trocar de emissora?')) {
        // descarta
      } else {
        if (typeof window.salvarGrade === 'function') await window.salvarGrade();
        else await salvarGrade();
      }
    }

    if (window.EmissoraContext) {
      window.EmissoraContext.setEmissoraAtivaId(novaId);
      const emissoras = window.EmissoraContext.getEmissorasCache();
      const ativa = emissoras.find(e => e.id === novaId);
      atualizarBranding(ativa);
    }

    const sel = document.getElementById('select-emissora');
    if (sel && sel.value !== novaId) {
      sel.value = novaId;
    }

    isDirty = false;
    await carregarDadosEmissora();
    showToast('Emissora alterada com sucesso.', 'success');
  };

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
      document.getElementById('week-matrix-view').style.display = 'flex';
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

  let subViewSemana = 'columns'; // 'columns' | 'table'

  window.sincronizarCascadeToggle = function (val) {
    const chkTimeline = document.getElementById('toggle-cascade');
    if (chkTimeline) chkTimeline.checked = val;
  };

  window.toggleSubViewSemana = function () {
    subViewSemana = subViewSemana === 'columns' ? 'table' : 'columns';
    const btn = document.getElementById('btn-toggle-subview');
    if (btn) btn.textContent = subViewSemana === 'columns' ? 'Modo Tabela' : 'Modo Colunas';
    renderWeekMatrix();
  };

  function renderWeekMatrix() {
    const colsContainer = document.getElementById('week-columns-container');
    const tableContainer = document.getElementById('matrix-grid-container');
    if (!colsContainer) return;

    if (subViewSemana === 'table') {
      colsContainer.style.display = 'none';
      if (tableContainer) {
        tableContainer.style.display = 'grid';
        renderWeekTableConsolidated(tableContainer);
      }
      return;
    }

    colsContainer.style.display = 'grid';
    if (tableContainer) tableContainer.style.display = 'none';

    const days = [1, 2, 3, 4, 5, 6, 0];
    const columnsHtml = days.map(d => {
      const blocks = blocksByDay[d] || [];
      const filledCount = blocks.filter(b => b.program && b.program.title).length;

      const slotsHtml = blocks.map((b, idx) => {
        const hasProg = b.program && b.program.title;
        const color = hasProg ? getProgColor(b.program.title) : '#ccc';
        const isEmptyClass = hasProg ? '' : 'is-empty';

        return `
          <div class="week-slot-card ${isEmptyClass}" id="wslot-${d}-${idx}"
               draggable="${hasProg ? 'true' : 'false'}"
               data-dow="${d}" data-idx="${idx}"
               ondragstart="onWeekSlotDragStart(event, ${d}, ${idx})"
               ondragover="onWeekSlotDragOver(event, ${d}, ${idx})"
               ondragleave="onWeekSlotDragLeave(event, ${d}, ${idx})"
               ondrop="onWeekSlotDrop(event, ${d}, ${idx})">
            
            <div class="week-slot-time-row">
              <span class="week-slot-time">${b.time.substring(0,5)} ➔ ${b.endTime.substring(0,5)}</span>
              <span class="week-slot-dur">${b.duration.substring(0,5)}</span>
            </div>

            ${hasProg ? `
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:4px;height:24px;border-radius:2px;background:${color};flex-shrink:0"></div>
                <div style="flex:1;min-width:0">
                  <div class="week-slot-title" title="${escapeHtml(b.program.title)}">${escapeHtml(b.program.title)}</div>
                  ${b.program.code ? `<div style="font-size:9px;color:#64748b;font-family:var(--mono)">${escapeHtml(b.program.code)}</div>` : ''}
                </div>
              </div>
            ` : `
              <div style="font-size:10px;color:#94a3b8;font-style:italic;padding:4px 0">
                ➕ Livre (${b.duration.substring(0,5)})
              </div>
            `}

            <div class="week-slot-actions">
              <div class="week-time-stepper" title="Ajustar tempo deste bloco">
                <button type="button" class="week-step-btn" onclick="ajustarTempoSlotSemana(${d}, ${idx}, -15)" title="Diminuir 15m">-15m</button>
                <button type="button" class="week-step-btn" onclick="ajustarTempoSlotSemana(${d}, ${idx}, 15)" title="Aumentar 15m">+15m</button>
              </div>

              <div style="display:flex;align-items:center;gap:4px">
                <button type="button" class="week-step-btn" onclick="window.goToDayAndSlot(${d}, ${idx})" title="Abrir em tela cheia do dia" style="font-size:9px">🔍</button>
                ${hasProg ? `
                  <button type="button" class="week-btn-clear" onclick="limparSlotSemana(${d}, ${idx})" title="Remover programa">×</button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="week-day-col" id="week-col-${d}">
          <div class="week-day-header">
            <div class="week-day-title">
              <span>${DOW_NAMES[d]}</span>
              <span class="week-day-badge">${filledCount}</span>
            </div>
            <button type="button" class="btn-outline" style="padding:1px 6px;font-size:10px" onclick="adicionarBlocoSemana(${d})" title="Adicionar novo bloco ao final">+ Bloco</button>
          </div>
          <div class="week-day-slots">
            ${slotsHtml}
          </div>
        </div>
      `;
    }).join('');

    colsContainer.innerHTML = columnsHtml;
  }

  function renderWeekTableConsolidated(container) {
    const tableData = window.GradeEditorCore.buildWeeklyTable(blocksByDay, { intervalMinutes: 15 });
    const headersHtml = tableData.headers.map(h => `<div class="matrix-header">${escapeHtml(h)}</div>`).join('');

    const rowsHtml = tableData.rows.map(row => {
      const timeCell = `<div class="matrix-time-col">${escapeHtml(row[0])}</div>`;
      const dayCells = row.slice(1).map((val, dIdx) => {
        const d = tableData.days[dIdx];
        if (val) {
          const isContinuation = val.startsWith('↳');
          const cleanTitle = val.replace(/^↳\s*/, '').replace(/\s*\([\d:]+\)$/, '');
          const color = getProgColor(cleanTitle);
          return `
            <div class="matrix-cell ${isContinuation ? 'continuation' : ''}" style="border-left: 3px solid ${color}"
                 onclick="window.switchDay(${d})" title="${escapeHtml(val)}">
              <div class="cell-title">${escapeHtml(val)}</div>
            </div>
          `;
        }
        return `<div class="matrix-cell" style="background:#fafafa;color:#cbd5e1" onclick="window.switchDay(${d})"><span style="font-size:10px;font-style:italic">Livre</span></div>`;
      }).join('');
      return timeCell + dayCells;
    }).join('');

    container.innerHTML = headersHtml + rowsHtml;
  }

  /* ══════════════════════════════════════════════════════════
     AÇÕES ESPECÍFICAS DA VISUALIZAÇÃO SEMANAL
     ══════════════════════════════════════════════════════════ */
  window.ajustarTempoSlotSemana = function (dow, slotIdx, deltaMin) {
    const blocks = blocksByDay[dow] || [];
    const cur = blocks[slotIdx];
    if (!cur) return;
    const curSec = cur.durationSec || window.GradeEditorCore.timeToSec(cur.duration);
    const newSec = Math.max(60, curSec + deltaMin * 60);

    blocksByDay[dow] = window.GradeEditorCore.adjustBlockDuration(
      blocks, slotIdx, newSec, { cascade: isCascadeEnabled() }
    );
    isDirty = true;
    renderWeekMatrix();
    atualizarBadgesDias();
    showToast(`${DOW_NAMES[dow]}: duração ajustada para ${window.GradeEditorCore.secToTime(newSec)}`);
  };

  window.limparSlotSemana = function (dow, slotIdx) {
    const blocks = blocksByDay[dow] || [];
    blocksByDay[dow] = window.GradeEditorCore.removeProgramFromSlot(blocks, slotIdx);
    isDirty = true;
    renderWeekMatrix();
    atualizarBadgesDias();
  };

  window.adicionarBlocoSemana = function (dow) {
    const blocks = blocksByDay[dow] || [];
    const last = blocks[blocks.length - 1];
    const startTime = last ? last.endTime : '06:00:00';
    const durSec = 1800; // 30 min
    const endTime = window.GradeEditorCore.secToTime(window.GradeEditorCore.timeToSec(startTime) + durSec);

    blocks.push({
      id: `slot_${blocks.length}_${startTime.replace(/:/g, '')}`,
      index: blocks.length,
      time: startTime,
      duration: '00:30:00',
      durationSec: durSec,
      endTime: endTime,
      program: null,
    });

    blocksByDay[dow] = blocks;
    isDirty = true;
    renderWeekMatrix();
    atualizarBadgesDias();
    showToast(`Novo bloco adicionado em ${DOW_NAMES[dow]} às ${startTime}`);
  };

  /* ══════════════════════════════════════════════════════════
     DRAG AND DROP NA VISUALIZAÇÃO SEMANAL
     ══════════════════════════════════════════════════════════ */
  window.onWeekSlotDragStart = function (e, dow, slotIdx) {
    dragSource = { type: 'week-slot', dow, slotIndex: slotIdx };
    e.dataTransfer.setData('application/json', JSON.stringify(dragSource));
    e.dataTransfer.effectAllowed = 'move';
  };

  window.onWeekSlotDragOver = function (e, dow, slotIdx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const el = document.getElementById(`wslot-${dow}-${slotIdx}`);
    if (el) el.classList.add('drag-over');
  };

  window.onWeekSlotDragLeave = function (e, dow, slotIdx) {
    const el = document.getElementById(`wslot-${dow}-${slotIdx}`);
    if (el) el.classList.remove('drag-over');
  };

  window.onWeekSlotDrop = function (e, targetDow, targetSlotIdx) {
    e.preventDefault();
    const el = document.getElementById(`wslot-${targetDow}-${targetSlotIdx}`);
    if (el) el.classList.remove('drag-over');

    let payload = null;
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) payload = JSON.parse(raw);
    } catch (_) {}

    if (!payload && dragSource) payload = dragSource;
    if (!payload) return;

    if (payload.type === 'acervo') {
      // Soltou programa do acervo lateral na semana toda
      const blocks = blocksByDay[targetDow] || [];
      blocksByDay[targetDow] = window.GradeEditorCore.assignProgramToSlot(
        blocks, targetSlotIdx, payload.data, { cascade: isCascadeEnabled(), adoptDuration: true }
      );
      isDirty = true;
      renderWeekMatrix();
      atualizarBadgesDias();
      showToast(`"${payload.data.title || payload.data.nome}" colocado em ${DOW_NAMES[targetDow]} às ${blocksByDay[targetDow][targetSlotIdx].time}`, 'success');
    } else if (payload.type === 'week-slot' || payload.type === 'slot') {
      const fromDow = payload.dow !== undefined ? payload.dow : currentDow;
      const fromSlotIdx = payload.slotIndex;

      if (fromDow === targetDow && fromSlotIdx === targetSlotIdx) return;

      blocksByDay = window.GradeEditorCore.moveOrSwapSlot(
        blocksByDay, fromDow, fromSlotIdx, targetDow, targetSlotIdx
      );
      isDirty = true;
      renderWeekMatrix();
      atualizarBadgesDias();
      showToast(`Programa movido com sucesso para ${DOW_NAMES[targetDow]}.`, 'success');
    }

    dragSource = null;
  };

  /* ══════════════════════════════════════════════════════════
     EXPORTAÇÃO OFICIAL DA GRADE EM PDF
     ══════════════════════════════════════════════════════════ */
  window.exportarGradePDF = function () {
    const emissoras = window.EmissoraContext ? window.EmissoraContext.getEmissorasCache() : [];
    const ativaId = window.EmissoraContext ? window.EmissoraContext.getEmissoraAtivaId() : null;
    const ativa = emissoras.find(e => e.id === ativaId);
    const nomeEmissora = (ativa?.nome || 'Canal Educação').toUpperCase();
    const slugEmissora = (ativa?.slug || 'emissora').toLowerCase();

    // Se jsPDF estiver disponível via CDN
    const hasJsPdf = typeof window.jspdf !== 'undefined' && typeof window.jspdf.jsPDF !== 'undefined';

    if (!hasJsPdf) {
      // Fallback para impressão nativa formatada em paisagem
      showToast('Abrindo diálogo de impressão / Salvar como PDF...', 'info');
      window.print();
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      // Paisagem (landscape), formato A4
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const dataHoje = new Date().toLocaleDateString('pt-BR');
      const horaHoje = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Cabeçalho Oficial
      doc.setFillColor(24, 95, 165); // Azul #185FA5
      doc.rect(10, 8, 277, 14, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`${nomeEmissora} — GRADE SEMANAL DE PROGRAMAÇÃO`, 14, 17);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Emitido em ${dataHoje} às ${horaHoje}`, 245, 17);

      // Tabela de Programação com Autotable
      const tableData = window.GradeEditorCore.buildWeeklyTable(blocksByDay, { intervalMinutes: 15 });

      doc.autoTable({
        head: [tableData.headers],
        body: tableData.rows,
        startY: 25,
        margin: { left: 10, right: 10, bottom: 10 },
        styles: {
          fontSize: 6.5,
          cellPadding: 1.5,
          font: 'helvetica',
          overflow: 'linebreak',
          lineColor: [220, 220, 220],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [26, 29, 41],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 7.5,
        },
        columnStyles: {
          0: { cellWidth: 16, halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] },
          1: { cellWidth: 37 },
          2: { cellWidth: 37 },
          3: { cellWidth: 37 },
          4: { cellWidth: 37 },
          5: { cellWidth: 37 },
          6: { cellWidth: 37 },
          7: { cellWidth: 37 },
        },
        alternateRowStyles: {
          fillColor: [252, 252, 253],
        },
        didDrawPage: function (data) {
          // Rodapé
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(130, 130, 130);
          doc.text(
            `Página ${data.pageNumber} de ${pageCount} · Sistema Roteiro White-Label · ${nomeEmissora}`,
            14,
            202
          );
        },
      });

      const filename = `GRADE_SEMANAL_${slugEmissora.toUpperCase()}_${dataHoje.replace(/\//g, '-')}.pdf`;
      doc.save(filename);
      showToast(`PDF da grade exportado com sucesso: ${filename}`, 'success');
    } catch (err) {
      console.error('Falha ao exportar PDF via jsPDF:', err);
      // Fallback para impressão
      window.print();
    }
  };

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

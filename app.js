// =====================================================
// STATE
// =====================================================
let state = {
  roteiro: [],
  pecas: [],
  programas: [],
  currentDate: null,   // Date object — the selected day
  weekOffset: 0,       // 0 = current week, +1 = next, -1 = previous
  pecasDia: [],        // daily pieces from planilha
  selectedRow: null,   // index of the currently selected/focused row
  sidebarFilters: new Set(),
  panelFilters: new Set(),
  // Peças fixas: entram automaticamente em todo roteiro gerado via importação
  // Estrutura: [{ code, descricao, tempo, type, midia, posicao, ativo }]
  // posicao: "inicio" | "fim" | "antes_programa" | "apos_assinatura"
  pecasFixas: [],
  // Avisos de divergência de horário (BL01) que o usuário já "assumiu" — ficam
  // ocultos até o roteiro mudar o suficiente para gerar uma chave diferente.
  gradeAcked: new Set(),
};

// Versões com debounce de 220ms para renderizações disparadas por input do usuário.
// Evita reconstruir o DOM inteiro a cada tecla pressionada.
const renderPecasSidebarDebounced = typeof debounce === 'function'
  ? debounce(() => renderPecasSidebar(), 220)
  : () => renderPecasSidebar();
const renderPecasPanelDebounced = typeof debounce === 'function'
  ? debounce(() => renderPecasPanel(), 220)
  : () => renderPecasPanel();

const DAY_NAMES = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const DAY_SHORT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const START_SECONDS = 6 * 3600; // 06:00:00

// =====================================================
// REGRAS DE NEGÓCIO — todas as regras configuráveis
// ficam aqui. O painel Admin lê e grava neste objeto.
// =====================================================
const REGRAS_DEFAULT = {
  // Horário de início do roteiro (segundos desde meia-noite)
  inicioRoteiro:       6 * 3600,
  // Janela permitida para inserção de RPOL (segundos)
  rpolInicio:          19 * 3600 + 30 * 60,
  rpolFim:             22 * 3600 + 30 * 60,
  // Tolerância de grade em segundos (±N segundos = ✓ verde)
  gradeTolerancia:     10,
  // Quantidade de slots de break por bloco de programa
  breakSlotsPorBloco:  2,
  // Tipos considerados "chamada" para regra de não-adjacência
  tiposChamada:        ['ECHM', 'ECHE'],
  // Limite de itens visíveis na sidebar antes de pedir refinamento
  sidebarMaxItens:     120,
  // Intervalo de auto-backup em minutos
  backupIntervaloMin:  2,
  // Exibir indicadores de grade no roteiro
  mostrarGrade:        true,
  // Mesclar itens importados automaticamente no banco permanente
  autoBanco:           true,
  // Injetar peças fixas ao gerar roteiro
  injetarFixas:        true,

  // ── REGRAS POR TIPO DE PEÇA ─────────────────────────────────────
  // Cada tipo configurável tem:
  //   ativo:           se false, validação ignora esse tipo
  //   inicio/fim:      janela horária permitida (HH:MM)
  //   intervaloMinMin: minutos mínimos entre repetições da MESMA peça (code)
  //   naoAdjacenteA:   tipos que NÃO podem ficar imediatamente antes/depois
  // O painel Admin lê e grava este objeto.
  regrasTipos: {
    ECHM: { ativo: true, inicio: '06:00', fim: '23:59', intervaloMinMin: 0,  naoAdjacenteA: ['ECHM','ECHE'] },
    ECHE: { ativo: true, inicio: '06:00', fim: '23:59', intervaloMinMin: 0,  naoAdjacenteA: ['ECHM','ECHE'] },
    EINT: { ativo: true, inicio: '06:00', fim: '23:59', intervaloMinMin: 0,  naoAdjacenteA: [] },
    RCOM: { ativo: true, inicio: '06:00', fim: '23:00', intervaloMinMin: 30, naoAdjacenteA: [] },
    RPOL: { ativo: true, inicio: '19:30', fim: '22:30', intervaloMinMin: 0,  naoAdjacenteA: [] },
    EVNH: { ativo: true, inicio: '06:00', fim: '23:59', intervaloMinMin: 0,  naoAdjacenteA: [] },
  },



  // ── Vinhetas (VH) ────────────────────────────────────────────────
  // Cada VH tem: code, descricao, tempo, ativo
  // Se ativo=false, a VH não é inserida no roteiro gerado

  // VH Classificação Indicativa Livre (inserida antes do 1º bloco)
  vhClassificacao: {
    code:     '85283',
    descricao:'VH CLASSIFICAÇAO INDICATIVA LIVRE',
    tempo:    '00:00:06',
    ativo:    true,
  },

  // VH Assinaturas (inseridas após o último bloco de cada programa)
  vhAssinaturaInfantil: {
    code:     '85331',
    descricao:'ASSINATURA_INFANTIL',
    tempo:    '00:00:05',
    ativo:    true,
  },
  vhAssinaturaJovem: {
    code:     '85330',
    descricao:'ASSINATURA_JOVEM',
    tempo:    '00:00:05',
    ativo:    true,
  },
  vhAssinaturaAdulto: {
    code:     '85332',
    descricao:'ASSINATURA_ADULTO',
    tempo:    '00:00:05',
    ativo:    true,
  },

  // Keywords para classificação de assinatura por faixa etária
  // Programas com esses termos recebem ASSINATURA_INFANTIL
  vhAssinaturaInfantilKeywords: 'PALALOOS,PLANETA PALAVRA,SONHOS E SAPATILHAS,SOL EM DO RE MI,IGARAPE MAGICO,TRILHINHA',
  // Programas com esses termos recebem ASSINATURA_ADULTO
  vhAssinaturaAdultoKeywords:   'CAMINHOS DA REPORTAGEM,ESCOLA QUE PROTEGE,HUMANIDADES,MANUAL DE SOBREVIVENCIA,LITERATURA BRASILEIRA,SAL A GOSTO,CINCO MULHERES,FAROIS DO BRASIL,FILHOS DA LIBERDADE,OLHARES DO NORTE,PASSADO DA HORA,SEMENTES DA EDUCACAO',

  // VH "A Seguir" — ativação global e timeout de busca
  vhSeguirAtivo:    true,   // Se false, não insere nenhuma VH A SEGUIR
  // VH "Vc Está Assistindo" — ativação global
  vhAssistindoAtivo: true,  // Se false, não insere VH VC ESTA ASSISTINDO nos breaks
  // VH "Daqui a Pouco" — ativação global
  vhDaquiAPouco:    true,   // Se false, buildSmartRoteiro não usa VH daqui a pouco como separador
};

/**
 * Carrega as regras de negócio do localStorage (customizações do admin)
 * com fallback para REGRAS_DEFAULT. Garante que novos campos sempre existem.
 */
function loadRegras() {
  const saved = JSON.parse(localStorage.getItem('roteiroRegras') || '{}');
  return { ...REGRAS_DEFAULT, ...saved };
}

/**
 * Salva as regras de negócio customizadas no localStorage.
 * Só armazena os campos que diferem dos defaults.
 */
function saveRegras(regras) {
  localStorage.setItem('roteiroRegras', JSON.stringify(regras));
}

// Regras ativas — carregadas uma vez no boot, recarregadas após Admin salvar
let REGRAS = loadRegras();

// Format Date as YYYY-MM-DD (storage key)
/** Converte um objeto Date em string "YYYY-MM-DD" usada como chave de armazenamento no localStorage. */
function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

// O "dia da grade" começa às 06:00 e termina às 05:59:59 do dia seguinte.
// Entre 00:00 e 05:59 ainda pertence ao dia anterior (último programa antes
// do programa que abre o dia seguinte às 06:00). Para isso basta deslocar
// o relógio em −6h e usar a data resultante como "hoje" do roteiro/grade.
/** Retorna o "agora" deslocado em −6h, para que a janela 06h→06h do roteiro/grade caia no mesmo dia. */
function nowForGrade() {
  const d = new Date();
  d.setHours(d.getHours() - 6);
  return d;
}

// Get Monday of the week containing date d
/** Retorna o objeto Date da segunda-feira da semana que contém a data informada. Trata domingo como fim de semana. */
function getMondayOf(d) {
  const dt = new Date(d);
  const dow = dt.getDay();
  const diff = (dow === 0) ? -6 : 1 - dow;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0,0,0,0);
  return dt;
}

// Return 7 dates (Mon–Sun) for week = today + offset*7 days
/** Retorna array com 7 objetos Date (Seg→Dom) da semana atual + deslocamento em semanas (offset). */
function getWeekDates(offset) {
  const today = nowForGrade();
  today.setHours(0,0,0,0);
  const monday = getMondayOf(today);
  monday.setDate(monday.getDate() + offset * 7);
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// =====================================================
// INIT
// =====================================================
/** Ponto de entrada do app. Inicializa o estado com dados do localStorage (ou dados iniciais), carrega o roteiro do dia atual e renderiza a interface. Se o objeto API estiver disponível (modo servidor), sincroniza os dados em paralelo. */
function init() {
  loadTheme();
  const today = nowForGrade();
  today.setHours(0,0,0,0);
  state.currentDate = today;
  state.weekOffset  = 0;


  const saved = localStorage.getItem('roteiroApp');
  if (saved) {
    const parsed = JSON.parse(saved);
    state.pecas      = parsed.pecas      || INITIAL_PECAS;
    state.programas  = parsed.programas  || INITIAL_PROGRAMAS;
    state.pecasFixas = parsed.pecasFixas || [];
    state.roteiro    = parsed.roteiros?.[dateKey(today)] || [];
  } else {
    state.pecas      = INITIAL_PECAS;
    state.programas  = INITIAL_PROGRAMAS;
    state.pecasFixas = [];
    // Seed Thursday 19/03/2026 roteiro from imported data
    const seed = { pecas: state.pecas, programas: state.programas,
                   roteiros: { '2026-03-19': INITIAL_ROTEIRO_QUI } };
    localStorage.setItem('roteiroApp', JSON.stringify(seed));
    state.roteiro = [];
  }
  // Load pecasDia for today
  const savedPD = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  state.pecasDia = savedPD.pecasDia?.[dateKey(today)] || [];
  renderWeekSelector();
  updateDateDisplay();
  renderAll();
}

/** Persiste o estado atual no localStorage: roteiro do dia, banco de peças e programas. Se o objeto API estiver disponível, também envia os dados ao servidor via HTTP PUT. Aciona o auto-backup silencioso se estiver configurado. */
/** Persiste o estado atual no localStorage: roteiro do dia, banco de peças e programas. Se o objeto API estiver disponível, também envia os dados ao servidor via HTTP PUT. Aciona o auto-backup silencioso se estiver configurado. */
function saveState() {
  const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  if (!saved.roteiros) saved.roteiros = {};
  saved.roteiros[dateKey(state.currentDate)] = state.roteiro;
  saved.pecas     = state.pecas;
  saved.programas = state.programas;
  localStorage.setItem('roteiroApp', JSON.stringify(saved));
  // Aciona backup automático silenciosamente se pasta estiver configurada
  if (typeof runAutoBackup === 'function' && _backupDirHandle) {
    runAutoBackup();
  }
}

// =====================================================
// TIME UTILS
// =====================================================
/** Converte string de tempo "HH:MM:SS" ou "H:MM:SS" em número total de segundos. Ex: "06:30:00" → 23400. */
function timeToSec(t) {
  if (!t) return 0;
  const parts = String(t).split(':').map(Number);
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return 0;
}

/** Converta segundos em string "HH:MM:SS" aplicando wrap de 24h (25:30 → 01:30). Usado na exibição dos horários IN/OUT no roteiro. */
function secToTime(s) {
  s = Math.max(0, Math.floor(s));
  // Wrap: roteiro runs 06:00:00 → 05:59:59 next day (30 hours window)
  // Display times past midnight as 00:xx:xx, 01:xx:xx, etc.
  const totalSec = s % 86400; // wrap to 24h clock for display
  const h   = Math.floor(totalSec/3600);
  const m   = Math.floor((totalSec%3600)/60);
  const sec = totalSec%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

/** Converte segundos em "HH:MM:SS" SEM wrap de 24h — pode retornar "25:30:00". Usado em cálculos internos onde o valor absoluto importa. */
function secToTimeRaw(s) {
  // Like secToTime but NO wrap — for internal math
  s = Math.max(0, Math.floor(s));
  const h   = Math.floor(s/3600);
  const m   = Math.floor((s%3600)/60);
  const sec = s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

/** Percorre todo o array state.roteiro acumulando os tempos e preenchendo os campos IN e OUT de cada item a partir de START_SECONDS (06:00:00). Deve ser chamada sempre que o roteiro for modificado. */
function recalcTimes() {
  let cur = START_SECONDS;
  state.roteiro = state.roteiro.map(item => {
    const dur     = timeToSec(item.tempo);
    const newItem = {...item, IN: secToTime(cur)};
    cur += dur;
    return newItem;
  });
}

/** Soma as durações de todos os itens do roteiro e retorna o total em segundos. Usado para exibir o horário de fim na barra de informações. */
function totalDuration() {
  return state.roteiro.reduce((acc, item) => acc + timeToSec(item.tempo), 0);
}

// =====================================================
// PANEL NAVIGATION
// =====================================================
/** Troca a aba visível: esconde todos os painéis (.panel) e abas (.tab), depois ativa o painel e a aba que correspondem ao id informado. */
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`panel-${id}`).classList.add('active');
  event.currentTarget.classList.add('active');
}

// =====================================================
// WEEK SELECTOR
// =====================================================
/** Redesenha os 7 botões de dias na barra lateral com nome curto e data. Destaca o dia selecionado e exibe ponto azul nos dias com roteiro salvo. */
function renderWeekSelector() {
  const dates   = getWeekDates(state.weekOffset);
  const todayKey = dateKey(nowForGrade());
  const curKey   = dateKey(state.currentDate);
  const saved    = JSON.parse(localStorage.getItem('roteiroApp') || '{}');

  // Week label (e.g. "17/03 – 23/03/2026")
  const first = dates[0], last = dates[6];
  const weekLabel = `${String(first.getDate()).padStart(2,'0')}/${String(first.getMonth()+1).padStart(2,'0')} – `
    + `${String(last.getDate()).padStart(2,'0')}/${String(last.getMonth()+1).padStart(2,'0')}/${last.getFullYear()}`;
  document.getElementById('week-label').textContent = weekLabel;

  const container = document.getElementById('day-selector');
  container.innerHTML = dates.map((d, i) => {
    const key      = dateKey(d);
    const isActive = key === curKey;
    const isToday  = key === todayKey;
    const hasData  = !!(saved.roteiros?.[key]?.length);
    const dd       = String(d.getDate()).padStart(2,'0');
    const mm       = String(d.getMonth()+1).padStart(2,'0');
    // i=0→Mon(1),1→Tue(2)...6→Sun(0) in JS getDay
    const jsDay    = i === 6 ? 0 : i + 1;
    return `<button class="day-btn ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}"
      onclick="selectDate('${key}')" title="${DAY_NAMES[jsDay]}, ${dd}/${mm}">
      <span class="day-btn-name">${DAY_SHORT[jsDay]}</span>
      <span class="day-btn-date">${dd}/${mm}</span>
      ${hasData ? '<span class="day-dot"></span>' : ''}
    </button>`;
  }).join('');
}

/** Avança (+1) ou recua (-1) a semana no seletor. Atualiza weekOffset, salva o roteiro atual e re-renderiza o seletor. */
function changeWeek(delta) {
  // Save current roteiro first
  saveState();
  state.weekOffset += delta;
  // Keep currentDate in sync: move it by the same delta
  const d = new Date(state.currentDate);
  d.setDate(d.getDate() + delta * 7);
  state.currentDate = d;
  // Load roteiro for the new date
  const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  state.roteiro = saved.roteiros?.[dateKey(d)] || [];
  renderWeekSelector();
  updateDateDisplay();
  renderRoteiro();
}

/** Chamada ao clicar em um botão de dia. Salva o roteiro atual, troca a data selecionada, carrega o roteiro do novo dia do localStorage (e do servidor se disponível) e re-renderiza tudo. */
function selectDate(key) {
  // Save current before switching
  saveState();
  // Parse key YYYY-MM-DD
  const [y, m, day] = key.split('-').map(Number);
  const d = new Date(y, m-1, day);
  d.setHours(0,0,0,0);
  state.currentDate = d;
  // Recalc weekOffset based on new date
  const today = nowForGrade(); today.setHours(0,0,0,0);
  const mondayToday = getMondayOf(today);
  const mondayNew   = getMondayOf(d);
  const diffMs = mondayNew - mondayToday;
  state.weekOffset = Math.round(diffMs / (7 * 86400000));
  // Load roteiro and pecasDia
  const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  state.roteiro = saved.roteiros?.[key] || [];
  state.pecasDia = saved.pecasDia?.[key] || [];
  renderWeekSelector();
  updateDateDisplay();
  renderRoteiro();
}

/** Atualiza o texto do dia e data exibido no topo da interface, ex: "Quinta, 26/03/2026". */
function updateDateDisplay() {
  const d  = state.currentDate;
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  const dow  = d.getDay(); // 0=Sun…6=Sat
  document.getElementById('date-display').textContent =
    `${DAY_NAMES[dow]}, ${dd}/${mm}/${yyyy}`;
}

// =====================================================
// RENDER ALL
// =====================================================
/** Chama em sequência todas as funções de renderização: roteiro, sidebar, painel de peças, programas e peças do dia. Usada após importações e ao trocar de data. */
function renderAll() {
  renderRoteiro();
  renderPecasSidebar();
  renderPecasPanel();
  renderProgramas();
  renderPecasDiaPanel();
  document.getElementById('badge-pecas').textContent = state.pecas.length;
  document.getElementById('badge-prog').textContent  = state.programas.length;
}

// =====================================================
// RENDER ROTEIRO
// =====================================================
/** Marca um aviso de divergência de horário (BL01) como "assumido" pelo usuário,
 *  ocultando-o do roteiro. Chamado pelo botão [assumir] no aviso. */
function ackGradeAviso(ackKey) {
  state.gradeAcked.add(ackKey);
  renderRoteiro();
}

/** Função principal de renderização. Recalcula os tempos, constrói o HTML da tabela linha por linha, verifica a grade para cada programa e injeta os break summaries ao final. */
function renderRoteiro() {
  recalcTimes();
  const tbody = document.getElementById('roteiro-tbody');
  const empty = document.getElementById('roteiro-empty');

  if (state.roteiro.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    document.getElementById('total-items').textContent = '0';
    document.getElementById('total-dur').textContent   = '00:00:00';
    renderStats();
    return;
  }
  empty.style.display = 'none';

  const grade = loadGrade();
  // Build accent-insensitive lookup map: normalizedKey → { key, time }
  {
    const _normK = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
    const map = {};
    Object.keys(grade || {}).forEach(k => { map[_normK(k)] = { key: k, time: grade[k] }; });
    renderRoteiro._gradeNorm = map;
  }
  renderRoteiro._occ = {}; // reset occurrence counters for this render pass

  // Pré-cálculo do "IN natural" — cumulativo IGNORANDO os __GAP__ injetados
  // para alinhar à grade. Isso revela o quanto falta/excede em relação ao
  // horário da Grade Semanal: se o usuário não preencher o gap, o programa
  // entra adiantado; se exceder, entra atrasado.
  const _naturalIn = new Array(state.roteiro.length);
  {
    let cur = START_SECONDS;
    state.roteiro.forEach((it, idx) => {
      _naturalIn[idx] = secToTime(cur);
      if (!it._gap) cur += timeToSec(it.tempo);
    });
  }

  tbody.innerHTML = state.roteiro.map((item, i) => {
    const isProgram  = item.type === 'RPRO';
    const isSlot     = item.type === '__SLOT__';

    // Aviso de início no PRIMEIRO BLOCO de cada programa (inclui programas
    // de bloco único, que naturalmente já são o primeiro bloco). Comparamos
    // o IN natural calculado contra o horário da Grade Semanal daquela
    // ocorrência do programa (1ª, 2ª, 3ª… exibição no dia). Apenas informativo.
    let gradeInfo = '';
    let rowExtra  = '';
    if (isProgram && item.IN && !/BL\s*0[2-5]/i.test(item.descricao || '')) {
      const baseTitle = baseProgramTitle(item.descricao);
      const _norm    = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
      const normBase = _norm(baseTitle);
      if (!renderRoteiro._occ) renderRoteiro._occ = {};
      const n = renderRoteiro._occ[normBase] || 0;
      const normKey = n === 0 ? normBase : `${normBase} [${n + 1}ª]`;

      // Avança o contador de ocorrência sempre que troca de programa
      // contíguo — é também a definição de "primeiro bloco" do programa.
      const prevItem = i > 0 ? state.roteiro[i - 1] : null;
      const prevBase = prevItem && prevItem.type === 'RPRO' ? _norm(baseProgramTitle(prevItem.descricao)) : null;
      const isFirstBlock = (prevBase !== normBase);
      if (isFirstBlock) {
        renderRoteiro._occ[normBase] = n + 1;
      }

      // Só o primeiro bloco recebe o aviso (cobre BL01 e blocos únicos).
      if (isFirstBlock) {
        const gradeEntry = REGRAS.mostrarGrade && renderRoteiro._gradeNorm ? renderRoteiro._gradeNorm[normKey] : null;
        const gradeKey   = gradeEntry ? gradeEntry.key : (n === 0 ? baseTitle : `${baseTitle} [${n + 1}ª]`);
        const gradeTime  = gradeEntry ? gradeEntry.time : grade[gradeKey];
        if (gradeTime) {
          const naturalInStr = _naturalIn[i] || item.IN;
          // Wrap 24h: grade e IN pós-meia-noite pertencem ao dia seguinte
          let gradeSec  = timeToSec(gradeTime);
          if (gradeSec  < START_SECONDS) gradeSec  += 86400;
          let actualSec = timeToSec(naturalInStr);
          if (actualSec < START_SECONDS) actualSec += 86400;
          const diff      = actualSec - gradeSec;     // >0 atrasado, <0 adiantado
          const absDiff   = Math.abs(diff);
          const tol       = (REGRAS.gradeTolerancia != null ? REGRAS.gradeTolerancia : 10);
          const fmt = s => {
            const m = Math.floor(s / 60), ss = s % 60;
            return m > 0 ? `${m}m ${String(ss).padStart(2,'0')}s` : `${ss}s`;
          };
          if (absDiff <= tol) {
            gradeInfo = `<span class="bl01-aviso bl01-aviso-ok" title="Grade: ${gradeTime} | IN: ${naturalInStr}">● no horário (grade ${gradeTime})</span>`;
          } else {
            // Chave estável para "lembrar" que o usuário já assumiu esta divergência
            // específica (código da peça + horário de grade + IN calculado).
            const ackKey = `${item.code}|${gradeTime}|${naturalInStr}`;
            if (!state.gradeAcked.has(ackKey)) {
              const ackBtn = `<button class="bl01-aviso-ack" onclick="event.stopPropagation(); ackGradeAviso('${ackKey.replace(/'/g, "\\'")}')" title="Estou ciente, quero continuar">assumir</button>`;
              if (diff < 0) {
                // IN antes do horário da grade → ainda faltam X para o início
                gradeInfo = `<span class="bl01-aviso bl01-aviso-early" title="Grade: ${gradeTime} | IN: ${naturalInStr}">▲ faltam ${fmt(absDiff)} para o início (grade ${gradeTime})${ackBtn}</span>`;
              } else {
                // IN depois do horário da grade → está com atraso no início
                gradeInfo = `<span class="bl01-aviso bl01-aviso-late" title="Grade: ${gradeTime} | IN: ${naturalInStr}">▼ está ${fmt(absDiff)} com atraso no início (grade ${gradeTime})${ackBtn}</span>`;
              }
              rowExtra = 'row-grade-warn';
            }
            // Se já foi assumido (ackKey está em state.gradeAcked), gradeInfo
            // permanece vazio e rowExtra não é aplicado — aviso fica oculto.
          }
        }
      }
    }



    if (isSlot) {
      return `<tr class="row-slot">
        <td class="col-seq" style="opacity:.3">${i+1}</td>
        <td colspan="5" style="font-size:11px;color:var(--border2);font-style:italic;padding:4px 12px">${escHtml(item.descricao)}</td>
        <td class="col-act"><div class="row-actions"><button class="act-btn" onclick="removeItem(${i})" title="Remover">✕</button></div></td>
      </tr>`;
    }

    const isSelected = state.selectedRow === i;

    return `<tr class="${isProgram ? 'row-program' : ''} ${rowExtra} ${isSelected ? 'row-selected' : ''}"
      draggable="true"
      onclick="selectRow(${i}, event)"
      ondragstart="dragStart(event,${i})"
      ondragover="dragOver(event,${i})"
      ondrop="dragDrop(event,${i})"
      ondragleave="dragLeave(event)">
      <td class="col-seq"><span class="drag-handle">⠿</span>${i+1}</td>
      <td class="col-code">${escHtml(item.code)}</td>
      <td class="col-desc">${escHtml(item.descricao)}${gradeInfo ? ' ' + gradeInfo : ''}</td>
      <td class="col-dur">${item.tempo}</td>
      <td class="col-in" style="${rowExtra ? 'color:var(--amber);font-weight:500' : ''}">${item.IN || '—'}</td>
      <td class="col-type"><span class="type-badge badge-${item.type}">${item.type}</span></td>
      <td class="col-act"><div class="row-actions">
        <button class="act-btn" onclick="editItemModal(${i})" title="Editar">✎</button>
        <button class="act-btn" onclick="removeItem(${i})" title="Remover">✕</button>
      </div></td>
    </tr>`;
  }).join('');

  // Inject break summary rows
  injectBreakSummaries();
  // Re-apply selected row highlight after re-render
  if (state.selectedRow !== null) {
    const rows = document.querySelectorAll('#roteiro-tbody tr:not(.break-summary-row)');
    if (rows[state.selectedRow]) rows[state.selectedRow].classList.add('row-selected');
    // Update button label
    const btn = document.querySelector('[onclick="addItemModal()"]');
    if (btn) btn.textContent = `+ Inserir após #${state.selectedRow + 1}`;
  }

  document.getElementById('total-items').textContent = state.roteiro.length;
  document.getElementById('total-dur').textContent   = secToTime(totalDuration());
  // Show end time (start 06:00:00 + total duration)
  const endSec = START_SECONDS + totalDuration();
  const endEl  = document.getElementById('end-time');
  if (endEl) endEl.textContent = secToTime(endSec);
  renderStats();
}

// Active stat filter (null = show all)
let _statFilter = null;

/** Ativa ou desativa o filtro visual na barra de estatísticas. Quando ativo, linhas do roteiro que não correspondem ao tipo ficam com opacidade reduzida. Clique duplo no mesmo tipo desativa o filtro. */
function toggleStatFilter(type) {
  _statFilter = (_statFilter === type) ? null : type;
  // Highlight active filter button
  document.querySelectorAll('.stat-badge').forEach(b => {
    b.classList.toggle('stat-badge-active', b.dataset.type === _statFilter);
  });
  // Re-render roteiro with filter applied
  renderRoteiroFiltered();
}

/** Aplica o filtro ativo (_statFilter) percorrendo as linhas do tbody e ajustando a opacidade das linhas que não correspondem ao tipo selecionado. */
function renderRoteiroFiltered() {
  // Apply visual filter: hide rows that don't match _statFilter
  const rows = document.querySelectorAll('#roteiro-tbody tr:not(.break-summary-row):not(.row-slot)');
  rows.forEach((tr, i) => {
    if (!_statFilter) { tr.style.opacity = ''; tr.style.display = ''; return; }
    // Find item type from the badge in the row
    const badge = tr.querySelector('.type-badge');
    const type  = badge ? badge.textContent.trim() : '';
    const match = type === _statFilter;
    tr.style.opacity = match ? '' : '0.18';
  });
}

/** Atualiza a barra de estatísticas com contadores clicáveis por tipo (PGM, ECHM, ECHE, EINT, RCOM, RPOL, EVNH). Clicar num tipo ativa o filtro visual correspondente. */
function renderStats() {
  const counts = {};
  state.roteiro.forEach(item => { counts[item.type] = (counts[item.type]||0)+1; });
  document.getElementById('stat-row').innerHTML = `
    <span class="stat-badge${_statFilter==='RPRO'?' stat-badge-active':''}" data-type="RPRO" onclick="toggleStatFilter('RPRO')" title="Clique para filtrar programas">PGM <strong>${counts['RPRO']||0}</strong></span>
    <span class="stat-badge${_statFilter==='ECHM'?' stat-badge-active':''}" data-type="ECHM" onclick="toggleStatFilter('ECHM')" title="Clique para filtrar chamadas manutenção">ECHM <strong>${counts['ECHM']||0}</strong></span>
    <span class="stat-badge${_statFilter==='ECHE'?' stat-badge-active':''}" data-type="ECHE" onclick="toggleStatFilter('ECHE')" title="Clique para filtrar chamadas quentes">ECHE <strong>${counts['ECHE']||0}</strong></span>
    <span class="stat-badge${_statFilter==='EINT'?' stat-badge-active':''}" data-type="EINT" onclick="toggleStatFilter('EINT')" title="Clique para filtrar interprogramas">EINT <strong>${counts['EINT']||0}</strong></span>
    <span class="stat-badge${_statFilter==='RCOM'?' stat-badge-active':''}" data-type="RCOM" onclick="toggleStatFilter('RCOM')" title="Clique para filtrar comerciais">RCOM <strong>${counts['RCOM']||0}</strong></span>
    <span class="stat-badge${_statFilter==='RPOL'?' stat-badge-active':''}" data-type="RPOL" onclick="toggleStatFilter('RPOL')" title="Clique para filtrar políticos">RPOL <strong>${counts['RPOL']||0}</strong></span>
    <span class="stat-badge${_statFilter==='EVNH'?' stat-badge-active':''}" data-type="EVNH" onclick="toggleStatFilter('EVNH')" title="Clique para filtrar vinhetas">EVNH <strong>${counts['EVNH']||0}</strong></span>
    <span style="margin-left:auto;font-size:11px;color:var(--muted)">${state.roteiro.length} itens · ${secToTime(totalDuration())}</span>
    ${_statFilter ? `<span class="stat-badge stat-clear" onclick="toggleStatFilter(null)">✕ limpar filtro</span>` : ''}
  `;
}

// =====================================================
// RENDER SIDEBAR PECAS
// =====================================================
/** Ativa ou desativa um filtro de tipo na barra lateral (sidebar). Controla quais tipos de peças aparecem na lista de busca lateral. */
function toggleFilter(type) {
  if (state.sidebarFilters.has(type)) state.sidebarFilters.delete(type);
  else state.sidebarFilters.add(type);
  document.querySelectorAll('#pecas-filters .filter-btn').forEach(btn => {
    btn.classList.toggle('active', state.sidebarFilters.has(btn.dataset.t));
  });
  renderPecasSidebar();
}

/** Renderiza a lista de peças na barra lateral aplicando filtros de busca, tipo e duração. Cada item é arrastável e clicável (duplo clique insere no roteiro na posição selecionada). */
function renderPecasSidebar() {
  const search   = document.getElementById('pecas-search-input').value.toLowerCase();
  const durMax   = document.getElementById('sidebar-dur-filter')?.value || '';
  const allItems = [...state.pecas,
    ...state.programas.map(p => ({...p, type:'RPRO', categoria:'PROGRAMAS'}))];
  const today = new Date();

  const filtered = allItems.filter(item => {
    if (state.sidebarFilters.size > 0 && !state.sidebarFilters.has(item.type)) return false;
    if (search && !item.descricao.toLowerCase().includes(search) &&
        !item.code.toLowerCase().includes(search) &&
        !(item.tempo || '').toLowerCase().includes(search)) return false;
    if (durMax) {
      const sec = timeToSec(item.tempo);
      if (sec > parseInt(durMax)) return false;
    }
    return true;
  });

  const list = document.getElementById('pecas-sidebar-list');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty"><p>Nenhuma peça encontrada.</p></div>';
    return;
  }

  // Cap DOM size for performance — mostrar no máximo 120 itens
  const MAX_VISIBLE = REGRAS.sidebarMaxItens || 120;
  const shown    = filtered.slice(0, MAX_VISIBLE);
  const overflow = filtered.length - shown.length;

  list.innerHTML = shown.map(item => {
    const expired = isExpired(item.validade, today);
    return `<div class="peca-item ${expired ? 'peca-expired':''}" draggable="true"
      ondragstart="dragFromSidebar(event,'${escAttr(item.code)}')"
      ondblclick="addToRoteiro('${escAttr(item.code)}')">
      <div class="peca-code">${escHtml(item.code)}</div>
      <div class="peca-name">${escHtml(item.descricao)}</div>
      <div class="peca-meta">
        <span class="peca-dur">${item.tempo}</span>
        <span class="type-badge badge-${item.type}">${item.type}</span>
        ${expired ? '<span style="font-size:9px;color:var(--red)">VENCIDA</span>' : ''}
      </div>
      ${item.obs ? `<div class="peca-obs">${escHtml(item.obs)}</div>` : ''}
    </div>`;
  }).join('') + (overflow > 0
    ? `<div style="padding:8px 12px;font-size:10px;color:var(--muted);text-align:center;border-top:1px solid var(--border)">
        +${overflow} peças — refine a busca para ver mais
       </div>`
    : '');
}

/** Verifica se uma data de validade (formato dd/mm/aa ou dd/mm/aaaa) já passou. Retorna true se a peça estiver vencida. */
function isExpired(val, today) {
  if (!val || val === 'None') return false;
  const m = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return false;
  let year = parseInt(m[3]);
  if (year < 100) year += 2000;
  const d = new Date(year, parseInt(m[2])-1, parseInt(m[1]));
  return d < today;
}

// =====================================================
// RENDER PECAS PANEL
// =====================================================
/** Ativa ou desativa um filtro de tipo no painel principal do Banco de Peças. Atualiza visualmente os botões de filtro e re-renderiza os cards. */
function togglePanelFilter(type) {
  if (state.panelFilters.has(type)) state.panelFilters.delete(type);
  else state.panelFilters.add(type);
  document.querySelectorAll('#pecas-panel-filters .filter-btn').forEach(btn => {
    btn.classList.toggle('active', state.panelFilters.has(btn.dataset.t));
  });
  renderPecasPanel();
}

/** Renderiza os cards do Banco de Peças com filtros de busca, tipo e duração aplicados. Cada card exibe botões de edição (✎) e exclusão (🗑). */
function renderPecasPanel() {
  const search = document.getElementById('pecas-panel-search').value.toLowerCase();
  const durMax = document.getElementById('panel-dur-filter')?.value || '';
  const today  = new Date();
  const filtered = state.pecas.filter(item => {
    if (state.panelFilters.size > 0 && !state.panelFilters.has(item.type)) return false;
    if (search && !item.descricao.toLowerCase().includes(search) &&
        !item.code.toLowerCase().includes(search) &&
        !(item.tempo || '').toLowerCase().includes(search)) return false;
    if (durMax && timeToSec(item.tempo) > parseInt(durMax)) return false;
    return true;
  });

  const grid = document.getElementById('pecas-panel-grid');
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty"><p>Nenhuma peça encontrada.</p></div>';
    return;
  }
  grid.innerHTML = filtered.map(item => {
    const idx     = state.pecas.indexOf(item);
    const expired = isExpired(item.validade, today);
    return `<div class="peca-card ${expired ? 'peca-expired':''}">
      <div class="peca-card-head">
        <div class="peca-card-name">${escHtml(item.descricao)}</div>
        <span class="type-badge badge-${item.type}" style="margin-left:8px;flex-shrink:0">${item.type}</span>
      </div>
      <div class="peca-card-meta">
        <span class="peca-card-code">${escHtml(item.code)}</span>
        <span class="peca-card-dur">${item.tempo}</span>
      </div>
      ${item.obs ? `<div class="peca-card-obs">${escHtml(item.obs)}</div>` : ''}
      ${item.validade && item.validade !== 'None'
        ? `<div class="peca-card-val">${expired?'⚠ ':''}Validade: ${escHtml(item.validade)}</div>` : ''}
      <div class="peca-card-actions">
        <button class="act-btn" onclick="editPecaModal(${idx})" title="Editar peça">✎</button>
        <button class="act-btn act-btn-danger" onclick="deletePeca(${idx})" title="Excluir peça">🗑</button>
      </div>
    </div>`;
  }).join('');
  document.getElementById('badge-pecas').textContent = state.pecas.length;
}

// =====================================================
// RENDER PROGRAMAS
// =====================================================
/** Renderiza a lista de programas do banco com filtro de busca. Exibe code, nome, duração e badge RPRO para cada programa. */
function renderProgramas() {
  const search   = document.getElementById('prog-search').value.toLowerCase();
  const filtered = state.programas.filter(p =>
    !search || p.descricao.toLowerCase().includes(search) ||
    p.code.toLowerCase().includes(search)
  );
  const list = document.getElementById('prog-list');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty"><p>Nenhum programa encontrado.</p></div>';
    return;
  }
  // Renderiza cada programa com botão de excluir individual
  // O botão chama deletePrograma(code) definido em banco-manager.js
  list.innerHTML = filtered.map(p => `
    <div class="prog-item">
      <span class="prog-item-code">${escHtml(p.code)}</span>
      <span class="prog-item-name">${escHtml(p.descricao)}</span>
      <span class="prog-item-dur">${p.tempo}</span>
      <span class="type-badge badge-RPRO" style="margin-left:8px">RPRO</span>
      <button class="act-btn act-btn-danger" style="margin-left:auto"
        onclick="deletePrograma('${escHtml(p.code)}')" title="Excluir programa">🗑</button>
    </div>`).join('');
  document.getElementById('badge-prog').textContent = state.programas.length;
}

// =====================================================
// DRAG AND DROP — ROTEIRO TABLE
// =====================================================
let dragIdx = null;

/** Inicia o arrasto de uma linha já existente no roteiro. Registra o índice de origem em dragIdx e define source="roteiro" no dataTransfer. */
function dragStart(e, i) {
  dragIdx = i;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('source', 'roteiro');
  e.currentTarget.classList.add('dragging');
}

/** Evento ao arrastar sobre uma linha alvo do roteiro. Previne o comportamento padrão e adiciona classe .drag-over para feedback visual. */
function dragOver(e, i) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

/** Remove a classe .drag-over da linha alvo quando o cursor sai dela durante o arrasto. */
function dragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

/** Finaliza o arrasto. Se source="roteiro": reordena o array (remove da origem, insere no destino). Se source="sidebar": busca a peça pelo code e insere na posição i. */
function dragDrop(e, i) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const source = e.dataTransfer.getData('source');

  if (source === 'roteiro' && dragIdx !== null && dragIdx !== i) {
    const item = state.roteiro.splice(dragIdx, 1)[0];
    state.roteiro.splice(i, 0, item);
    dragIdx = null;
    recalcTimes();
    saveState();
    renderRoteiro();
  } else if (source === 'sidebar') {
    const code = e.dataTransfer.getData('peca-code');
    const peca = findPeca(code);
    if (peca) {
      state.roteiro.splice(i, 0, {...peca});
      recalcTimes();
      saveState();
      renderRoteiro();
    }
  }
}

// =====================================================
// DRAG FROM SIDEBAR
// =====================================================
/** Inicia o arrasto de uma peça a partir da barra lateral ou aba Peças do Dia. Define source="sidebar" e peca-code no dataTransfer para ser consumido por dragDrop(). */
function dragFromSidebar(e, code) {
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('source', 'sidebar');
  e.dataTransfer.setData('peca-code', code);
}

// =====================================================
// ADD / REMOVE ITEMS
// =====================================================
/** Busca a peça pelo code e a insere no roteiro. Se selectedRow não for null, insere APÓS a linha selecionada; caso contrário, adiciona ao final. Atualiza selectedRow para o novo item inserido. */
function addToRoteiro(code) {
  const peca = findPeca(code);
  if (!peca) return;
  if (state.selectedRow !== null) {
    // Insert AFTER the selected row
    const insertAt = state.selectedRow + 1;
    state.roteiro.splice(insertAt, 0, {...peca});
    state.selectedRow = insertAt; // move selection to the new item
  } else {
    state.roteiro.push({...peca});
  }
  recalcTimes();
  saveState();
  renderRoteiro();
  renderWeekSelector();
  toast(`"${peca.descricao.substring(0,40)}" adicionada`, 'success');
}

/** Seleciona ou deseleciona uma linha do roteiro como cursor de inserção. A linha selecionada fica com fundo azul e o botão de adicionar muda para "+ Inserir após #N". */
function selectRow(i, event) {
  // Don't select when clicking action buttons or drag handle
  if (event.target.closest('.act-btn') || event.target.closest('.drag-handle')) return;
  state.selectedRow = (state.selectedRow === i) ? null : i;
  // Highlight visually without full re-render
  document.querySelectorAll('#roteiro-tbody tr').forEach((tr, idx) => {
    tr.classList.toggle('row-selected', idx === state.selectedRow);
  });
  // Update "+ Adicionar" button label to show insert position
  const btn = document.querySelector('[onclick="addItemModal()"]');
  if (btn) {
    btn.textContent = state.selectedRow !== null
      ? `+ Inserir após #${state.selectedRow + 1}`
      : '+ Adicionar peça';
  }
}

/** Remove o item no índice i do roteiro. Ajusta selectedRow para compensar o índice removido e recalcula os tempos. */
function removeItem(i) {
  state.roteiro.splice(i, 1);
  if (state.selectedRow !== null) {
    if (state.selectedRow >= i) state.selectedRow = Math.max(0, state.selectedRow - 1);
    if (state.roteiro.length === 0) state.selectedRow = null;
  }
  recalcTimes();
  saveState();
  renderRoteiro();
  renderWeekSelector();
}

// Inject break duration summary rows between program blocks
/** Injeta linhas de resumo de break (▶ break HH:MM:SS) entre blocos de programas após a renderização do tbody. Detecta transições RPRO → não-RPRO → RPRO e calcula a duração total de cada intervalo. */
function injectBreakSummaries() {
  const rows = document.querySelectorAll('#roteiro-tbody tr');
  if (!rows.length) return;

  // Walk the roteiro, find transitions between RPRO blocks of same program
  // and between programs. Add a summary row after the break.
  // We work in reverse to keep indices stable.
  const toInsert = []; // { afterRowIndex, html }

  let breakStart = null;
  let breakSec   = 0;
  let inBreak    = false;

  for (let i = 0; i < state.roteiro.length; i++) {
    const item = state.roteiro[i];
    const isProg = item.type === 'RPRO';

    if (isProg && inBreak) {
      // End of break — compute total
      if (breakSec > 0) {
        toInsert.push({ afterRowIndex: breakStart - 1, insertBeforeIndex: i, durSec: breakSec });
      }
      inBreak = false;
      breakSec = 0;
    }

    if (!isProg && i > 0 && state.roteiro[i-1].type === 'RPRO') {
      // Start of a break after a program block
      inBreak    = true;
      breakStart = i;
      breakSec   = 0;
    }

    if (inBreak) {
      breakSec += timeToSec(item.tempo);
    }
  }

  // Insert summary rows in reverse
  const allRows = document.querySelectorAll('#roteiro-tbody tr');
  for (const { afterRowIndex, insertBeforeIndex, durSec } of toInsert.reverse()) {
    const targetRow = allRows[insertBeforeIndex];
    if (!targetRow || durSec === 0) continue;
    const sumRow = document.createElement('tr');
    sumRow.className = 'break-summary-row';
    sumRow.innerHTML = `
      <td colspan="7">
        <div class="break-summary">
          <span class="break-label">▶ break</span>
          <span class="break-dur">${secToTime(durSec)}</span>
        </div>
      </td>`;
    targetRow.parentNode.insertBefore(sumRow, targetRow);
  }
}

/** Limpa todo o roteiro do dia atual após confirmação do usuário. Reseta selectedRow e re-renderiza. */
function clearRoteiro() {
  if (!confirm('Limpar todo o roteiro do dia?')) return;
  state.roteiro = [];
  saveState();
  renderRoteiro();
  renderWeekSelector();
}

/** Busca uma peça pelo code nos dois bancos: state.pecas e state.programas. Retorna o primeiro resultado encontrado ou null. */
function findPeca(code) {
  return state.pecas.find(p => p.code === code)
      || state.programas.find(p => p.code === code)
      || null;
}

// =====================================================
// MODAL ADD ITEM
// =====================================================
let modalAll = [];

/** Abre o modal de edição preenchendo os campos com os valores do item no índice idx do roteiro (code, descrição, duração, tipo, mídia). */
function editItemModal(idx) {
  const item = state.roteiro[idx];
  if (!item) return;
  document.getElementById('ei-idx').value   = idx;
  document.getElementById('ei-code').value  = item.code || '';
  document.getElementById('ei-desc').value  = item.descricao || '';
  document.getElementById('ei-dur').value   = item.tempo || '00:01:00';
  document.getElementById('ei-type').value  = item.type || 'EVNH';
  document.getElementById('ei-midia').value = item.midia || '0OMN';
  document.getElementById('modal-edit-item').style.display = 'flex';
}

/** Salva as alterações feitas no modal de edição de volta ao item correspondente em state.roteiro. Recalcula os tempos após a alteração. */
function saveEditItem() {
  const idx  = parseInt(document.getElementById('ei-idx').value);
  const item = state.roteiro[idx];
  if (!item) return;
  item.code      = document.getElementById('ei-code').value.trim();
  item.descricao = document.getElementById('ei-desc').value.trim();
  item.tempo     = document.getElementById('ei-dur').value.trim() || '00:01:00';
  item.type      = document.getElementById('ei-type').value;
  item.midia     = document.getElementById('ei-midia').value.trim() || '0OMN';
  recalcTimes();
  saveState();
  renderRoteiro();
  closeModal('modal-edit-item');
  toast('Peça atualizada', 'success');
}

/** Abre o modal de busca e inserção de peças. Monta a lista completa de peças e programas e atualiza o título com a posição de inserção atual (linha selecionada). */
function addItemModal() {
  modalAll = [...state.pecas,
    ...state.programas.map(p => ({...p, type:'RPRO', categoria:'PROGRAMAS'}))];
  filterModalList();
  const title = document.getElementById('modal-add-title');
  if (title) {
    title.textContent = state.selectedRow !== null
      ? `Inserir após linha #${state.selectedRow + 1}`
      : 'Adicionar ao roteiro';
  }
  document.getElementById('modal-add').style.display = 'flex';
  setTimeout(() => document.getElementById('modal-search').focus(), 50);
}

/** Filtra a lista do modal de inserção em tempo real: aplica busca textual, filtro por tipo e filtro por duração máxima. Exibe até 80 resultados. */
function filterModalList() {
  const search  = document.getElementById('modal-search').value.toLowerCase();
  const typeF   = document.getElementById('modal-type-filter').value;
  const durMax  = document.getElementById('modal-dur-filter').value; // seconds max, '' = no limit

  const filtered = modalAll.filter(item => {
    if (typeF && item.type !== typeF) return false;
    if (durMax) {
      const sec = timeToSec(item.tempo);
      if (sec > parseInt(durMax)) return false;
    }
    if (search && !item.descricao.toLowerCase().includes(search) &&
        !item.code.toLowerCase().includes(search)) return false;
    return true;
  }).slice(0, 80);

  document.getElementById('modal-count').textContent =
    filtered.length < 80 ? `${filtered.length} peças` : `${filtered.length}+ peças`;

  document.getElementById('modal-list').innerHTML = filtered.length === 0
    ? `<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">Nenhuma peça encontrada</div>`
    : filtered.map(item => `
    <div onclick="addToRoteiro('${escAttr(item.code)}');closeModal('modal-add')"
      style="padding:7px 12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;transition:background .1s"
      onmouseover="this.style.background='var(--bg3)'"
      onmouseout="this.style.background=''">
      <span class="type-badge badge-${item.type}" style="flex-shrink:0">${item.type}</span>
      <span style="flex:1;font-size:12px">${escHtml(item.descricao)}</span>
      <span style="font-family:var(--mono);font-size:10px;color:var(--muted);flex-shrink:0">${item.tempo}</span>
    </div>`).join('');
}

/** Fecha o modal com o id informado definindo display:none. Funciona para qualquer modal do sistema. */
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// =====================================================
// MODAL NOVA PEÇA
// =====================================================
/** Abre o modal de cadastro de nova peça ao banco permanente, limpando todos os campos. */
function addPecaModal() {
  ['np-code','np-desc','np-dur','np-val','np-obs'].forEach(id =>
    document.getElementById(id).value = '');
  document.getElementById('np-type').value = 'ECHM';
  document.getElementById('modal-new-peca').style.display = 'flex';
}

/** Valida os campos e adiciona a nova peça a state.pecas, persistindo no localStorage e atualizando a interface. */
function saveNewPeca() {
  const code = document.getElementById('np-code').value.trim();
  const desc = document.getElementById('np-desc').value.trim();
  const dur  = document.getElementById('np-dur').value.trim() || '00:01:00';
  const type = document.getElementById('np-type').value;
  const val  = document.getElementById('np-val').value.trim();
  const obs  = document.getElementById('np-obs').value.trim();
  if (!code || !desc) { toast('Code e descrição são obrigatórios', 'error'); return; }
  state.pecas.push({ code, descricao: sanitizeText(desc), tempo: dur, midia: '0OMN',
                     type, validade: val, obs: sanitizeText(obs), categoria: 'MANUAL' });
  saveState();
  renderPecasSidebar();
  renderPecasPanel();
  document.getElementById('badge-pecas').textContent = state.pecas.length;
  closeModal('modal-new-peca');
  toast('Peça adicionada', 'success');
}

// ── Editar peça do banco ─────────────────────────────────────────────────────
/** Abre o modal de edição de peça do banco preenchendo os campos com os valores da peça no índice idx de state.pecas. */
function editPecaModal(idx) {
  const item = state.pecas[idx];
  if (!item) return;
  document.getElementById('ep-idx').value  = idx;
  document.getElementById('ep-code').value = item.code || '';
  document.getElementById('ep-desc').value = item.descricao || '';
  document.getElementById('ep-dur').value  = item.tempo || '00:01:00';
  document.getElementById('ep-type').value = item.type || 'ECHM';
  document.getElementById('ep-val').value  = item.validade || '';
  document.getElementById('ep-obs').value  = item.obs || '';
  document.getElementById('modal-edit-peca').style.display = 'flex';
  setTimeout(() => document.getElementById('ep-desc').focus(), 50);
}

/** Salva as alterações do modal de edição de peça diretamente no objeto em state.pecas e persiste no localStorage. */
function saveEditPeca() {
  const idx  = parseInt(document.getElementById('ep-idx').value);
  const item = state.pecas[idx];
  if (!item) return;
  const code = document.getElementById('ep-code').value.trim();
  const desc = document.getElementById('ep-desc').value.trim();
  if (!code || !desc) { toast('Code e descrição são obrigatórios', 'error'); return; }
  item.code      = code;
  item.descricao = sanitizeText(desc);
  item.tempo     = document.getElementById('ep-dur').value.trim() || '00:01:00';
  item.type      = document.getElementById('ep-type').value;
  item.validade  = document.getElementById('ep-val').value.trim();
  item.obs       = sanitizeText(document.getElementById('ep-obs').value.trim());
  saveState();
  renderPecasSidebar();
  renderPecasPanel();
  closeModal('modal-edit-peca');
  toast(`"${desc.substring(0,35)}" atualizada`, 'success');
}

// ── Excluir peça do banco ────────────────────────────────────────────────────
/** Remove a peça no índice idx de state.pecas após confirmação do usuário. A operação não pode ser desfeita. */
function deletePeca(idx) {
  const item = state.pecas[idx];
  if (!item) return;
  if (!confirm(`Excluir "${item.descricao.substring(0,50)}" do banco de peças?\n\nEsta ação não pode ser desfeita.`)) return;
  state.pecas.splice(idx, 1);
  saveState();
  renderPecasSidebar();
  renderPecasPanel();
  toast('Peça excluída', 'success');
}

// ── Importar banco (XLSX ou JSON) ────────────────────────────────────────────
/** Handler do input de arquivo para importação do banco de peças. Aceita JSON (array ou {pecas:[...]}) e XLSX. Detecta colunas automaticamente pelo cabeçalho. Codes já existentes são ignorados (merge sem duplicatas). */
function importBanco(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'json') {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        // Accept array directly or {pecas: [...]}
        const arr = Array.isArray(data) ? data : (data.pecas || []);
        if (!arr.length) { toast('Nenhuma peça encontrada no JSON', 'error'); return; }
        const before = state.pecas.length;
        // Merge: skip codes already in bank
        const existing = new Set(state.pecas.map(p => p.code));
        let added = 0;
        arr.forEach(p => {
          if (p.code && p.descricao) {
            if (!existing.has(p.code)) {
              state.pecas.push({
                code: p.code, descricao: sanitizeText(p.descricao),
                tempo: p.tempo || '00:01:00', midia: p.midia || '0OMN',
                type: p.type || 'EVNH', validade: p.validade || '',
                obs: sanitizeText(p.obs || ''), categoria: p.categoria || 'IMPORTADO'
              });
              existing.add(p.code);
              added++;
            }
          }
        });
        saveState(); renderPecasSidebar(); renderPecasPanel();
        toast(`${added} peças importadas do JSON (${arr.length - added} ignoradas — já existiam)`, 'success');
      } catch { toast('Erro ao ler o JSON', 'error'); }
    };
    reader.readAsText(file);
    return;
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const XLSX = window.XLSX;
        const wb   = XLSX.read(ev.target.result, { type:'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        if (rows.length < 2) { toast('Planilha vazia', 'error'); return; }

        // Detect columns by header row
        const headers = rows[0].map(h => String(h||'').trim().toUpperCase());
        const ci = {
          code:  headers.findIndex(h => h.includes('CODE') || h === 'CODES' || h === 'COD'),
          desc:  headers.findIndex(h => h.includes('DESC') || h.includes('NOME') || h.includes('ESPELHO')),
          tempo: headers.findIndex(h => h.includes('TEMPO') || h.includes('DUR')),
          type:  headers.findIndex(h => h === 'TYPE' || h === 'TIPO'),
          val:   headers.findIndex(h => h.includes('VALID')),
          obs:   headers.findIndex(h => h === 'OBS' || h.includes('OBSERV')),
        };
        if (ci.code < 0 || ci.desc < 0) { toast('Planilha: colunas CODE e DESCRIÇÃO não encontradas na linha 1', 'error'); return; }

        const existing = new Set(state.pecas.map(p => p.code));
        let added = 0, skipped = 0;
        for (let i = 1; i < rows.length; i++) {
          const r    = rows[i];
          const code = String(r[ci.code]||'').trim();
          const desc = String(r[ci.desc]||'').trim();
          if (!code || !desc) continue;
          if (existing.has(code)) { skipped++; continue; }
          let tempo = ci.tempo >= 0 ? String(r[ci.tempo]||'').trim() : '00:01:00';
          // Handle numeric time (fraction of day from Excel)
          if (!isNaN(tempo) && tempo !== '') {
            const secs = Math.round(parseFloat(tempo) * 86400);
            const hh = String(Math.floor(secs/3600)).padStart(2,'0');
            const mm2 = String(Math.floor((secs%3600)/60)).padStart(2,'0');
            const ss = String(secs%60).padStart(2,'0');
            tempo = `${hh}:${mm2}:${ss}`;
          }
          if (!/^\d{2}:\d{2}:\d{2}$/.test(tempo)) tempo = '00:01:00';
          state.pecas.push({
            code, descricao: sanitizeText(desc), tempo, midia: '0OMN',
            type:     ci.type >= 0 ? String(r[ci.type]||'EVNH').trim() : 'EVNH',
            validade: ci.val  >= 0 ? String(r[ci.val] ||'').trim()     : '',
            obs:      sanitizeText(ci.obs  >= 0 ? String(r[ci.obs] ||'').trim() : ''),
            categoria: 'IMPORTADO',
          });
          existing.add(code);
          added++;
        }
        saveState(); renderPecasSidebar(); renderPecasPanel();
        toast(`${added} peças importadas do XLSX (${skipped} ignoradas — já existiam)`, 'success');
      } catch(err) { toast('Erro ao ler o XLSX: ' + err.message, 'error'); }
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  toast('Formato não suportado — use .xlsx ou .json', 'error');
}

// ── Exportar banco como XLSX ─────────────────────────────────────────────────
/** Exporta o banco de peças completo como arquivo .xlsx com colunas CODE, DESCRIÇÃO, TEMPO, TYPE, VALIDADE, OBS, MÍDIA. Nome do arquivo inclui a data atual. */
function exportBancoXLSX() {
  const XLSX = window.XLSX;
  if (!XLSX) { toast('SheetJS não carregado', 'error'); return; }
  if (!state.pecas.length) { toast('Banco de peças vazio', 'error'); return; }

  const sHdr = { font:{bold:true,color:{rgb:'FFFFFF'}}, fill:{fgColor:{rgb:'1E2130'}}, alignment:{horizontal:'center'} };
  const wb   = XLSX.utils.book_new();
  const ws   = {};

  // Headers
  const cols = ['CODE','DESCRIÇÃO','TEMPO','TYPE','VALIDADE','OBS','MÍDIA'];
  cols.forEach((h, c) => {
    const ref = XLSX.utils.encode_cell({r:0, c});
    ws[ref] = { t:'s', v:h, s:sHdr };
  });

  // Data
  state.pecas.forEach((item, i) => {
    const r   = i + 1;
    const row = [item.code, item.descricao, item.tempo, item.type,
                 item.validade||'', item.obs||'', item.midia||'0OMN'];
    row.forEach((v, c) => {
      ws[XLSX.utils.encode_cell({r, c})] = { t:'s', v:String(v||'') };
    });
  });

  ws['!ref']  = XLSX.utils.encode_range({s:{r:0,c:0}, e:{r:state.pecas.length, c:cols.length-1}});
  ws['!cols'] = [{wch:16},{wch:60},{wch:10},{wch:6},{wch:12},{wch:30},{wch:6}];
  XLSX.utils.book_append_sheet(wb, ws, 'BANCO_PECAS');

  const d    = new Date();
  const date = `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`;
  XLSX.writeFile(wb, `BANCO_PECAS_${date}.xlsx`);
  toast(`Banco exportado — ${state.pecas.length} peças`, 'success');
}

// ── Exportar banco como JSON ─────────────────────────────────────────────────
/** Exporta o banco de peças completo como arquivo .json para backup ou transferência entre máquinas. */
function exportBancoJSON() {
  if (!state.pecas.length) { toast('Banco de peças vazio', 'error'); return; }
  const data = JSON.stringify({ pecas: state.pecas, exportado: new Date().toISOString() }, null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const d    = new Date();
  const date = `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`;
  a.href = url; a.download = `BANCO_PECAS_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`JSON exportado — ${state.pecas.length} peças`, 'success');
}

// =====================================================
// MODAL NOVO PROGRAMA
// =====================================================
/** Abre o modal de cadastro de novo programa ao banco permanente. */
function addProgModal() {
  ['npp-code','npp-desc','npp-dur'].forEach(id =>
    document.getElementById(id).value = '');
  document.getElementById('modal-new-prog').style.display = 'flex';
}

/** Valida os campos e adiciona o novo programa a state.programas, persistindo no localStorage. */
function saveNewProg() {
  const code = document.getElementById('npp-code').value.trim();
  const desc = document.getElementById('npp-desc').value.trim();
  const dur  = document.getElementById('npp-dur').value.trim() || '00:25:00';
  if (!code || !desc) { toast('Code e descrição são obrigatórios', 'error'); return; }
  state.programas.push({ code, descricao: sanitizeText(desc), tempo: dur, midia: '0OMN', type: 'RPRO' });
  saveState();
  renderProgramas();
  document.getElementById('badge-prog').textContent = state.programas.length;
  closeModal('modal-new-prog');
  toast('Programa adicionado', 'success');
}

// =====================================================
// IMPORT / EXPORT
// =====================================================
/** Dispara o clique no input de arquivo oculto #file-import para abrir o seletor de arquivo de importação. */
function importData() {
  document.getElementById('file-import').click();
}

/** Handler principal do input de arquivo de importação. Remove BOM, pula linhas vazias do topo, detecta o tipo pelo conteúdo e roteia para a função correta: importJSON(), importNotionCSV() ou importPecasDiaCSV(). */
function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(ev) {
    const text = ev.target.result;

    // Strip any BOM variant and leading whitespace
    const clean = text
      .replace(/^[\uFEFF\uFFFE\u0000]+/, '')
      .trimStart();

    // JSON backup
    if (clean.trimStart().startsWith('{')) {
      importJSON(clean);
      return;
    }

    const lines = clean.split(/\r?\n/);

    // Find the header line — skip empty/blank lines at the top
    // GSheets sometimes exports with empty rows before the actual header
    let headerLine = '';
    let headerIdx  = 0;
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li].replace(/[,"\t;]/g, '').trim();
      if (l.length > 0) {         // first non-empty line
        headerLine = lines[li];
        headerIdx  = li;
        break;
      }
    }

    if (!headerLine) {
      toast('Arquivo vazio ou sem conteúdo reconhecível.', 'error');
      return;
    }

    const stripped = headerLine.replace(/^"?/, '').toUpperCase();

    // Detect separator from first real line
    const sepMatch = headerLine.match(/^"?[^",;\t]+"?([,;\t])/);
    const sep = sepMatch ? sepMatch[1] : ',';

    // Planilha de Peças de Inserção — starts with "PEÇAS EM EXIBIÇÃO" or day name
    const DIAS = ['SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO','DOMINGO','LIMPA'];
    const isPecasInserção =
      stripped.startsWith('PEÇAS EM EXIB') ||
      stripped.startsWith('CANAL EDUCAÇ') ||
      DIAS.some(d => stripped.startsWith(d));

    if (isPecasInserção) {
      // Route to Peças do Dia CSV import
      importPecasDiaCSV(lines, sep);
      return;
    }

    // Notion programs CSV — must start with CODE
    if (!stripped.startsWith('CODE')) {
      const preview = headerLine.substring(0, 100);
      toast('Formato não reconhecido. Primeira linha: ' + preview, 'error');
      return;
    }

    const textFromHeader = lines.slice(headerIdx).join('\n');
    importNotionCSV(textFromHeader, sep);
  };

  reader.readAsText(file, 'utf-8');
  e.target.value = '';
}

/** Handler do input de arquivo para importação da planilha de peças do dia. Roteia para importPecasDiaExcel() do módulo pecas_dia.js. */
function handlePecasDiaImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  importPecasDiaExcel(file);
  e.target.value = '';
}

/** Restaura um backup JSON completo. Carrega roteiros, banco de peças, programas e grade do arquivo. Exibe confirmação com contagens antes de sobrescrever os dados atuais. */
function importJSON(text) {
  try {
    const data = JSON.parse(text);
    if (data.pecas)     state.pecas     = data.pecas;
    if (data.programas) state.programas = data.programas;
    // Mescla todos os roteiros do backup no banco automaticamente
    if (data.roteiros) {
      Object.values(data.roteiros).forEach(rot => mergeBancoFromRoteiro(rot));
    }
    if (data.roteiros?.[dateKey(state.currentDate)]) {
      state.roteiro = data.roteiros[dateKey(state.currentDate)];
    }
    saveState();
    renderAll();
    renderWeekSelector();
    toast('Dados importados com sucesso', 'success');
  } catch(err) {
    toast('Erro ao importar JSON: arquivo inválido', 'error');
  }
}

/**
 * Mescla itens de um roteiro no banco de peças permanente (state.pecas / state.programas).
 * Percorre o array e adiciona ao banco os itens que ainda não existem (por code).
 * RPRO → state.programas. Demais tipos → state.pecas.
 * Chamada automaticamente após importações para construir o banco progressivamente.
 * Retorna { addedPecas, addedProgramas } com contagens de itens adicionados.
 */
function mergeBancoFromRoteiro(items) {
  if (!items || !items.length) return { addedPecas: 0, addedProgramas: 0 };
  const existPecas = new Set(state.pecas.map(p => p.code));
  const existProgs = new Set(state.programas.map(p => p.code));
  let addedP = 0, addedR = 0;
  items.forEach(item => {
    if (!item.code || item.type === '__SLOT__' || item._fixa) return;
    if (item.type === 'RPRO') {
      if (!existProgs.has(item.code)) {
        state.programas.push({ code:item.code, descricao:item.descricao,
          tempo:item.tempo, midia:item.midia||'0OMN', type:'RPRO',
          validade:'', obs:'', categoria:'AUTO' });
        existProgs.add(item.code); addedR++;
      }
    } else {
      if (!existPecas.has(item.code)) {
        state.pecas.push({ code:item.code, descricao:item.descricao,
          tempo:item.tempo, midia:item.midia||'0OMN', type:item.type,
          validade:'', obs:'', categoria:'AUTO' });
        existPecas.add(item.code); addedP++;
      }
    }
  });
  return { addedPecas: addedP, addedProgramas: addedR };
}

// =====================================================
// VH LOOKUP TABLES
// =====================================================
/**
 * Retorna o objeto VH Classificação Indicativa a partir das REGRAS.
 * Se vhClassificacao.ativo=false, retorna null e a VH não é inserida.
 */
function getVhClassificacao() {
  const cfg = REGRAS.vhClassificacao || {};
  if (cfg.ativo === false) return null;
  return { code: cfg.code || '85283', descricao: cfg.descricao || 'VH CLASSIFICAÇAO INDICATIVA LIVRE',
           tempo: cfg.tempo || '00:00:06', midia: '0OMN', type: 'EVNH' };
}

/**
 * Retorna o objeto VH Assinatura para o programa informado,
 * usando as keywords e os codes configurados em REGRAS.
 * Se a assinatura do tipo correspondente estiver desativada, retorna null.
 */
function getAssinatura(desc) {
  const u = desc.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const infKw = (REGRAS.vhAssinaturaInfantilKeywords || '').split(',').map(k=>k.trim()).filter(Boolean);
  const adKw  = (REGRAS.vhAssinaturaAdultoKeywords   || '').split(',').map(k=>k.trim()).filter(Boolean);

  const cfgInf = REGRAS.vhAssinaturaInfantil || {};
  const cfgJov = REGRAS.vhAssinaturaJovem    || {};
  const cfgAdt = REGRAS.vhAssinaturaAdulto   || {};

  let cfg, defaultCode, defaultDesc;
  if (infKw.some(k => u.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()))) {
    cfg = cfgInf; defaultCode = '85331'; defaultDesc = 'ASSINATURA_INFANTIL';
  } else if (adKw.some(k => u.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()))) {
    cfg = cfgAdt; defaultCode = '85332'; defaultDesc = 'ASSINATURA_ADULTO';
  } else {
    cfg = cfgJov; defaultCode = '85330'; defaultDesc = 'ASSINATURA_JOVEM';
  }

  if (cfg.ativo === false) return null;
  return { code: cfg.code || defaultCode, descricao: cfg.descricao || defaultDesc,
           tempo: cfg.tempo || '00:00:05', midia: '0OMN', type: 'EVNH' };
}

const VH_SEGUIR_MAP = [
  { code: '86482', descricao: 'VH A SEGUIR PALALOOS',                          tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['PALALOOS'] },
  { code: '85176', descricao: 'VH A SEGUIR PLANETA PALAVRA',                   tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['PLANETA PALAVRA', 'PLANETA PALAVRAS'] },
  { code: '88960', descricao: 'VH A SEGUIR SONHOS E SAPATILHAS',               tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['SONHOS E SAPATILHAS'] },
  { code: '88962', descricao: 'VH A SEGUIR SOL EM DO RE MI',                   tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['SOL EM DO RE MI'] },
  { code: '85172', descricao: 'VH A SEGUIR IGARAPE MAGICO',                    tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['IGARAPE MAGICO'] },
  { code: '87770', descricao: 'VH A SEGUIR PASSADO DA HORA',                   tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['PASSADO DA HORA'] },
  { code: '85202', descricao: 'VH A SEGUIR SE LIGA NA EDUCAÇÃO',               tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['SE LIGA NA EDUCACAO', 'SE LIGA NA EDUCAÇÃO'] },
  { code: '88967', descricao: 'VH A SEGUIR PORTUGUES DAQUI PORTUGUES DE LA',   tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['PORTUGUES DAQUI'] },
  { code: '88972', descricao: 'VH A SEGUIR HUMANIDADES',                       tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['HUMANIDADES', 'PROGRAMA HUMANIDADES'] },
  { code: '86680', descricao: 'VH A SEGUIR VIDA DE MERENDEIRA',                tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['VIDA DE MERENDEIRA'] },
  { code: '88963', descricao: 'VH A SEGUIR ME LIGA NA LATA',                   tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['ME LIGA NA LATA'] },
  { code: '85173', descricao: 'VH A SEGUIR MANUAL DE SOBREVIVENCIA DA LITERATURA', tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['MANUAL DE SOBREVIVENCIA', 'LITERATURA BRASILEIRA'] },
  { code: '88320', descricao: 'VH A SEGUIR CAMINHOS DA REPORTAGEM',            tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['CAMINHOS DA REPORTAGEM'] },
  { code: '88976', descricao: 'VH A SEGUIR ESCOLA QUE PROTEGE',                tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['ESCOLA QUE PROTEGE'] },
  { code: '85247', descricao: 'VH A SEGUIR FAROIS DO BRASIL',                  tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['FAROIS DO BRASIL'] },
  { code: '89036', descricao: 'VH A SEGUIR CINCO MULHERES',                    tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['CINCO MULHERES'] },
  { code: '89034', descricao: 'VH A SEGUIR SAL A GOSTO',                       tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['SAL A GOSTO'] },
  { code: '85262', descricao: 'VH A SEGUIR SEMENTES DA EDUCACAO',              tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['SEMENTES DA EDUCACAO'] },
  { code: '85249', descricao: 'VH A SEGUIR FILHOS DA LIBERDADE',               tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['FILHOS DA LIBERDADE'] },
  { code: '87511', descricao: 'VH A SEGUIR OLHARES DO NORTE',                  tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['OLHARES DO NORTE'] },
  { code: '88976', descricao: 'VH A SEGUIR ESCOLA QUE PROTEGE',                tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['ESCOLA QUE PROTEGE'] },
];

const VH_ASSISTINDO_MAP = [
  { code: '88973', descricao: 'VH VC ESTA ASSISTINDO HUMANIDADES',                       tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['HUMANIDADES', 'PROGRAMA HUMANIDADES'] },
  { code: '85179', descricao: 'VH VC ESTA ASSISTINDO MANUAL DE SOBREVIVÊNCIA DA LITERATURA', tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['MANUAL DE SOBREVIVENCIA', 'LITERATURA BRASILEIRA'] },
  { code: '88964', descricao: 'VH VC ESTA ASSISTINDO ME LIGA NA LATA',                   tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['ME LIGA NA LATA'] },
  { code: '89037', descricao: 'VH VC ESTA ASSISTINDO CINCO MULHERES',                    tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['CINCO MULHERES'] },
  { code: '89035', descricao: 'VH VC ESTA ASSISTINDO SAL A GOSTO',                       tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['SAL A GOSTO'] },
  { code: '85272', descricao: 'VH VC ESTA ASSISTINDO SEMENTES DA EDUCACAO',              tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['SEMENTES DA EDUCACAO'] },
  { code: '85269', descricao: 'VH VC ESTA ASSISTINDO FILHOS DA LIBERDADE',               tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['FILHOS DA LIBERDADE'] },
  { code: '87512', descricao: 'VH VC ESTA ASSISTINDO OLHARES DO NORTE',                  tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['OLHARES DO NORTE'] },
];

// Find VH A SEGUIR or VH VC ESTA ASSISTINDO for a given program description
/** Busca em VH_SEGUIR_MAP a vinheta "VH A SEGUIR" correspondente ao programa pela descrição. Retorna null se vhSeguirAtivo=false nas REGRAS. */
function findVhSeguir(desc) {
  if (REGRAS.vhSeguirAtivo === false) return null;
  const upper = desc.toUpperCase();
  for (const vh of VH_SEGUIR_MAP) {
    if (vh.keywords.some(k => upper.includes(k.toUpperCase()))) return {...vh};
  }
  return null;
}

/** Busca em VH_ASSISTINDO_MAP a vinheta "VH VC ESTA ASSISTINDO" correspondente ao programa. Retorna null se vhAssistindoAtivo=false nas REGRAS. */
function findVhAssistindo(desc) {
  if (REGRAS.vhAssistindoAtivo === false) return null;
  const upper = desc.toUpperCase();
  for (const vh of VH_ASSISTINDO_MAP) {
    if (vh.keywords.some(k => upper.includes(k.toUpperCase()))) return {...vh};
  }
  return null;
}

/** Determina qual assinatura usar (INFANTIL, JOVEM ou ADULTO) baseado em keywords configuradas em REGRAS. Inserida automaticamente após o último bloco de cada programa. */
function pickAssinatura(desc) {
  return getAssinatura(desc);
}

// Extract base program title (remove block suffix " - BL 01" etc)
/** Remove sufixos de bloco (" - BL 01", " BL01") da descrição para obter o título base do programa. Usado na comparação com a grade semanal. */
function baseProgramTitle(desc) {
  return desc
    .replace(/^\s*PGM\s+/i, '')                // remove prefixo "PGM " no início
    .replace(/\s*-\s*T\s*\d+\s*EP\s*\d+.*$/i, '') // remove " - T 01 EP 03 - ..." (temporada/episódio/subtítulo) até o fim
    .replace(/\s*T\d+\s*EP\s*\d+.*$/i, '')        // variante sem hífen antes de "T01 EP16"
    .replace(/\s*-\s*BL\s*\d+\s*$/i, '')   // remove " - BL 01"
    .replace(/\s*BL\s*\d+\s*$/i, '')          // remove " BL01" ou " BL 01"
    .replace(/\s*\d+'\s*$/, '')                // remove sufixo de minutagem da grade, ex: " 10'"
    .trim();
}

// =====================================================
// GENERATE ROTEIRO FROM PROGRAM LIST
// =====================================================
/** Função central de geração automática. Recebe o array de programas do Notion e constrói o roteiro completo com VHs A SEGUIR, CLASSIFICAÇÃO INDICATIVA, breaks com __SLOT__, VH VC ESTA ASSISTINDO e ASSINATURAS. */
function buildRoteiroFromPrograms(programs) {
  // A Grade Semanal (importada do XLSX) é a régua mestre: cada início de programa
  // é cravado no horário definido pela grade do dia. Se sobrar tempo, injetamos
  // um "__GAP__" (Ajuste de Grade) para o usuário preencher com chamadas/breaks.
  const dow = state.currentDate ? state.currentDate.getDay() : nowForGrade().getDay();
  const gradeDiaria = (typeof loadGrade === 'function') ? loadGrade(dow) : {};

  const roteiro = [];
  let cumSec = START_SECONDS;
  const occurrenceCount = {};

  let i = 0;
  while (i < programs.length) {
    const prog = programs[i];
    const baseTitle = baseProgramTitle(prog.descricao);

    // Identifica ocorrência (1ª, 2ª, 3ª...) para casar com a chave da grade
    const n = occurrenceCount[baseTitle] || 0;
    occurrenceCount[baseTitle] = n + 1;
    const ordinal = n + 1;
    const gradeKey = ordinal === 1 ? baseTitle : `${baseTitle} [${ordinal}ª]`;

    // ── Ajuste contra a Grade XLSX ──
    const expectedTimeStr = gradeDiaria[gradeKey];
    if (expectedTimeStr) {
      // Grade rodou entre 00:00 e 05:59? Pertence à madrugada do DIA SEGUINTE
      // (roteiro vai de 06:00 do dia X até 05:59 do dia X+1). Somamos 24h para
      // que o slot fique DEPOIS de cumSec e o __GAP__ seja injetado corretamente.
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
          _gap: true
        });
        cumSec = expectedSec;
      }
    }

    // Coleta todos os blocos deste programa
    const blocks = [prog];
    let j = i + 1;
    while (j < programs.length && baseProgramTitle(programs[j].descricao) === baseTitle) {
      blocks.push(programs[j]);
      j++;
    }

    // ---- ANTES do 1º bloco: VH A SEGUIR ----
    const vhSeguir = findVhSeguir(prog.descricao);
    if (vhSeguir) { roteiro.push({...vhSeguir}); cumSec += timeToSec(vhSeguir.tempo); }

    // ---- Blocos + BREAKS ----
    blocks.forEach((block, bIdx) => {
      // VH CLASSIFICAÇÃO (85283) antes de TODO bloco RPRO,
      // exceto quando a descrição contém BL02/BL03/BL04/BL05.
      if (!/BL\s*0[2-5]/i.test(block.descricao || '')) {
        const vhClassif = getVhClassificacao();
        if (vhClassif) { roteiro.push({...vhClassif}); cumSec += timeToSec(vhClassif.tempo); }
      }

      roteiro.push({...block});
      cumSec += timeToSec(block.tempo);

      const isLastBlock = bIdx === blocks.length - 1;
      if (!isLastBlock) {
        const vhAss = findVhAssistindo(block.descricao);
        if (vhAss) { roteiro.push({...vhAss}); cumSec += timeToSec(vhAss.tempo); }
        roteiro.push({ code: '__BREAK__', descricao: '[ BREAK — chamada ]',      tempo: '00:00:00', midia: '0OMN', type: '__SLOT__', _break: true });
        roteiro.push({ code: '__BREAK__', descricao: '[ BREAK — interprograma ]', tempo: '00:00:00', midia: '0OMN', type: '__SLOT__', _break: true });
        if (vhAss) { roteiro.push({...vhAss}); cumSec += timeToSec(vhAss.tempo); }
      } else {
        const ass = pickAssinatura(block.descricao);
        if (ass) { roteiro.push(ass); cumSec += timeToSec(ass.tempo); }
      }
    });

    i = j;
  }

  return roteiro;
}

/** Parseia o CSV do Notion linha por linha, cria objetos de programa, chama buildRoteiroFromPrograms() e sincroniza a grade semanal com os horários calculados a partir da importação. */
function importNotionCSV(text, sep) {
  sep = sep || ',';
  const lines    = text.split(/\r?\n/);
  const imported = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols  = parseCSVLine(line, sep);
    // Strip surrounding quotes from each field (GSheets wraps everything in quotes)
    const unquote = s => s ? s.trim().replace(/^"(.*)"$/, '$1').trim() : s;
    const code  = unquote(cols[0]);
    const desc  = sanitizeText(unquote(cols[1])?.replace(/\s+/g, ' '));
    const tempo = unquote(cols[2]);
    if (!code || !desc || !tempo) continue;
    const prog = { code, descricao: desc, tempo, midia: '0OMN', type: 'RPRO' };
    imported.push(prog);
    // Upsert into programas bank
    const idx = state.programas.findIndex(p => p.code === code);
    if (idx >= 0) state.programas[idx] = prog;
    else state.programas.push(prog);
  }
  if (imported.length === 0) {
    toast('Nenhum programa encontrado no CSV', 'error');
    return;
  }

  // Build roteiro automatically with VHs
  const generated = buildRoteiroFromPrograms(imported);

  // If roteiro already has content, ask before overwriting
  if (state.roteiro.length > 0) {
    const ok = confirm(
      `Roteiro atual tem ${state.roteiro.length} itens.\n` +
      `Substituir pelo roteiro gerado (${generated.length} itens) a partir dos ${imported.length} programas importados?`
    );
    if (!ok) {
      // Just update the bank, don't touch roteiro
      saveState();
      renderProgramas();
      renderPecasSidebar();
      document.getElementById('badge-prog').textContent = state.programas.length;
      toast(`${imported.length} programas adicionados ao banco (roteiro mantido)`, 'success');
      return;
    }
  }

  state.roteiro = generated;

  // A Grade Semanal (XLSX) é a régua mestre — NÃO sobrescrevemos a grade aqui.
  // O buildRoteiroFromPrograms já injetou os __GAP__ necessários para manter
  // os horários cravados nos slots da grade do dia.


  // ── Injetar peças fixas ────────────────────────────────────────────────────
  const fixas = (state.pecasFixas || []).filter(f => f.ativo !== false);
  if (fixas.length) {
    const makeFixed = f => ({ code:f.code, descricao:f.descricao, tempo:f.tempo,
                               midia:f.midia||'0OMN', type:f.type, _fixa:true });
    const fInicio    = fixas.filter(f => f.posicao === 'inicio');
    const fFim       = fixas.filter(f => f.posicao === 'fim');
    const fAntesProg = fixas.filter(f => f.posicao === 'antes_programa');
    const fAposAssin = fixas.filter(f => f.posicao === 'apos_assinatura');

    fInicio.slice().reverse().forEach(f => state.roteiro.unshift(makeFixed(f)));
    if (fAntesProg.length) {
      const out = [];
      state.roteiro.forEach(item => {
        if (item.type === 'RPRO') fAntesProg.forEach(f => out.push(makeFixed(f)));
        out.push(item);
      });
      state.roteiro = out;
    }
    if (fAposAssin.length) {
      const out = [];
      state.roteiro.forEach(item => {
        out.push(item);
        if (item.descricao && item.descricao.startsWith('ASSINATURA_')) {
          fAposAssin.forEach(f => out.push(makeFixed(f)));
        }
      });
      state.roteiro = out;
    }
    fFim.forEach(f => state.roteiro.push(makeFixed(f)));
  }

  saveState();
  renderAll();
  renderWeekSelector();
  toast(`Roteiro gerado: ${imported.length} programas → ${state.roteiro.filter(i=>i.type!=='__SLOT__').length} itens | Sincronizado com a Grade Semanal XLSX`, 'success');
  try { scheduleBlockAlerts(); } catch (_) {}
}

/** Parser CSV robusto que respeita campos entre aspas com vírgulas ou ponto-e-vírgulas internas. Aceita vírgula, ponto-e-vírgula ou tab como separador. */
function parseCSVLine(line, sep) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === sep && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/** Exporta o roteiro como arquivo CSV no formato Roteiro Rede: CODE;DESCRIÇÃO;TEMPO;MIDIA;TYPE sem cabeçalho, UTF-8 com BOM. Nome inclui data e dia da semana. */
function exportExcel() {
  if (state.roteiro.length === 0) {
    toast('Roteiro vazio — nada para exportar', 'error');
    return;
  }
  const lines = state.roteiro.map(item =>
    `${csvField(item.code)};${csvField(item.descricao)};${csvField(item.tempo)};${csvField(item.midia||'0OMN')};${csvField(item.type)};`
  );
  const bom  = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  const d    = state.currentDate;
  const dd   = String(d.getDate()).padStart(2,'0');
  const mm   = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  const dow  = d.getDay();
  a.download = `CANAL_EDUCAÇÃO_${dd}${mm}${yyyy}_${DAY_NAMES[dow].toUpperCase()}.csv`;
  a.click();
  toast(`Roteiro exportado — ${state.roteiro.length} itens`, 'success');
}

/** Formata um valor para CSV: se contiver ponto-e-vírgula, aspas ou quebras de linha, envolve em aspas duplas para garantir compatibilidade. */
function csvField(val) {
  const s = String(val);
  if (/[;"'\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}

// =====================================================
// EXPORT XLSX
// =====================================================
/** Exporta o roteiro como .xlsx com 3 abas compatíveis com Excel Online. Codes são sempre texto para manter o PROCV funcionando. */
function exportXLSX() {
  if (!state.roteiro.length) { toast('Roteiro vazio', 'error'); return; }
  const XLSX = window.XLSX;
  if (!XLSX) { toast('SheetJS não carregado', 'error'); return; }

  const d       = state.currentDate;
  const dow     = d.getDay();
  const dd      = String(d.getDate()).padStart(2,'0');
  const mm      = String(d.getMonth()+1).padStart(2,'0');
  const yyyy    = d.getFullYear();
  const dateLabel = `${dd}/${mm}/${yyyy}`;
  const dayName   = DAY_NAMES[dow].toUpperCase();
  const title     = `ROTEIRO DO CANAL EDUCAÇÃO ${dayName} ${dd}-${mm}-${yyyy}`;
  const filename  = `CANAL_EDUCAÇÃO_${dd}${mm}${yyyy}_${dayName}.xlsx`;

  const wb    = XLSX.utils.book_new();
  const items = state.roteiro.filter(i => i.type !== '__SLOT__');

  // ── Separar programas e chamadas (deduplicados, ordem de aparição) ────────
  const seenProg = new Set(), seenCham = new Set();
  const progs = [], chams = [];
  items.forEach(item => {
    if (item.type === 'RPRO' && !seenProg.has(item.code)) {
      seenProg.add(item.code); progs.push(item);
    } else if (item.type !== 'RPRO' && !seenCham.has(item.code)) {
      seenCham.add(item.code); chams.push(item);
    }
  });

  // ── Helpers de célula ─────────────────────────────────────────────────────
  const TIME_FMT = 'hh:mm:ss';
  const S = (v, s) => ({ t:'s', v:String(v ?? ''), ...(s ? {s} : {}) });
  const Code = (v, s) => ({ t:'s', v:String(v ?? '').trim(), z:'@', ...(s ? {s} : {}) });
  const F = (f, s, opts = {}) => ({ f, ...opts, ...(s ? {s} : {}) });
  const timeToExcel = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, h, m, sec] = match;
    return (Number(h) * 3600 + Number(m) * 60 + Number(sec)) / 86400;
  };
  const Time = (value, s) => {
    const serial = timeToExcel(value);
    return serial == null ? S(value, s) : { t:'n', v:serial, z:TIME_FMT, ...(s ? {s} : {}) };
  };

  // ── Paleta espelhando o PDF ──────────────────────────────────────────────
  // Título: #2A3884 (azul escuro) com texto branco
  // Cabeçalho de colunas: #C8D2E6 com texto #141824
  // RPRO (programa): #2E8B5D verde com texto branco
  // CLASSIFICAÇÃO: #CFE9CF | VH A SEGUIR/DAQUI/VC ESTÁ: #CFE0F0 | ASSINATURA: #F5D9A8
  const border = { style:'thin', color:{rgb:'787878'} };
  const allBorders = { top:border, bottom:border, left:border, right:border };
  const sTtl = {
    font:{ bold:true, sz:13, color:{rgb:'FFFFFF'} },
    fill:{ fgColor:{rgb:'2A3884'} },
    alignment:{ horizontal:'center', vertical:'center' },
    border: allBorders
  };
  const sHdr = {
    font:{ bold:true, color:{rgb:'141824'} },
    fill:{ fgColor:{rgb:'C8D2E6'} },
    alignment:{ horizontal:'center', vertical:'center' },
    border: allBorders
  };
  const sHdrDark = {
    font:{ bold:true, color:{rgb:'FFFFFF'} },
    fill:{ fgColor:{rgb:'2A3884'} },
    alignment:{ horizontal:'center', vertical:'center' },
    border: allBorders
  };
  // Estilos por tipo de linha (mesma classificação do PDF)
  const mkRow = (bg, fg='141824', bold=false) => ({
    font:{ color:{rgb:fg}, ...(bold ? {bold:true} : {}) },
    fill:{ fgColor:{rgb:bg} },
    alignment:{ vertical:'center' },
    border: allBorders
  });
  const sRPRO   = mkRow('2E8B5D', 'FFFFFF', true);
  const sClass  = mkRow('CFE9CF');
  const sVHseg  = mkRow('CFE0F0');
  const sAssin  = mkRow('F5D9A8');
  const sDefault= mkRow('FFFFFF');
  const styleForItem = (item) => {
    const desc = String(item.descricao || '').toUpperCase();
    if (item.type === 'RPRO') return sRPRO;
    if (/CLASSIFICA[ÇC]/.test(desc)) return sClass;
    if (/^VH\s+A\s+SEGUIR|^VH\s+DAQUI|^VH\s+VC\s+ESTA/.test(desc)) return sVHseg;
    if (/ASSINATURA/.test(desc)) return sAssin;
    return sDefault;
  };

  // ════════════════════════════════════════════════════════════════════
  // ABA PGM's
  // A1: Code | B1: Programa | C1: Tempo
  // A2+: code | B2+: descrição | C2+: tempo
  // ════════════════════════════════════════════════════════════════════
  const wsP = {};
  wsP['A1'] = S('Code',     sHdrDark);
  wsP['B1'] = S('Programa', sHdrDark);
  wsP['C1'] = S('Tempo',    sHdrDark);
  progs.forEach((item, i) => {
    const r = i + 2;
    wsP[`A${r}`] = Code(item.code, sRPRO);
    wsP[`B${r}`] = S(item.descricao, sRPRO);
    wsP[`C${r}`] = Time(item.tempo, { ...sRPRO, alignment:{ horizontal:'center', vertical:'center' } });
  });
  wsP['!ref']  = `A1:C${Math.max(progs.length + 1, 2)}`;
  wsP['!cols'] = [{wch:16},{wch:64},{wch:10}];
  XLSX.utils.book_append_sheet(wb, wsP, "PGM's");

  // ════════════════════════════════════════════════════════════════════
  // ABA CHAMADAS
  // A1: Code | B1: Nome da Peça | C1: Tempo
  // A2+: code | B2+: descrição | C2+: tempo
  // ════════════════════════════════════════════════════════════════════
  const wsC = {};
  wsC['A1'] = S('Code',         sHdrDark);
  wsC['B1'] = S('Nome da Peça', sHdrDark);
  wsC['C1'] = S('Tempo',        sHdrDark);
  chams.forEach((item, i) => {
    const r = i + 2;
    const rs = styleForItem(item);
    wsC[`A${r}`] = Code(item.code, rs);
    wsC[`B${r}`] = S(item.descricao, rs);
    wsC[`C${r}`] = Time(item.tempo, { ...rs, alignment:{ ...(rs.alignment||{}), horizontal:'center' } });
  });
  wsC['!ref']  = `A1:C${Math.max(chams.length + 1, 2)}`;
  wsC['!cols'] = [{wch:16},{wch:64},{wch:10}];
  XLSX.utils.book_append_sheet(wb, wsC, 'Chamadas');

  // ════════════════════════════════════════════════════════════════════
  // ABA ROTEIRO (planilha principal)
  //
  // A1 : "ROTEIRO CANAL EDUCAÇÃO DD/MM/YYYY DIA" (merge A1:E1)
  // A2 : code   B2: programa   C2: tempo   D2: In   E2: out
  //
  // Para cada item na linha r (começa em r=3):
  //   A{r} = code do item, sempre texto
  //
  //   B{r} = =IF(A{r}="","",IFERROR(VLOOKUP(A{r},'PGM''s'!A:B,2,FALSE()),IFERROR(VLOOKUP(A{r},Chamadas!A:B,2,FALSE()),"NÃO ENCONTRADO")))
  //
  //   C{r} = =IF(A{r}="","",IFERROR(VLOOKUP(A{r},'PGM''s'!A:C,3,FALSE()),IFERROR(VLOOKUP(A{r},Chamadas!A:C,3,FALSE()),"")))
  //
  //   D3   = 06:00:00  (horário de início fixo)
  //   D{r} = =E{r-1}     (para r > 3: IN = OUT da linha anterior)
  //
  //   E{r} = =IF(C{r}="","",D{r}+C{r})
  // ════════════════════════════════════════════════════════════════════
  const wsR = {};

  // Linha 1 — título (merge A1:E1)
  wsR['A1'] = S(title, sTtl);

  // Linha 2 — cabeçalhos
  wsR['A2'] = S('code',     sHdr);
  wsR['B2'] = S('programa', sHdr);
  wsR['C2'] = S('tempo',    sHdr);
  wsR['D2'] = S('In',       sHdr);
  wsR['E2'] = S('out',      sHdr);

  // Linhas de dados a partir da linha 3
  items.forEach((item, i) => {
    const r  = i + 3;
    const rs = styleForItem(item);

    // A — code sempre como TEXTO; nunca converter codes numéricos para número
    wsR[`A${r}`] = Code(item.code, { ...rs, alignment:{ ...(rs.alignment||{}), horizontal:'center' } });

    // B — programa: PROCV buscando em PGM's, depois Chamadas
    wsR[`B${r}`] = F(
      `IF(A${r}="","",IFERROR(VLOOKUP(A${r},'PGM''s'!A:B,2,FALSE()),` +
      `IFERROR(VLOOKUP(A${r},Chamadas!A:B,2,FALSE()),"NÃO ENCONTRADO")))`,
      rs,
      { t:'str' }
    );

    // C — tempo: PROCV usando o code da própria linha
    wsR[`C${r}`] = F(
      `IF(A${r}="","",IFERROR(VLOOKUP(A${r},'PGM''s'!A:C,3,FALSE()),` +
      `IFERROR(VLOOKUP(A${r},Chamadas!A:C,3,FALSE()),"")))`,
      { ...rs, alignment:{ ...(rs.alignment||{}), horizontal:'center' } },
      { t:'n', z:TIME_FMT }
    );

    // D — IN: fixo na primeira linha, =OUT da linha anterior nas demais
    const tsCenter = { ...rs, alignment:{ ...(rs.alignment||{}), horizontal:'center' } };
    wsR[`D${r}`] = r === 3
      ? Time('06:00:00', tsCenter)
      : F(`IF(A${r}="","",E${r - 1})`, tsCenter, { t:'n', z:TIME_FMT });

    // E — OUT = tempo + IN
    wsR[`E${r}`] = F(`IF(C${r}="","",D${r}+C${r})`, tsCenter, { t:'n', z:TIME_FMT });
  });

  const rMax = items.length + 2;
  wsR['!ref']    = `A1:E${rMax}`;
  wsR['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:4} }];
  wsR['!cols']   = [{wch:16},{wch:64},{wch:10},{wch:10},{wch:10}];
  wsR['!rows']   = [{ hpt:24 }, { hpt:20 }];
  wsR['!autofilter'] = { ref:'A2:E1000' };

  // ROTEIRO é a primeira aba — adicionar e reordenar
  XLSX.utils.book_append_sheet(wb, wsR, 'roteiro');
  wb.SheetNames = ['roteiro', "PGM's", 'Chamadas'];

  XLSX.writeFile(wb, filename);
  toast(`XLSX exportado — ${items.length} itens · roteiro | PGM's | Chamadas`, 'success');
}

// =====================================================
// EXPORT PDF
// =====================================================
/** Gera um PDF A4 paisagem usando jsPDF + autoTable com cores por tipo de peça, breaks em itálico, estatísticas no cabeçalho e número de página no rodapé. */
function exportPDF() {
  if (!state.roteiro.length) { toast('Roteiro vazio', 'error'); return; }
  const { jsPDF } = window.jspdf;
  if (!jsPDF) { toast('jsPDF não carregado', 'error'); return; }

  const d    = state.currentDate;
  const dow  = d.getDay();
  const dd   = String(d.getDate()).padStart(2,'0');
  const mm   = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  const dayName = DAY_NAMES[dow].toUpperCase();
  const title = `ROTEIRO CANAL EDUCAÇÃO ${dd}/${mm}/${yyyy} ${dayName}`;

  // A4 retrato, formato do modelo
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Linhas com IN/OUT
  const items = state.roteiro.filter(i => i.type !== '__SLOT__');
  let curSec = START_SECONDS;
  const rows = items.map(item => {
    const dur  = timeToSec(item.tempo);
    const inT  = secToTime(curSec);
    const outT = secToTime(curSec + dur);
    curSec += dur;
    return { code: item.code || '', desc: item.descricao || '', tempo: item.tempo,
             in: inT, out: outT, type: item.type, dur, break: '' };
  });

  // BREAK acumulado: soma da duração desde o último RPRO,
  // exibida na última linha antes da próxima VH CLASSIFICAÇÃO ou RPRO.
  const isClass = r => /CLASSIFICA[ÇC]/i.test(r.desc);
  let acc = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.type === 'RPRO') { acc = 0; continue; }
    acc += r.dur;
    const next = rows[i+1];
    if (next && (isClass(next) || next.type === 'RPRO') && !isClass(r)) {
      r.break = secToTime(acc);
      acc = 0;
    }
  }

  // Cor de fundo por tipo/descrição (modelo)
  function rowFill(r) {
    const desc = (r.desc || '').toUpperCase();
    if (r.type === 'RPRO') return [46, 139, 93];
    if (/CLASSIFICA[ÇC]/.test(desc)) return [207, 233, 207];
    if (/^VH\s+A\s+SEGUIR|^VH\s+DAQUI|^VH\s+VC\s+ESTA/.test(desc)) return [207, 224, 240];
    if (/ASSINATURA/.test(desc)) return [245, 217, 168];
    return [255, 255, 255];
  }
  const rowTextColor = r => r.type === 'RPRO' ? [255,255,255] : [20,24,36];

  const body = rows.map(r => [r.code, r.desc, r.tempo, r.in, r.out, r.break]);

  doc.autoTable({
    startY: 10,
    head: [
      [{ content: title, colSpan: 6,
         styles: { fillColor: [42,56,132], textColor: [255,255,255],
                   fontStyle: 'bold', halign: 'center', fontSize: 10, cellPadding: 2.5 } }],
      [
        { content: '', styles: { fillColor: [200,210,230] } },
        { content: '', styles: { fillColor: [200,210,230] } },
        'TEMPO', 'IN', 'OUT', 'BREAK'
      ]
    ],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica', fontSize: 7, cellPadding: 1.8,
      lineColor: [120,120,120], lineWidth: 0.15,
      textColor: [20,24,36], overflow: 'linebreak', valign: 'middle',
    },
    headStyles: {
      fillColor: [200,210,230], textColor: [20,24,36],
      fontStyle: 'bold', halign: 'center', fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 17, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 17, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 17, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 17, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const r = rows[data.row.index];
      if (!r) return;
      data.cell.styles.fillColor = rowFill(r);
      data.cell.styles.textColor = rowTextColor(r);
      if (data.column.index === 3 && /CLASSIFICA[ÇC]/i.test(r.desc)) {
        data.cell.styles.fillColor = [230,30,30];
        data.cell.styles.textColor = [255,255,255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { top: 10, left: 8, right: 8, bottom: 10 },
    didDrawPage() {
      const pageH = doc.internal.pageSize.height;
      doc.setFontSize(7);
      doc.setTextColor(120,120,130);
      doc.text(
        `${title}  —  página ${doc.internal.getCurrentPageInfo().pageNumber}`,
        8, pageH - 4
      );
    },
  });

  const filename = `CANAL_EDUCAÇÃO_${dd}${mm}${yyyy}_${dayName}.pdf`;
  doc.save(filename);
  toast('PDF exportado', 'success');
}

/** Exporta backup completo do sistema em JSON: todos os roteiros, banco de peças, programas, peças do dia e grade semanal. Pode ser reimportado via handleImport(). */
function exportJSON() {
  const data = {
    pecas: state.pecas,
    programas: state.programas,
    roteiros: JSON.parse(localStorage.getItem('roteiroApp') || '{}').roteiros || {}
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'roteiro-canal-educacao-backup.json';
  a.click();
}


// =====================================================
// PEÇAS FIXAS — peças que entram automaticamente em
// todo roteiro gerado via importação
// =====================================================

/**
 * Abre o modal de gerenciamento de peças fixas.
 * Lista as peças fixas cadastradas com opções de ativar/desativar,
 * reordenar e excluir. Permite adicionar peças do banco.
 */
function openPecasFixasModal() {
  renderPecasFixasList();
  document.getElementById('modal-pecas-fixas').style.display = 'flex';
}

/**
 * Renderiza a lista de peças fixas no modal com seus estados e controles.
 */
function renderPecasFixasList() {
  const list  = document.getElementById('pecas-fixas-list');
  const fixas = state.pecasFixas || [];
  if (!fixas.length) {
    list.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:12px;text-align:center">Nenhuma peça fixa cadastrada.<br>Use o campo abaixo para adicionar.</div>';
    return;
  }
  const posLabels = {
    inicio:          '⬆ Início do roteiro',
    fim:             '⬇ Fim do roteiro',
    antes_programa:  '▶ Antes de cada programa',
    apos_assinatura: '✦ Após cada assinatura',
  };
  list.innerHTML = fixas.map((f, i) => `
    <div class="peca-fixa-row ${f.ativo === false ? 'peca-fixa-off' : ''}">
      <label class="peca-fixa-toggle" title="${f.ativo === false ? 'Desativada' : 'Ativa'}">
        <input type="checkbox" ${f.ativo !== false ? 'checked' : ''} onchange="togglePecaFixa(${i})">
      </label>
      <div class="peca-fixa-info">
        <div class="peca-fixa-name">${escHtml(f.descricao)}</div>
        <div class="peca-fixa-meta">
          <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${escHtml(f.code)}</span>
          <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${f.tempo}</span>
          <span class="type-badge badge-${f.type}">${f.type}</span>
          <span style="font-size:10px;color:var(--accent)">${posLabels[f.posicao] || f.posicao}</span>
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="act-btn" onclick="movePecaFixa(${i},-1)" ${i===0?'disabled':''} title="Subir">↑</button>
        <button class="act-btn" onclick="movePecaFixa(${i},+1)" ${i===fixas.length-1?'disabled':''} title="Descer">↓</button>
        <button class="act-btn act-btn-danger" onclick="deletePecaFixa(${i})" title="Remover">✕</button>
      </div>
    </div>`).join('');
}

/**
 * Adiciona uma peça ao banco de peças fixas.
 * Busca a peça pelo code no banco state.pecas. A posição define
 * em qual momento do roteiro gerado a peça será inserida.
 */
function addPecaFixa() {
  const code = document.getElementById('pf-code').value.trim();
  const pos  = document.getElementById('pf-posicao').value;
  if (!code) { toast('Informe o code da peça', 'error'); return; }
  const found = findPeca(code);
  if (!found) { toast(`Peça "${code}" não encontrada no banco de peças`, 'error'); return; }
  if (!state.pecasFixas) state.pecasFixas = [];
  const jaExiste = state.pecasFixas.some(f => f.code === code && f.posicao === pos);
  if (jaExiste) { toast('Esta peça já está fixa nesta posição', 'error'); return; }
  state.pecasFixas.push({ code: found.code, descricao: found.descricao,
    tempo: found.tempo, type: found.type, midia: found.midia||'0OMN',
    posicao: pos, ativo: true });
  document.getElementById('pf-code').value = '';
  saveState(); renderPecasFixasList();
  toast(`"${found.descricao.substring(0,35)}" fixada em: ${pos}`, 'success');
}

/**
 * Alterna o estado ativo/inativo de uma peça fixa.
 * Peças inativas não são inseridas no roteiro mas permanecem cadastradas.
 */
function togglePecaFixa(idx) {
  const f = state.pecasFixas[idx];
  if (!f) return;
  f.ativo = f.ativo === false;
  saveState(); renderPecasFixasList();
}

/**
 * Move uma peça fixa para cima (delta=-1) ou para baixo (delta=+1).
 */
function movePecaFixa(idx, delta) {
  const arr = state.pecasFixas;
  const to  = idx + delta;
  if (to < 0 || to >= arr.length) return;
  [arr[idx], arr[to]] = [arr[to], arr[idx]];
  saveState(); renderPecasFixasList();
}

/**
 * Remove uma peça fixa pelo índice após confirmação do usuário.
 */
function deletePecaFixa(idx) {
  const f = state.pecasFixas[idx];
  if (!f) return;
  if (!confirm(`Remover "${f.descricao.substring(0,50)}" das peças fixas?`)) return;
  state.pecasFixas.splice(idx, 1);
  saveState(); renderPecasFixasList();
  toast('Peça fixa removida', 'success');
}

/**
 * Fecha o modal de peças fixas e atualiza o badge do botão
 * mostrando quantas peças fixas ativas existem.
 */
function closePecasFixasModal() {
  closeModal('modal-pecas-fixas');
  const ativas = (state.pecasFixas || []).filter(f => f.ativo !== false).length;
  const btn = document.getElementById('btn-pecas-fixas');
  if (btn) {
    btn.textContent      = ativas > 0 ? `📌 Fixas (${ativas})` : '📌 Fixas';
    btn.style.borderColor = ativas > 0 ? 'var(--accent)' : '';
    btn.style.color       = ativas > 0 ? 'var(--accent)' : '';
  }
}


// =====================================================
// PAINEL ADMIN — configuração de regras de negócio
// Acessível via botão ⚙ Admin na barra superior.
// As regras são salvas no localStorage e aplicadas
// imediatamente sem precisar recarregar a página.
// =====================================================

/**
 * Abre o modal de administração preenchendo os campos
 * com os valores atuais das regras de negócio.
 */
function openAdminModal() {
  const r = loadRegras();
  document.getElementById('adm-rpol-inicio').value  = secToTimeRaw(r.rpolInicio).substring(0,5);
  document.getElementById('adm-rpol-fim').value     = secToTimeRaw(r.rpolFim).substring(0,5);
  document.getElementById('adm-grade-tol').value    = r.gradeTolerancia;
  document.getElementById('adm-break-slots').value  = r.breakSlotsPorBloco;
  document.getElementById('adm-sidebar-max').value  = r.sidebarMaxItens;
  document.getElementById('adm-backup-min').value   = r.backupIntervaloMin;
  document.getElementById('adm-mostrar-grade').checked  = r.mostrarGrade !== false;
  document.getElementById('adm-auto-banco').checked     = r.autoBanco !== false;
  document.getElementById('adm-injetar-fixas').checked  = r.injetarFixas !== false;
  // VH toggles
  document.getElementById('adm-vh-seguir').checked     = r.vhSeguirAtivo !== false;
  document.getElementById('adm-vh-assistindo').checked = r.vhAssistindoAtivo !== false;
  document.getElementById('adm-vh-daqui').checked      = r.vhDaquiAPouco !== false;
  // VH Classificação
  const vc = r.vhClassificacao || {};
  document.getElementById('adm-vh-classif-ativo').checked = vc.ativo !== false;
  document.getElementById('adm-vh-classif-code').value    = vc.code  || '85283';
  document.getElementById('adm-vh-classif-tempo').value   = vc.tempo || '00:00:06';
  // VH Assinaturas
  const vi = r.vhAssinaturaInfantil || {};
  document.getElementById('adm-vh-inf-ativo').checked = vi.ativo !== false;
  document.getElementById('adm-vh-inf-code').value    = vi.code  || '85331';
  document.getElementById('adm-vh-inf-tempo').value   = vi.tempo || '00:00:05';
  const vj = r.vhAssinaturaJovem || {};
  document.getElementById('adm-vh-jov-ativo').checked = vj.ativo !== false;
  document.getElementById('adm-vh-jov-code').value    = vj.code  || '85330';
  document.getElementById('adm-vh-jov-tempo').value   = vj.tempo || '00:00:05';
  const va = r.vhAssinaturaAdulto || {};
  document.getElementById('adm-vh-adt-ativo').checked = va.ativo !== false;
  document.getElementById('adm-vh-adt-code').value    = va.code  || '85332';
  document.getElementById('adm-vh-adt-tempo').value   = va.tempo || '00:00:05';
  // Keywords de assinatura
  document.getElementById('adm-vh-inf-kw').value = r.vhAssinaturaInfantilKeywords || REGRAS_DEFAULT.vhAssinaturaInfantilKeywords;
  document.getElementById('adm-vh-adt-kw').value = r.vhAssinaturaAdultoKeywords   || REGRAS_DEFAULT.vhAssinaturaAdultoKeywords;
  document.getElementById('modal-admin').style.display = 'flex';
}

/**
 * Lê os campos do modal Admin, valida, salva as novas regras
 * e recarrega o objeto REGRAS globalmente.
 * As alterações têm efeito imediato no próximo roteiro gerado.
 */
function saveAdminRegras() {
  const toSec = hhmm => {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60;
  };

  const novas = {
    rpolInicio:         toSec(document.getElementById('adm-rpol-inicio').value || '19:30'),
    rpolFim:            toSec(document.getElementById('adm-rpol-fim').value   || '22:30'),
    gradeTolerancia:    parseInt(document.getElementById('adm-grade-tol').value)   || 10,
    breakSlotsPorBloco: parseInt(document.getElementById('adm-break-slots').value) || 2,
    sidebarMaxItens:    parseInt(document.getElementById('adm-sidebar-max').value) || 120,
    backupIntervaloMin: parseInt(document.getElementById('adm-backup-min').value)  || 2,
    mostrarGrade:   document.getElementById('adm-mostrar-grade').checked,
    autoBanco:      document.getElementById('adm-auto-banco').checked,
    injetarFixas:   document.getElementById('adm-injetar-fixas').checked,
    // VH toggles globais
    vhSeguirAtivo:    document.getElementById('adm-vh-seguir').checked,
    vhAssistindoAtivo: document.getElementById('adm-vh-assistindo').checked,
    vhDaquiAPouco:    document.getElementById('adm-vh-daqui').checked,
    // VH Classificação Indicativa
    vhClassificacao: {
      ativo:    document.getElementById('adm-vh-classif-ativo').checked,
      code:     document.getElementById('adm-vh-classif-code').value.trim() || '85283',
      descricao:'VH CLASSIFICAÇAO INDICATIVA LIVRE',
      tempo:    document.getElementById('adm-vh-classif-tempo').value.trim() || '00:00:06',
    },
    // VH Assinaturas
    vhAssinaturaInfantil: {
      ativo:    document.getElementById('adm-vh-inf-ativo').checked,
      code:     document.getElementById('adm-vh-inf-code').value.trim() || '85331',
      descricao:'ASSINATURA_INFANTIL',
      tempo:    document.getElementById('adm-vh-inf-tempo').value.trim() || '00:00:05',
    },
    vhAssinaturaJovem: {
      ativo:    document.getElementById('adm-vh-jov-ativo').checked,
      code:     document.getElementById('adm-vh-jov-code').value.trim() || '85330',
      descricao:'ASSINATURA_JOVEM',
      tempo:    document.getElementById('adm-vh-jov-tempo').value.trim() || '00:00:05',
    },
    vhAssinaturaAdulto: {
      ativo:    document.getElementById('adm-vh-adt-ativo').checked,
      code:     document.getElementById('adm-vh-adt-code').value.trim() || '85332',
      descricao:'ASSINATURA_ADULTO',
      tempo:    document.getElementById('adm-vh-adt-tempo').value.trim() || '00:00:05',
    },
    // Keywords de classificação de assinatura
    vhAssinaturaInfantilKeywords: document.getElementById('adm-vh-inf-kw').value.trim(),
    vhAssinaturaAdultoKeywords:   document.getElementById('adm-vh-adt-kw').value.trim(),
  };

  if (novas.rpolInicio >= novas.rpolFim) {
    toast('Horário RPOL inválido: início deve ser antes do fim', 'error'); return;
  }
  if (novas.gradeTolerancia < 0 || novas.gradeTolerancia > 300) {
    toast('Tolerância de grade deve estar entre 0 e 300 segundos', 'error'); return;
  }

  saveRegras(novas);
  REGRAS = loadRegras();
  closeModal('modal-admin');
  renderRoteiro();
  renderPecasSidebar();
  toast('✅ Regras de negócio atualizadas com sucesso', 'success');
}

/**
 * Restaura todas as regras de negócio para os valores padrão (REGRAS_DEFAULT).
 */
function resetAdminRegras() {
  if (!confirm('Restaurar todas as regras para os valores padrão?')) return;
  localStorage.removeItem('roteiroRegras');
  REGRAS = loadRegras();
  openAdminModal(); // Re-abre com valores default
  toast('Regras restauradas para os valores padrão', 'success');
}

// =====================================================
// AUTO-BACKUP — Salva JSON automaticamente em pasta local
// Usa File System Access API (Chrome/Edge 86+).
// No Firefox ou outros navegadores sem suporte, exibe
// aviso e oferece fallback de exportação manual.
// =====================================================

/** Handle para o diretório de backup escolhido pelo usuário. Persiste durante a sessão. */
let _backupDirHandle = null;

/** Intervalo de auto-backup em milissegundos (padrão: 2 minutos). */
const BACKUP_INTERVAL_MS = (REGRAS.backupIntervaloMin || 2) * 60 * 1000;

/**
 * Solicita ao usuário que escolha uma pasta para armazenar os backups automáticos.
 * Usa a File System Access API (disponível no Chrome 86+ e Edge 86+).
 * Após selecionar a pasta, inicia o ciclo de backup automático a cada BACKUP_INTERVAL_MS.
 * No Firefox ou navegadores sem suporte à API, exibe aviso e oferece fallback manual.
 * O backup também é acionado automaticamente a cada chamada de saveState().
 */
async function setupAutoBackup() {
  if (!window.showDirectoryPicker) {
    toast('Auto-backup automático não disponível neste navegador. Use Chrome ou Edge.', 'error');
    if (confirm('Seu navegador não suporta backup automático em pasta local.\n\nDeseja exportar o backup manualmente agora?')) {
      exportJSON();
    }
    return;
  }
  try {
    _backupDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    localStorage.setItem('roteiroBackupEnabled', '1');
    toast('✅ Pasta de backup configurada — salvando automaticamente a cada 2 minutos', 'success');
    await runAutoBackup();
    if (window._backupTimer) clearInterval(window._backupTimer);
    window._backupTimer = setInterval(runAutoBackup, BACKUP_INTERVAL_MS);
    const btn = document.getElementById('btn-backup');
    if (btn) { btn.textContent = '💾 Backup ativo'; btn.style.borderColor = 'var(--green)'; btn.style.color = 'var(--green)'; }
  } catch (err) {
    if (err.name !== 'AbortError') toast('Erro ao configurar pasta de backup: ' + err.message, 'error');
  }
}

/**
 * Executa o backup automático: serializa o estado completo do sistema em JSON
 * e grava (ou sobrescreve) o arquivo "roteiro_backup_YYYYMMDD.json" na pasta configurada.
 * Atualiza o indicador #backup-status com o horário do último backup realizado.
 * Chamada automaticamente pelo setInterval e por saveState() após cada alteração.
 */
async function runAutoBackup() {
  if (!_backupDirHandle) return;
  try {
    const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
    const data  = JSON.stringify({
      ...saved,
      _backup: { gerado: new Date().toISOString(), versao: '2.0' }
    }, null, 2);
    const d    = new Date();
    const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const fh = await _backupDirHandle.getFileHandle(`roteiro_backup_${date}.json`, { create: true });
    const wr = await fh.createWritable();
    await wr.write(data); await wr.close();
    const hm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const el = document.getElementById('backup-status');
    if (el) el.textContent = `💾 ${hm}`;
  } catch (err) {
    console.warn('Auto-backup falhou:', err.message);
  }
}

// =====================================================
// UTILS
// =====================================================

/**
 * Remove acentos "soltos" e caracteres de diacrítico digitados
 * isoladamente (´ ` ~ ^) que costumam entrar em textos importados
 * de planilhas / Notion e quebram buscas e comparações.
 */
function sanitizeText(str) {
  if (!str) return str;
  return String(str).replace(/[´`~^]/g, '');
}

// ── Sistema de Temas Visuais ────────────────────────────────────────────────
const THEME_KEY = 'roteiroTheme';
const THEMES    = ['day','night','sunset','cozy','hicontrast'];

/** Aplica um tema ao <body>, persiste no localStorage e sincroniza o <select>. */
function setTheme(themeName) {
  if (!THEMES.includes(themeName)) themeName = 'day';
  const body = document.body;
  if (!body) return;
  THEMES.forEach(t => body.classList.remove('theme-' + t));
  if (themeName !== 'day') body.classList.add('theme-' + themeName);
  try { localStorage.setItem(THEME_KEY, themeName); } catch (_) { /* storage cheio/bloqueado */ }
  const sel = document.getElementById('theme-selector');
  if (sel && sel.value !== themeName) sel.value = themeName;
}

/** Lê o tema salvo (se houver) e aplica. Chamado no início de init(). */
function loadTheme() {
  let saved = 'day';
  try { saved = localStorage.getItem(THEME_KEY) || 'day'; } catch (_) { saved = 'day'; }
  // Se o body ainda não existe (script no <head>), tenta novamente após DOMContentLoaded.
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setTheme(saved), { once: true });
  } else {
    setTheme(saved);
  }
}

// ── Cores customizadas por programa (Grade Semanal) ─────────────────────────
const PROG_COLOR_KEY = 'roteiroProgramColors';

/** Lê o mapa {nomePrograma: cor} do localStorage com tratamento de erro. */
function loadProgramColors() {
  try {
    const raw = localStorage.getItem(PROG_COLOR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_) {
    return {};
  }
}

/** Salva a cor de um programa específico e re-renderiza a Grade. */
function setProgramColor(programName, color) {
  if (!programName) return;
  const base = String(programName).replace(/\s*\[\d+ª\]$/, '').trim();
  const colors = loadProgramColors();
  if (color) colors[base] = color;
  else delete colors[base];
  try { localStorage.setItem(PROG_COLOR_KEY, JSON.stringify(colors)); } catch (_) { /* silencioso */ }
  if (typeof renderGrade === 'function') renderGrade();
}


/**
 * Cria uma versão com debounce de uma função — atrasa a execução até que
 * o usuário pare de chamar por `wait` ms. Evita renders excessivos na busca.
 */
function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Escapa caracteres especiais HTML (&, <, >, ", ') para uso seguro em innerHTML. Essencial para prevenir XSS com dados vindos do usuário. */
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
/** Escapa aspas duplas em uma string para uso seguro em atributos HTML. */
function escAttr(s) {
  return String(s).replace(/'/g,"\\'").replace(/"/g,'&quot;');
}

/** Exibe uma notificação flutuante no canto inferior direito. type pode ser "success" (verde) ou "error" (vermelho). Remove automaticamente após 3 segundos. */
function toast(msg, type='success') {
  const el       = document.createElement('div');
  el.className   = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// =====================================================
// BLOCK START ALERTS — agenda toasts/notificações nos horários da Grade Semanal
// =====================================================
let _blockAlertTimers = [];
let _blockAlertSnapshot = []; // [{key,time,fired}]

/** Limpa todos os timers de alerta agendados. */
function clearBlockAlerts() {
  _blockAlertTimers.forEach(t => clearTimeout(t));
  _blockAlertTimers = [];
}

/** Dispara um alerta visual (toast grande) + notificação do SO + bipe curto. */
function fireBlockAlert(key, timeStr) {
  // Toast persistente (10s)
  const el = document.createElement('div');
  el.className = 'toast success';
  el.style.cssText = 'font-size:14px;font-weight:600;padding:14px 18px;border-left:4px solid #10b981;max-width:420px;white-space:normal;line-height:1.4';
  el.innerHTML = `🔔 <b>${timeStr}</b> — Início do bloco<br><span style="font-weight:500;opacity:.9">${key}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 10000);

  // Notificação do sistema
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`▶ ${timeStr} — ${key}`, {
        body: 'Início do bloco conforme Grade Semanal',
        tag: `block-${key}-${timeStr}`,
        requireInteraction: false,
      });
    }
  } catch (_) {}

  // Bipe
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.value = 0.15;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.18);
    setTimeout(() => ctx.close(), 400);
  } catch (_) {}
}

/** Agenda alertas para todos os blocos do dia atual cujo horário ainda não passou.
 *  Usa a Grade Semanal (loadGrade) como referência. Re-arma a cada chamada. */
function scheduleBlockAlerts(opts = {}) {
  clearBlockAlerts();
  const silent = !!opts.silent;

  // Pede permissão para Notification (uma vez)
  if ('Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch (_) {}
  }

  const dow   = _currentDow();
  const grade = loadGrade(dow);
  const order = loadGradeOrder(dow);
  const keys  = (order && order.length) ? order.filter(k => grade[k]) : Object.keys(grade);

  if (!keys.length) {
    if (!silent) toast('Nenhum bloco na Grade Semanal para agendar', 'error');
    return 0;
  }

  // Base de data: usa a data selecionada no roteiro (state.currentDate) ou hoje.
  // Assim, se o usuário está montando o roteiro de sábado num dia anterior,
  // os alertas são agendados para os horários reais de sábado.
  const baseDate = state.currentDate ? new Date(state.currentDate) : new Date();
  const now = Date.now();
  let scheduled = 0;
  let pastCount = 0;
  const snap = [];
  const MAX_DELAY = 7 * 24 * 3600 * 1000; // até 7 dias à frente

  keys.forEach(key => {
    const t = grade[key];
    if (!t) return;
    const [hh, mm, ss] = t.split(':').map(n => parseInt(n, 10) || 0);
    const target = new Date(baseDate);
    target.setHours(hh, mm, ss || 0, 0);
    // Horários de 00:00–05:59 representam a varredura noturna do dia seguinte
    if (hh < 6) target.setDate(target.getDate() + 1);
    const delay = target.getTime() - now;
    const fired = delay <= 0;
    snap.push({ key, time: t, fired });
    if (fired) { pastCount++; return; }
    if (delay > 0 && delay < MAX_DELAY) {
      const id = setTimeout(() => fireBlockAlert(key, t.substring(0,5)), delay);
      _blockAlertTimers.push(id);
      scheduled++;
    }
  });

  _blockAlertSnapshot = snap;
  if (!silent) {
    const dateLabel = baseDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    if (scheduled > 0) {
      toast(`🔔 ${scheduled} alerta${scheduled === 1 ? '' : 's'} agendado${scheduled === 1 ? '' : 's'} para ${dateLabel}${pastCount ? ` (${pastCount} já passaram)` : ''}`, 'success');
    } else if (pastCount > 0) {
      toast(`Todos os ${pastCount} horários da grade de ${dateLabel} já passaram`, 'error');
    } else {
      toast('Nenhum bloco futuro para agendar', 'error');
    }
  }
  return scheduled;
}

// Re-arma ao carregar a página (caso o usuário deixe a aba aberta)
window.addEventListener('load', () => {
  setTimeout(() => { try { scheduleBlockAlerts({ silent: true }); } catch (_) {} }, 1500);
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});

// =====================================================
// GRADE MANAGEMENT
// =====================================================
/** Atualiza a grade do dia atual com o horário calculado quando o usuário clica em "assumir". Usado para aceitar desvios de horário como nova referência. */
function assumeGradeTime(gradeKey, newTime, event) {
  event.stopPropagation();
  const grade = loadGrade();
  const order = loadGradeOrder();
  grade[gradeKey] = newTime;
  if (!order.includes(gradeKey)) order.push(gradeKey);
  saveGrade(grade);
  saveGradeOrder(order);
  renderRoteiro();
  toast(`Grade atualizada: ${gradeKey.substring(0,30)} → ${newTime}`, 'success');
}

// Fix all calculated times from the current roteiro into the grade for this weekday
/** Captura todos os horários IN calculados do roteiro atual e os grava como referência na grade do dia da semana selecionado. Detecta múltiplas exibições e usa sufixos [2ª], [3ª]. */
function fixGradeFromRoteiro() {
  if (!state.roteiro.length) { toast('Roteiro vazio', 'error'); return; }
  const dow = _currentDow();
  const grade = loadGrade(dow);
  const order = [];
  const occ   = {};

  recalcTimes();
  let cur = START_SECONDS;
  for (const item of state.roteiro) {
    if (item.type === '__SLOT__') { cur += 0; continue; }
    const dur  = timeToSec(item.tempo);
    if (item.type === 'RPRO') {
      const base = baseProgramTitle(item.descricao);
      const prevItem = state.roteiro[state.roteiro.indexOf(item) - 1];
      const prevBase = prevItem && prevItem.type === 'RPRO' ? baseProgramTitle(prevItem.descricao) : null;
      if (prevBase !== base) {
        // New occurrence
        const n    = occ[base] || 0;
        occ[base]  = n + 1;
        const key  = n === 0 ? base : `${base} [${n + 1}ª]`;
        grade[key] = secToTime(cur);
        if (!order.includes(key)) order.push(key);
      }
    }
    cur += dur;
  }

  saveGrade(grade, dow);
  saveGradeOrder(order, dow);
  renderRoteiro();
  const dayName = DAY_NAMES[dow];
  toast(`Grade de ${dayName} fixada — ${order.length} programas`, 'success');
  // Refresh modal if open
  if (document.getElementById('modal-grade').style.display !== 'none') openGradeModal();
}

// Grade is stored per day-of-week (0=Sun … 6=Sat)
/** Retorna o dia da semana (0=Dom...6=Sáb) da data atualmente selecionada no sistema. */
function _currentDow() {
  return state.currentDate ? state.currentDate.getDay() : nowForGrade().getDay();
}

/** Carrega a grade de horários do dia da semana dow. Prioridade: (1) customizações do usuário no localStorage, (2) dados base do GRADE_BASE extraídos do xlsx de programação. */
function loadGrade(dow) {
  if (dow === undefined) dow = _currentDow();
  const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  // Migrate legacy flat grade → weekday 4 (Thursday) on first run
  if (saved.grade && !saved.gradeByDay) {
    saved.gradeByDay    = { 4: saved.grade };
    saved.gradeOrderByDay = { 4: saved.gradeOrder || [] };
    delete saved.grade; delete saved.gradeOrder;
    localStorage.setItem('roteiroApp', JSON.stringify(saved));
  }
  const custom = (saved.gradeByDay || {})[dow];
  if (custom && Object.keys(custom).length > 0) return custom;
  // Fallback: Grade Semanal base (admin) — usada como régua mestre
  if (typeof GRADE_BASE !== 'undefined' && GRADE_BASE.gradeByDay) {
    return GRADE_BASE.gradeByDay[String(dow)] || {};
  }
  return {};
}

/** Persiste a grade de horários do dia dow no localStorage. Se o servidor API estiver disponível, sincroniza também via HTTP PUT. */
function saveGrade(grade, dow) {
  if (dow === undefined) dow = _currentDow();
  const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  if (!saved.gradeByDay) saved.gradeByDay = {};
  saved.gradeByDay[dow] = grade;
  localStorage.setItem('roteiroApp', JSON.stringify(saved));
}

/** Retorna a ordem dos programas na grade para o dia dow. Fallback para GRADE_BASE.gradeOrderByDay se não houver customização salva. */
function loadGradeOrder(dow) {
  if (dow === undefined) dow = _currentDow();
  const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  const custom = ((saved.gradeOrderByDay || {})[dow]) || [];
  if (custom.length > 0) return custom;
  if (typeof GRADE_BASE !== 'undefined' && GRADE_BASE.gradeOrderByDay) {
    return (GRADE_BASE.gradeOrderByDay[String(dow)] || []).slice();
  }
  return [];
}

/** Persiste a ordem dos programas da grade para o dia dow no localStorage. */
function saveGradeOrder(order, dow) {
  if (dow === undefined) dow = _currentDow();
  const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  if (!saved.gradeOrderByDay) saved.gradeOrderByDay = {};
  saved.gradeOrderByDay[dow] = order;
  localStorage.setItem('roteiroApp', JSON.stringify(saved));
}

// Current working order while modal is open (array of names)
let _gradeWorkingOrder = [];

/** Abre o modal de configuração da grade semanal. Carrega a lista de programas do dia atual e renderiza as linhas editáveis com drag-and-drop para reordenação. */
function openGradeModal() {
  const dow   = _currentDow();
  const grade = loadGrade(dow);
  const savedOrder = loadGradeOrder(dow);
  // Update modal title to show which weekday
  const titleEl = document.getElementById('grade-modal-title');
  if (titleEl) titleEl.textContent = `Grade — ${DAY_NAMES[dow]}`;

  // Build ordered list: saved order first, then new programs from roteiro
  const seen = new Set(savedOrder);
  const order = [...savedOrder];

  // Add from grade keys not yet in order
  Object.keys(grade).forEach(k => { if (!seen.has(k)) { order.push(k); seen.add(k); } });

  // Add from current roteiro
  state.roteiro.forEach(item => {
    if (item.type === 'RPRO') {
      const base = baseProgramTitle(item.descricao);
      if (!seen.has(base)) { order.push(base); seen.add(base); }
    }
  });

  _gradeWorkingOrder = order;
  renderGradeRows(grade);
  document.getElementById('grade-new-name').value = '';
  document.getElementById('grade-new-time').value = '';
  document.getElementById('modal-grade').style.display = 'flex';
  setTimeout(() => document.getElementById('grade-new-name').focus(), 50);
}

/** Redesenha as linhas do modal de grade com campos de horário editáveis e handles de arrasto (⠿). */
function renderGradeRows(grade) {
  if (!grade) grade = loadGrade();
  const container = document.getElementById('grade-rows');

  if (_gradeWorkingOrder.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--muted);padding:8px 0">Nenhum programa cadastrado. Adicione acima ou gere o roteiro primeiro.</p>';
    return;
  }

  container.innerHTML = _gradeWorkingOrder.map((name, idx) => {
    const time = grade[name] || '';
    return `<div class="grade-row" draggable="true" data-idx="${idx}"
        ondragstart="gradeRowDragStart(event,${idx})"
        ondragover="gradeRowDragOver(event,${idx})"
        ondrop="gradeRowDrop(event,${idx})"
        ondragleave="gradeRowDragLeave(event)">
      <span class="grade-drag" title="Arrastar para reordenar">⠿</span>
      <span class="grade-name" title="${escHtml(name)}">${escHtml(name.length > 50 ? name.substring(0,50)+'…' : name)}</span>
      <input type="time" step="1" value="${time}" data-prog="${escHtml(name)}"
        style="width:110px;padding:4px 6px;border-radius:5px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);font-size:12px;font-family:var(--mono);outline:none;flex-shrink:0">
      <button onclick="removeGradeEntry('${escHtml(name)}')"
        style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:0 2px;line-height:1;flex-shrink:0" title="Remover">×</button>
    </div>`;
  }).join('');
}

// ── Grade drag-and-drop ──────────────────────────────
let _gradeDragIdx = null;

/** Inicia o arrasto de uma linha no modal de grade. Registra o índice de origem. */
function gradeRowDragStart(e, idx) {
  _gradeDragIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging-grade');
}

/** Evento ao arrastar sobre uma linha alvo no modal de grade. Adiciona feedback visual. */
function gradeRowDragOver(e, idx) {
  e.preventDefault();
  document.querySelectorAll('.grade-row').forEach(r => r.classList.remove('drag-over-grade'));
  e.currentTarget.classList.add('drag-over-grade');
}

/** Remove o feedback visual de arrasto da linha alvo no modal de grade. */
function gradeRowDragLeave(e) {
  e.currentTarget.classList.remove('drag-over-grade');
}

/** Finaliza o arrasto no modal de grade, reordenando _gradeWorkingOrder e re-renderizando as linhas. */
function gradeRowDrop(e, idx) {
  e.preventDefault();
  document.querySelectorAll('.grade-row').forEach(r => {
    r.classList.remove('drag-over-grade');
    r.classList.remove('dragging-grade');
  });
  if (_gradeDragIdx === null || _gradeDragIdx === idx) return;
  // Reorder _gradeWorkingOrder
  const moved = _gradeWorkingOrder.splice(_gradeDragIdx, 1)[0];
  _gradeWorkingOrder.splice(idx, 0, moved);
  _gradeDragIdx = null;
  renderGradeRows();
}

// ── Add new grade entry ──────────────────────────────
/** Adiciona um novo programa à grade a partir dos campos de nome e horário no topo do modal. Aceita Enter como atalho. */
function addGradeEntry() {
  const nameInput = document.getElementById('grade-new-name');
  const timeInput = document.getElementById('grade-new-time');
  const name = nameInput.value.trim();
  const time = timeInput.value.trim();

  if (!name) { nameInput.focus(); return; }
  if (_gradeWorkingOrder.includes(name)) {
    toast('Programa já existe na grade', 'error');
    return;
  }

  _gradeWorkingOrder.push(name);
  // Pre-save the time in grade immediately so renderGradeRows shows it
  const grade = loadGrade(_currentDow());
  if (time) grade[name] = time.length === 5 ? time + ':00' : time;
  saveGrade(grade, _currentDow());

  nameInput.value = '';
  timeInput.value = '';
  nameInput.focus();
  renderGradeRows(grade);
  toast(`"${name.substring(0,30)}" adicionado à grade`, 'success');
}

/** Remove um programa específico da grade do dia atual, tanto do array de ordem quanto do objeto de horários. */
function removeGradeEntry(name) {
  _gradeWorkingOrder = _gradeWorkingOrder.filter(n => n !== name);
  const grade = loadGrade();
  delete grade[name];
  saveGrade(grade, _currentDow());
  renderGradeRows(grade);
  renderRoteiro();
}

/** Lê os valores dos inputs do modal de grade e persiste a grade e a ordem no localStorage (e no servidor se disponível). */
function saveGradeFromModal() {
  const grade = {};
  document.querySelectorAll('#grade-rows input[data-prog]').forEach(input => {
    const prog = input.getAttribute('data-prog');
    const val  = input.value.trim();
    if (val) grade[prog] = val.length === 5 ? val + ':00' : val;
  });
  saveGrade(grade, _currentDow());
  saveGradeOrder([..._gradeWorkingOrder], _currentDow());
  closeModal('modal-grade');
  renderRoteiro();
  toast('Grade salva — ' + Object.keys(grade).length + ' programas', 'success');
}

// =====================================================
// GRADE VISUAL — weekly schedule view
// =====================================================
/** Renderiza a aba Grade Semanal como um CSS Grid real com 7 colunas (Seg→Dom). Cada célula mostra o horário de entrada e o nome do programa. Na coluna do dia atual, exibe indicador ✓ (verde, ±8s) ou desvio em laranja comparando com o roteiro calculado. */
// ═══ [MOD] Separa "TÍTULO - T01 EP02" (chave da grade) em título puro +
//  rótulo de episódio, para exibir/colorir pelo programa e não por episódio.
//  Espera o sufixo produzido em fullTitle = `${title} - ${episode}`. ═══
function _splitTitleEpisode(rawKey) {
  const m = rawKey.match(/^(.*?)\s-\s(T\d{2}(?:\s?EP\d{2})?|EP\d{2})$/);
  if (m) return { title: m[1], episode: m[2] };
  return { title: rawKey, episode: '' };
}
// ═══ [/MOD] ═══

function renderGrade() {
  const container = document.getElementById('grade-visual-container');
  if (!container) return;

  const DOW_FULL  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Seg→Dom
  const curDow    = _currentDow();

  const _norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();

  // ── Color map per program (strip [Nª] suffix so same program = same color) ──
  const PALETTE = [
    '#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981',
    '#06b6d4','#84cc16','#ef4444','#a855f7','#14b8a6',
    '#f97316','#6366f1','#22c55e','#e11d48','#0ea5e9',
  ];
  const colorMap = {};
  let ci = 0;
  const customColors = loadProgramColors();
  function getColor(key) {
    const noOcc = key.replace(/\s*\[\d+ª\]$/, '').trim();
    const base  = _splitTitleEpisode(noOcc).title.trim(); // ignora episódio: mesma cor p/ todo o programa
    if (customColors[base]) return customColors[base];
    if (!colorMap[base]) colorMap[base] = PALETTE[ci++ % PALETTE.length];
    return colorMap[base];
  }

  // Normaliza horários vindos da grade. Aceita HH:MM e HH:MM:SS para evitar
  // que "00:00" e "00:00:00" virem linhas diferentes no grid.
  function normalizeGradeTime(t) {
    if (!t) return '';
    const parts = String(t).trim().split(':');
    if (parts.length === 2) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:00`;
    if (parts.length === 3) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:${parts[2].padStart(2,'0')}`;
    return '';
  }

  // Ordena horários tratando 00:00–05:59 como "depois da meia-noite"
  // (a grade do canal vai das 06:00 até a varredura noturna).
  function gradeSeconds(t) {
    const sec = timeToSec(normalizeGradeTime(t));
    return sec < START_SECONDS ? sec + 86400 : sec;
  }
  function _gradeTimeKey(t){ return String(gradeSeconds(t)).padStart(6, '0'); }
  // ── Build per-day program list (sorted by time) ──
  function dayPrograms(dow) {
    const grade = loadGrade(dow);
    const order = loadGradeOrder(dow);

    // A ordem salva pode estar desatualizada (ex.: importou/adicionou programas
    // de 00:00–05:00 depois). Antes, só a ordem era usada; então esses itens
    // existiam em gradeByDay, mas eram ignorados na Grade Visual e o último
    // programa antes da meia-noite acabava ocupando toda a madrugada.
    const seen = new Set();
    const keys = [];
    order.forEach(k => {
      if (grade[k] && !seen.has(k)) { keys.push(k); seen.add(k); }
    });
    Object.keys(grade).forEach(k => {
      if (grade[k] && !seen.has(k)) { keys.push(k); seen.add(k); }
    });

    return keys
      .map(k => ({ key: k, time: normalizeGradeTime(grade[k]) }))
      .filter(p => p.time)
      .sort((a, b) => gradeSeconds(a.time) - gradeSeconds(b.time))
      .map((p, i, arr) => ({ ...p, nextTime: arr[i + 1]?.time || null }));
  }

  // ── Build roteiro calc times for today ──
  const todayCalc = {};
  if (state.roteiro.length) {
    recalcTimes();
    const occ = {};
    state.roteiro.forEach((item, i) => {
      if (item.type !== 'RPRO' || !item.IN) return;
      const base = _norm(baseProgramTitle(item.descricao));
      const prev = state.roteiro[i - 1];
      const pBase = prev && prev.type === 'RPRO' ? _norm(baseProgramTitle(prev.descricao)) : null;
      if (pBase !== base) {
        const n = occ[base] || 0;
        occ[base] = n + 1;
        todayCalc[n === 0 ? base : `${base} [${n + 1}ª]`] = item.IN;
      }
    });
  }

  // ── Render using a single CSS Grid ──────────────────────────────────────────
  // One grid: col 1 = time axis, cols 2-8 = days
  // Rows: 1 = header, 2..N = one per program slot
  // Each program placed at its exact row start + span to next program

  // Build unified time axis from all days
  const timeSet = new Set();
  DOW_ORDER.forEach(dow => {
    const g = loadGrade(dow);
    Object.values(g).forEach(t => {
      const nt = normalizeGradeTime(t);
      if (nt) timeSet.add(nt);
    });
  });
  // Garantir a janela 06:00 → 05:59 do dia seguinte: sempre exibir os slots
  // horários das madrugadas (00:00–05:00) mesmo quando não há programa neles,
  // para que os programas da madrugada apareçam corretamente na grade semanal.
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0') + ':00:00';
    timeSet.add(hh);
  }
  const timeAxis = [...timeSet].sort((a,b)=>_gradeTimeKey(a).localeCompare(_gradeTimeKey(b)));
  const timeToRow = {}; // "HH:MM:SS" → grid row number (1-based, +2 for header)
  timeAxis.forEach((t, i) => { timeToRow[t] = i + 2; }); // row 1 = header
  const totalRows = timeAxis.length + 2;

  // Start building the single grid container
  // Grid columns: 55px (time) + 7 × 1fr
  let cells = '';

  // Header cells (row 1)
  cells += `<div class="gv-th gv-time-hdr" style="grid-column:1;grid-row:1">Horário</div>`;
  DOW_ORDER.forEach((dow, ci2) => {
    const isToday = dow === curDow;
    cells += `<div class="gv-th gv-day-hdr ${isToday ? 'gv-today' : ''}"
      style="grid-column:${ci2 + 2};grid-row:1">${DOW_FULL[dow]}</div>`;
  });

  // Time axis labels (col 1, one per row)
  timeAxis.forEach((t, i) => {
    const row = i + 2;
    const label = t.substring(0, 5);
    cells += `<div class="gv-time-label" style="grid-column:1;grid-row:${row}">${label}</div>`;
  });

  // Program cells per day
  DOW_ORDER.forEach((dow, ci2) => {
    const col = ci2 + 2;
    const progs = dayPrograms(dow);
    const isToday = dow === curDow;

    progs.forEach(prog => {
      const rowStart = timeToRow[prog.time];
      if (!rowStart) return;

      // Span: from this program's time to the next program's time.
      // Se nextTime for null (último programa do dia) OU se ordenar antes do
      // atual (cruzou a virada da madrugada), estica até o fim do eixo.
      let rowEnd;
      if (!prog.nextTime) {
        rowEnd = totalRows;
      } else if (timeToRow[prog.nextTime] && timeToRow[prog.nextTime] > rowStart) {
        rowEnd = timeToRow[prog.nextTime];
      } else {
        rowEnd = totalRows;
      }
      const span = Math.max(1, rowEnd - rowStart);

      const color = getColor(prog.key);
      const normKey = _norm(prog.key);

      // Indicator for today's roteiro
      let indicator = '';
      if (isToday && todayCalc[normKey] !== undefined) {
        const diff = timeToSec(todayCalc[normKey]) - timeToSec(prog.time);
        if (Math.abs(diff) <= REGRAS.gradeTolerancia) {
          indicator = `<span class="gv-ok" title="No horário">✓</span>`;
        } else {
          const sign = diff > 0 ? '+' : '';
          const absDiff = Math.abs(diff);
          const str = absDiff < 60
            ? `${sign}${diff}s`
            : `${sign}${Math.round(diff / 60)}min`;
          indicator = `<span class="gv-warn" title="Desvio: ${str}">${str}</span>`;
        }
      } else if (isToday && Object.keys(todayCalc).length > 0) {
        // Roteiro loaded but this program not found = not in today's roteiro
        indicator = `<span class="gv-absent" title="Não encontrado no roteiro">—</span>`;
      }

      const occLabel = prog.key.match(/\[(\d+ª)\]$/)?.[1] || '';
      const keyNoOcc = prog.key.replace(/\s*\[\d+ª\]$/, '');
      const { title: dispName, episode: epLabel } = _splitTitleEpisode(keyNoOcc);
      const entryTime = prog.time.substring(0, 5);

      cells += `<div class="gv-prog"
        style="grid-column:${col};grid-row:${rowStart}/span ${span};--prog-color:${color}"
        title="${escHtml(prog.key)} | ${entryTime}">
        <div class="gv-prog-top">
          <span class="gv-prog-time">${entryTime}${occLabel ? `<em> ${occLabel}</em>` : ''}</span>
          ${indicator}
        </div>
        <div class="gv-prog-name">${escHtml(dispName)}</div>
        ${epLabel ? `<div class="gv-prog-ep" style="font-size:9px;opacity:.75;font-family:var(--mono);margin-top:1px">${escHtml(epLabel)}</div>` : ''}
      </div>`;
    });
  });

  // Assemble
  container.innerHTML = `
    <div class="gv-grid" style="grid-template-rows:36px repeat(${timeAxis.length},minmax(36px,auto))">
      ${cells}
    </div>`;

  // Popular o datalist do color picker com nomes de programas conhecidos
  const dl = document.getElementById('grade-prog-list');
  if (dl) {
    const names = new Set();
    DOW_ORDER.forEach(dow => {
      Object.keys(loadGrade(dow)).forEach(k => {
        const noOcc = k.replace(/\s*\[\d+ª\]$/, '').trim();
        names.add(_splitTitleEpisode(noOcc).title.trim());
      });
    });
    dl.innerHTML = [...names].sort().map(n => `<option value="${escHtml(n)}"></option>`).join('');
  }
}

// =====================================================
// REGRAS POR TIPO — UI no Admin + validação no roteiro
// =====================================================

const TIPOS_CONFIGURAVEIS = ['ECHM', 'ECHE', 'EINT', 'RCOM', 'RPOL', 'EVNH'];

/** Converte "HH:MM" em segundos desde meia-noite. */
function _hhmmToSec(s) {
  const [h, m] = (s || '00:00').split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
}

/** Renderiza as linhas de configuração por tipo dentro do modal Admin. */
function renderRegrasTiposUI(regras) {
  const wrap = document.getElementById('adm-regras-tipos');
  if (!wrap) return;
  const rt = regras.regrasTipos || {};
  wrap.innerHTML = TIPOS_CONFIGURAVEIS.map(tipo => {
    const r = rt[tipo] || { ativo: true, inicio: '06:00', fim: '23:59', intervaloMinMin: 0, naoAdjacenteA: [] };
    const adjOpts = TIPOS_CONFIGURAVEIS.filter(t => t !== tipo).map(t => {
      const sel = (r.naoAdjacenteA || []).includes(t) ? 'selected' : '';
      return `<option value="${t}" ${sel}>${t}</option>`;
    }).join('');
    return `<div class="adm-tipo-row" data-tipo="${tipo}"
      style="display:grid;grid-template-columns:18px 56px 78px 78px 70px 1fr;gap:6px;align-items:center;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px">
      <input type="checkbox" data-f="ativo" ${r.ativo !== false ? 'checked' : ''} title="Ativar regras para este tipo" style="accent-color:var(--accent)">
      <span class="type-badge badge-${tipo}" style="text-align:center">${tipo}</span>
      <input type="time" data-f="inicio" value="${r.inicio || '06:00'}" title="Janela permitida — início" style="font-family:var(--mono);font-size:11px;padding:3px 4px;background:var(--bg2);border:1px solid var(--border2);color:var(--text);border-radius:4px">
      <input type="time" data-f="fim"    value="${r.fim    || '23:59'}" title="Janela permitida — fim"    style="font-family:var(--mono);font-size:11px;padding:3px 4px;background:var(--bg2);border:1px solid var(--border2);color:var(--text);border-radius:4px">
      <input type="number" data-f="intervalo" min="0" max="600" value="${r.intervaloMinMin || 0}" title="Intervalo mínimo (min) entre repetições da MESMA peça" style="font-family:var(--mono);font-size:11px;padding:3px 4px;background:var(--bg2);border:1px solid var(--border2);color:var(--text);border-radius:4px">
      <select data-f="adj" multiple size="1" title="Tipos que não podem aparecer imediatamente antes ou depois (Ctrl+clique p/ múltipla seleção)"
        style="font-family:var(--mono);font-size:10px;padding:3px 4px;background:var(--bg2);border:1px solid var(--border2);color:var(--text);border-radius:4px;min-height:26px">
        ${adjOpts}
      </select>
    </div>`;
  }).join('');
  // Header
  wrap.insertAdjacentHTML('afterbegin',
    `<div style="display:grid;grid-template-columns:18px 56px 78px 78px 70px 1fr;gap:6px;font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:0 8px">
       <span>On</span><span>Tipo</span><span>Início</span><span>Fim</span><span>Min. repet.</span><span>Não adjacente a</span>
     </div>`);
}

/** Lê as linhas do UI e devolve o objeto regrasTipos. */
function readRegrasTiposFromUI() {
  const out = {};
  document.querySelectorAll('#adm-regras-tipos .adm-tipo-row').forEach(row => {
    const tipo = row.dataset.tipo;
    const sel  = row.querySelector('[data-f="adj"]');
    const naoAdj = Array.from(sel.selectedOptions).map(o => o.value);
    out[tipo] = {
      ativo:          row.querySelector('[data-f="ativo"]').checked,
      inicio:         row.querySelector('[data-f="inicio"]').value || '06:00',
      fim:            row.querySelector('[data-f="fim"]').value    || '23:59',
      intervaloMinMin: parseInt(row.querySelector('[data-f="intervalo"]').value) || 0,
      naoAdjacenteA:  naoAdj,
    };
  });
  return out;
}

// Patch openAdminModal: ao abrir, popular as regras por tipo
const _origOpenAdminModal = openAdminModal;
openAdminModal = function() {
  _origOpenAdminModal();
  renderRegrasTiposUI(loadRegras());
};

// Patch saveAdminRegras: ao salvar, mesclar regrasTipos e sincronizar RPOL legacy
const _origSaveAdminRegras = saveAdminRegras;
saveAdminRegras = function() {
  const regrasTipos = readRegrasTiposFromUI();
  // Sincroniza janela RPOL legacy com a configuração do tipo RPOL
  if (regrasTipos.RPOL) {
    document.getElementById('adm-rpol-inicio').value = regrasTipos.RPOL.inicio;
    document.getElementById('adm-rpol-fim').value    = regrasTipos.RPOL.fim;
  }
  _origSaveAdminRegras();
  // Anexa regrasTipos ao objeto salvo
  const atual = loadRegras();
  atual.regrasTipos = regrasTipos;
  saveRegras(atual);
  REGRAS = loadRegras();
  renderRoteiro();
};

/**
 * Valida o roteiro inteiro contra REGRAS.regrasTipos.
 * Retorna { [idx]: [msg1, msg2, ...] } com avisos por linha.
 */
function validateRoteiroRegras() {
  const out = {};
  const rt = REGRAS.regrasTipos || {};
  const itens = state.roteiro;
  // Mapa: code -> [seg, idx] das ocorrências anteriores (para intervalo mínimo)
  const ocorrPorCode = {};
  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    if (!it || !it.type || it.type === '__SLOT__' || it.type === 'RPRO') continue;
    const cfg = rt[it.type];
    if (!cfg || !cfg.ativo) continue;
    const sec = it.IN ? timeToSec(it.IN) : null;
    const msgs = [];

    // Janela horária
    if (sec != null) {
      const ini = _hhmmToSec(cfg.inicio);
      const fim = _hhmmToSec(cfg.fim);
      if (sec < ini || sec > fim) {
        msgs.push(`${it.type} fora da janela ${cfg.inicio}–${cfg.fim} (IN ${it.IN})`);
      }
    }

    // Não-adjacente: olha vizinho anterior e próximo (pulando programas/slots)
    const _viz = (delta) => {
      let j = i + delta;
      while (j >= 0 && j < itens.length) {
        const v = itens[j];
        if (v && v.type && v.type !== '__SLOT__' && v.type !== 'RPRO') return v;
        j += delta;
      }
      return null;
    };
    const proibidos = cfg.naoAdjacenteA || [];
    if (proibidos.length) {
      const ant = _viz(-1);
      const pos = _viz(+1);
      if (ant && proibidos.includes(ant.type)) msgs.push(`adjacente a ${ant.type} (proibido)`);
      if (pos && proibidos.includes(pos.type)) msgs.push(`adjacente a ${pos.type} (proibido)`);
    }

    // Intervalo mínimo entre repetições da MESMA peça (por code)
    if (cfg.intervaloMinMin > 0 && it.code && sec != null) {
      const prev = ocorrPorCode[it.code];
      if (prev != null) {
        const deltaMin = (sec - prev) / 60;
        if (deltaMin < cfg.intervaloMinMin) {
          msgs.push(`repetida ${Math.round(deltaMin)}min depois (mín. ${cfg.intervaloMinMin}min)`);
        }
      }
      ocorrPorCode[it.code] = sec;
    } else if (it.code && sec != null) {
      ocorrPorCode[it.code] = sec;
    }

    if (msgs.length) out[i] = msgs;
  }
  return out;
}

/** Aplica os ⚠ no DOM já renderizado pelo renderRoteiro. */
function applyRegraWarningsToDom() {
  const warns = validateRoteiroRegras();
  const rows = document.querySelectorAll('#roteiro-tbody tr');
  // O índice das rows do tbody bate com state.roteiro APENAS antes da injeção
  // de break-summary. injectBreakSummaries adiciona rows extras com classe
  // break-summary-row. Vamos filtrar.
  const dataRows = Array.from(rows).filter(r => !r.classList.contains('break-summary-row'));
  Object.keys(warns).forEach(idx => {
    const tr = dataRows[+idx];
    if (!tr) return;
    const desc = tr.querySelector('.col-desc');
    if (!desc) return;
    const tip = warns[idx].join(' · ');
    const badge = `<span title="${escAttr(tip)}" style="display:inline-block;margin-left:6px;color:var(--amber);font-weight:600;cursor:help">⚠</span>`;
    desc.insertAdjacentHTML('beforeend', badge);
    tr.style.boxShadow = 'inset 3px 0 0 var(--amber)';
  });
}

// Hook: depois de renderRoteiro, aplicar os warnings + atualizar busca
const _origRenderRoteiro = renderRoteiro;
renderRoteiro = function() {
  _origRenderRoteiro.apply(this, arguments);
  try { applyRegraWarningsToDom(); } catch(e) { console.warn('warnings:', e); }
  try { findInRoteiro(/* silencioso */ true); } catch(e) {}
};

// =====================================================
// BUSCAR & SUBSTITUIR — barra acima da tabela do roteiro
// =====================================================

let _findState = { matches: [], cursor: -1 };

/** Limpa highlights anteriores. */
function _clearFindHighlights() {
  document.querySelectorAll('#roteiro-tbody tr.row-find-hit').forEach(tr => {
    tr.classList.remove('row-find-hit');
    tr.style.outline = '';
  });
  document.querySelectorAll('#roteiro-tbody tr.row-find-cursor').forEach(tr => {
    tr.classList.remove('row-find-cursor');
  });
}

/** Busca peças por code ou descrição no roteiro atual. */
function findInRoteiro(silencioso) {
  const inp = document.getElementById('find-input');
  const cnt = document.getElementById('find-count');
  if (!inp || !cnt) return;
  const q = inp.value.trim().toLowerCase();
  _clearFindHighlights();
  if (!q) {
    _findState = { matches: [], cursor: -1 };
    cnt.textContent = '—';
    cnt.style.color = 'var(--muted)';
    return;
  }
  const matches = [];
  state.roteiro.forEach((it, i) => {
    if (!it || it.type === '__SLOT__') return;
    const code = (it.code || '').toLowerCase();
    const desc = (it.descricao || '').toLowerCase();
    if (code.includes(q) || desc.includes(q)) matches.push(i);
  });
  _findState.matches = matches;
  if (_findState.cursor >= matches.length) _findState.cursor = matches.length - 1;
  if (_findState.cursor < 0 && matches.length) _findState.cursor = 0;

  // Resumo
  const codes = new Set(matches.map(i => state.roteiro[i].code));
  if (matches.length === 0) {
    cnt.textContent = '0 ocorrências';
    cnt.style.color = 'var(--red)';
  } else {
    cnt.textContent = `${matches.length} ocorrência${matches.length>1?'s':''} · ${codes.size} peça${codes.size>1?'s':''}`;
    cnt.style.color = 'var(--green)';
  }

  // Aplica highlights
  const dataRows = Array.from(document.querySelectorAll('#roteiro-tbody tr'))
    .filter(r => !r.classList.contains('break-summary-row'));
  matches.forEach((idx, k) => {
    const tr = dataRows[idx];
    if (!tr) return;
    tr.classList.add('row-find-hit');
    tr.style.outline = '2px solid var(--cyan)';
    if (k === _findState.cursor) {
      tr.classList.add('row-find-cursor');
      tr.style.outline = '2px solid var(--accent)';
      if (!silencioso) tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  });
}

/** Move cursor (-1 ou +1) entre as ocorrências da busca. */
function findStepRoteiro(delta) {
  if (!_findState.matches.length) return;
  _findState.cursor = (_findState.cursor + delta + _findState.matches.length) % _findState.matches.length;
  findInRoteiro();
}

/** Valida o code informado no campo "substituir por" e mostra a descrição. */
function findValidateReplace() {
  const inp = document.getElementById('replace-input');
  const lbl = document.getElementById('replace-desc');
  if (!inp || !lbl) return;
  const code = inp.value.trim();
  if (!code) { lbl.textContent = '—'; lbl.style.color = 'var(--muted)'; return; }
  const peca = (state.pecas || []).find(p => String(p.code) === code);
  if (peca) {
    lbl.textContent = `${peca.descricao} (${peca.tempo} · ${peca.type})`;
    lbl.style.color = 'var(--green)';
  } else {
    lbl.textContent = `code não encontrado no banco`;
    lbl.style.color = 'var(--red)';
  }
}

/** Substitui TODAS as ocorrências encontradas pela peça do code informado. */
/** Substitui apenas a ocorrência atualmente destacada (cursor da busca). */
function replaceCurrentInRoteiro() {
  if (!_findState.matches.length || _findState.cursor < 0) {
    toast('Nenhuma ocorrência selecionada — faça uma busca primeiro', 'error');
    return;
  }
  const code = (document.getElementById('replace-input').value || '').trim();
  if (!code) { toast('Informe o code da peça substituta', 'error'); return; }
  const nova = (state.pecas || []).find(p => String(p.code) === code);
  if (!nova) { toast(`Peça com code "${code}" não está no banco`, 'error'); return; }

  const idx = _findState.matches[_findState.cursor];
  const it = state.roteiro[idx];
  if (!it) { toast('Ocorrência não encontrada', 'error'); return; }
  const antigo = it.descricao;
  it.code      = nova.code;
  it.descricao = nova.descricao;
  it.tempo     = nova.tempo;
  it.type      = nova.type;
  if (nova.midia) it.midia = nova.midia;

  toast(`✅ #${idx+1} "${antigo}" → ${nova.code}`, 'success');
  // Avança o cursor para a próxima ocorrência da busca antiga; após renderizar,
  // a busca é re-executada e o conjunto de matches é recalculado.
  const proxCursor = _findState.cursor; // mantém posição; matches mudará
  renderRoteiro();
  saveState();
  // Re-roda a busca; se ainda houver matches, posiciona no que era o próximo
  findInRoteiro();
  if (_findState.matches.length) {
    _findState.cursor = Math.min(proxCursor, _findState.matches.length - 1);
    findInRoteiro();
  }
}

function replaceAllInRoteiro() {
  if (!_findState.matches.length) {
    toast('Nada para substituir — faça uma busca primeiro', 'error');
    return;
  }
  const code = (document.getElementById('replace-input').value || '').trim();
  if (!code) { toast('Informe o code da peça substituta', 'error'); return; }
  const nova = (state.pecas || []).find(p => String(p.code) === code);
  if (!nova) { toast(`Peça com code "${code}" não está no banco`, 'error'); return; }

  const n = _findState.matches.length;
  if (!confirm(`Substituir ${n} ocorrência${n>1?'s':''} por "${nova.descricao}" (${nova.code})?`)) return;

  _findState.matches.forEach(idx => {
    const it = state.roteiro[idx];
    if (!it) return;
    it.code      = nova.code;
    it.descricao = nova.descricao;
    it.tempo     = nova.tempo;
    it.type      = nova.type;
    if (nova.midia) it.midia = nova.midia;
  });

  toast(`✅ ${n} ocorrência${n>1?'s':''} substituída${n>1?'s':''} por ${nova.code}`, 'success');
  _findState = { matches: [], cursor: -1 };
  document.getElementById('find-input').value = nova.code;
  renderRoteiro();
  saveState();
}

// =====================================================
// IMPORTAR GRADE SEMANAL A PARTIR DE PLANILHA (.xlsx)
// Lê uma aba com colunas Seg..Dom em slots de 5 minutos
// (coluna A = horário) e converte em gradeByDay/gradeOrderByDay.
// =====================================================
let _gradeImport = { wb: null, parsed: null };

/** Mapeia o cabeçalho da coluna ("SEGUNDA\n01/06/26", "DOMINGO 07/06/26"...) para dow (0..6). */
function _gradeDowFromHeader(h) {
  const s = String(h || '').toUpperCase();
  if (s.includes('DOMINGO')) return 0;
  if (s.includes('SEGUNDA')) return 1;
  if (s.includes('TERÇA') || s.includes('TERCA')) return 2;
  if (s.includes('QUARTA')) return 3;
  if (s.includes('QUINTA')) return 4;
  if (s.includes('SEXTA'))  return 5;
  if (s.includes('SÁBADO') || s.includes('SABADO')) return 6;
  return null;
}

/** Normaliza o título do programa: primeira linha não-vazia, em CAIXA ALTA,
 *  removendo sufixos comuns (T01, EP 03, 12', REPRISE, AO VIVO, INÉDITO). */
function _gradeProgTitle(raw) {
  if (!raw) return '';
  const firstLine = String(raw).split(/\r?\n/).map(s => s.trim()).find(s => s.length > 0) || '';
  let t = firstLine.toUpperCase();
  // remover marcadores e durações
  t = t.replace(/\s*[-–|]?\s*(REPRISE|AO\s*VIVO|IN[ÉE]DITO|ESTREIA)\s*$/g, '');
  t = t.replace(/\s*[-–|]?\s*T\s*\d+\s*(EP\.?\s*\d+)?\s*$/g, '');
  t = t.replace(/\s*[-–|]?\s*EP\.?\s*\d+\s*$/g, '');
  t = t.replace(/\s+\d+\s*['’]\s*$/g, '');
  return t.trim();
}

// ═══ [MOD] Extração de identificador de episódio (Temporada/Episódio) ═══
/** Extrai o identificador de temporada/episódio de qualquer linha da célula
 *  (o marcador pode vir na 1ª linha junto do título ou numa linha própria),
 *  ex.: "T01 EP03" → "T01 EP03", "EP05" → "EP05", "T2" → "T02".
 *  Case-insensitive. Retorna '' quando não há padrão reconhecido.
 *  IMPORTANTE: não altera nem depende de _gradeProgTitle(). */
function _gradeEpisodeId(raw) {
  if (!raw) return '';
  const text = String(raw);
  const m = text.match(/T\s*(\d+)\s*(?:EP\.?\s*(\d+))?|EP\.?\s*(\d+)/i);
  if (!m) return '';
  const season  = m[1] || null;
  const episode = m[2] || m[3] || null;
  const parts = [];
  if (season)  parts.push('T' + season.padStart(2, '0'));
  if (episode) parts.push('EP' + episode.padStart(2, '0'));
  return parts.join(' ');
}
// ═══ [/MOD] ═══

/** Converte um valor de célula (fração de dia, Date, string "HH:MM:SS") em "HH:MM:SS". */
function _gradeCellToTime(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const totalSec = Math.round(v * 86400);
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  if (v instanceof Date) {
    const h = String(v.getHours()).padStart(2, '0');
    const m = String(v.getMinutes()).padStart(2, '0');
    const s = String(v.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  const m = String(v).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return `${m[1].padStart(2,'0')}:${m[2]}:${(m[3]||'00')}`;
  return null;
}

/** Handler do <input type=file>: lê o arquivo, lista as abas e prepara seleção. */
function handleGradeSemanalImport(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
      _gradeImport.wb = wb;
      const sel = document.getElementById('grade-import-sheet');
      sel.innerHTML = '';
      // Preferir abas que parecem semanais (têm "DE" / mês), mas oferecer todas
      wb.SheetNames.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n; opt.textContent = n;
        sel.appendChild(opt);
      });
      // pré-selecionar primeira aba que não seja "GPT cache"
      const firstReal = wb.SheetNames.find(n => !/cache/i.test(n)) || wb.SheetNames[0];
      sel.value = firstReal;
      sel.onchange = () => _gradePreviewSelectedSheet();
      document.getElementById('grade-import-sheets').style.display = 'block';
      _gradePreviewSelectedSheet();
    } catch (err) {
      console.error(err);
      toast('Erro ao ler planilha: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
  ev.target.value = '';
}

/** Expande células mescladas: devolve uma matriz onde toda célula de uma
 *  mescla carrega o valor da âncora (top-left). Sem isso, SheetJS devolve
 *  null nas células secundárias da mescla. */
function _gradeExpandMerges(ws, rows) {
  const merges = ws['!merges'] || [];
  const out = rows.map(r => (r ? r.slice() : []));
  for (const m of merges) {
    const { s, e } = m;
    const anchor = (out[s.r] || [])[s.c];
    if (anchor == null || anchor === '') continue;
    for (let r = s.r; r <= e.r; r++) {
      if (!out[r]) out[r] = [];
      for (let c = s.c; c <= e.c; c++) {
        if (out[r][c] == null || out[r][c] === '') out[r][c] = anchor;
      }
    }
  }
  return out;
}

/** Parseia a aba selecionada e mostra um preview do que será aplicado. */
function _gradePreviewSelectedSheet() {
  const sheetName = document.getElementById('grade-import-sheet').value;
  const ws = _gradeImport.wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  if (!rawRows || rawRows.length < 2) {
    document.getElementById('grade-import-preview').textContent = '⚠ Aba vazia';
    _gradeImport.parsed = null;
    return;
  }
  // Expandir mescla — crítico para grades onde programas longos são mesclados
  const rows = _gradeExpandMerges(ws, rawRows);
  // Detectar linha de cabeçalho — a primeira linha com pelo menos 3 nomes de dia
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const dowCount = (rows[i] || []).filter(c => _gradeDowFromHeader(c) !== null).length;
    if (dowCount >= 3) { headerRowIdx = i; break; }
  }
  const header = rows[headerRowIdx] || [];
  const colToDow = {};
  header.forEach((c, idx) => {
    const dow = _gradeDowFromHeader(c);
    if (dow !== null && colToDow[idx] === undefined) colToDow[idx] = dow;
  });
  if (Object.keys(colToDow).length === 0) {
    document.getElementById('grade-import-preview').textContent = '⚠ Não encontrei colunas de dias da semana nesta aba';
    _gradeImport.parsed = null;
    return;
  }
  const gradeByDay = {}, gradeOrderByDay = {}, counters = {}, lastTitleByDow = {};
  for (const dow of Object.values(colToDow)) {
    gradeByDay[dow] = {};
    gradeOrderByDay[dow] = [];
    counters[dow] = {};
    lastTitleByDow[dow] = null;
  }
  let crossedStart = false; // só ignoramos a "madrugada inicial" antes de cruzarmos 06:00
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const time = _gradeCellToTime(row[0]);
    if (!time) continue;
    // A grade do canal começa às 06:00. Linhas ANTES de cruzarmos 06:00 são
    // sobra de madrugada e ficam de fora; depois que entramos no dia,
    // aceitamos todos os horários — inclusive a varredura noturna que
    // estoura a meia-noite (00:00–05:59 do dia seguinte).
    if (!crossedStart) {
      if (time < '06:00:00') continue;
      crossedStart = true;
    }
    for (const [colIdxStr, dow] of Object.entries(colToDow)) {
      const colIdx = Number(colIdxStr);
      const cell = row[colIdx];
      const title = sanitizeText(_gradeProgTitle(cell));
      if (!title) continue;
      // ═══ [MOD] Captura episódio (T/EP) e monta fullTitle p/ chaves ═══
      const episode = sanitizeText(_gradeEpisodeId(cell));
      const fullTitle = episode ? `${title} - ${episode}` : title;
      // ═══ [/MOD] ═══
      // Mesmo programa (mesmo título + episódio) do slot anterior → o
      // episódio ainda está ocupando a faixa, não é uma nova exibição.
      // Pula esta linha sem criar chave nova nem incrementar o contador,
      // deixando o horário de início já registrado valer para toda a faixa.
      if (fullTitle === lastTitleByDow[dow]) continue;
      // Novo programa (ou novo episódio do mesmo programa) começa AQUI —
      // este é o horário de início.
      // ═══ [MOD] counters/gradeByDay/gradeOrderByDay/lastTitleByDow agora
      // usam fullTitle (título + episódio) em vez de title puro, para que
      // episódios diferentes do mesmo programa não colidam na mesma chave.
      // A lógica de repetição [2ª]/[3ª] continua funcionando normalmente,
      // agora por combinação título+episódio. ═══
      counters[dow][fullTitle] = (counters[dow][fullTitle] || 0) + 1;
      const key = counters[dow][fullTitle] === 1 ? fullTitle : `${fullTitle} [${counters[dow][fullTitle]}ª]`;
      gradeByDay[dow][key] = time;
      gradeOrderByDay[dow].push(key);
      lastTitleByDow[dow] = fullTitle;
      // ═══ [/MOD] ═══
    }
  }
  _gradeImport.parsed = { gradeByDay, gradeOrderByDay };
  const DAY_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const lines = Object.keys(gradeByDay).sort().map(dow => {
    const first3 = gradeOrderByDay[dow].slice(0, 3)
      .map(k => `${gradeByDay[dow][k]} ${k}`).join(' · ');
    return `<div><b style="color:var(--accent)">${DAY_PT[dow]}</b> (${gradeOrderByDay[dow].length}): ${escHtml(first3)}…</div>`;
  });
  document.getElementById('grade-import-preview').innerHTML =
    `<b>Aba:</b> ${escHtml(sheetName)}<br>${lines.join('')}`;
}

/** Aplica a grade parseada ao localStorage, substituindo a grade de cada dia detectado. */
function applyGradeSemanalImport() {
  if (!_gradeImport.parsed) {
    toast('Selecione e parseie uma aba primeiro', 'error');
    return;
  }
  const { gradeByDay, gradeOrderByDay } = _gradeImport.parsed;
  const saved = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  saved.gradeByDay = saved.gradeByDay || {};
  saved.gradeOrderByDay = saved.gradeOrderByDay || {};
  let totalDays = 0, totalProgs = 0;
  for (const dow of Object.keys(gradeByDay)) {
    saved.gradeByDay[dow] = gradeByDay[dow];
    saved.gradeOrderByDay[dow] = gradeOrderByDay[dow];
    totalDays++;
    totalProgs += gradeOrderByDay[dow].length;
  }
  localStorage.setItem('roteiroApp', JSON.stringify(saved));
  toast(`✓ Grade aplicada: ${totalDays} dias, ${totalProgs} programas`, 'success');
  // Re-renderizar caso a grade do dia atual tenha mudado
  if (typeof renderRoteiro === 'function') renderRoteiro();
}

// =====================================================
// START
// =====================================================
init();



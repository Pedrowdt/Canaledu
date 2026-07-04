// =====================================================
// CLOUD SYNC — Login + sincronização em nuvem (Supabase)
// Roteiro Canal Educação
// GNU GPL v3 · Canal Educação / MEC · 2026
//
// Este arquivo:
//  1) Mostra a tela de login e autentica via Supabase Auth.
//  2) Ao logar, baixa os dados da nuvem e os grava no
//     localStorage ANTES de carregar o resto do app —
//     assim app.js/pecas_dia.js/parts-store.js funcionam
//     exatamente como já funcionavam localmente, sem
//     precisar ser reescritos.
//  3) Depois disso, intercepta as gravações no localStorage
//     e replica em segundo plano para o Supabase:
//       - banco de peças/programas/grade/regras -> tabela
//         compartilhada (shared_data), visível a toda a equipe
//       - roteiro do dia e peças do dia -> tabela por usuário
//         (user_data), isolada por login
//  4) Escuta mudanças em tempo real na tabela compartilhada
//     para refletir edições de outros usuários sem precisar
//     recarregar a página.
//
// CONFIGURAÇÃO NECESSÁRIA: veja DEPLOY.md
// =====================================================

// ── 1) PREENCHA COM OS DADOS DO SEU PROJETO SUPABASE ──
const SUPABASE_URL      = 'https://ewfewxrioxvnqfwhwbuj.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_BDDWYibO1f7lGuwL1934LA_JuOx-MT6';

const WORKSPACE_ID = 'workspace'; // id fixo da linha compartilhada (não precisa mudar)

const SCRIPTS_TO_LOAD = [
  'api-sync.js',
  'grade_base.js',
  'data.js',
  'parts-store.js',
  'pecas_dia.js',
  'app.js',
  'banco-manager.js',
];

let supabaseClient = null;
let currentUser = null;
let _origSetItem = null;
let _pushTimer = null;

function isConfigured() {
  return !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_ANON_KEY.includes('SUA-CHAVE');
}

function setSyncStatus(msg, show = true) {
  const el = document.getElementById('cloud-sync-status');
  if (!el) return;
  el.textContent = msg;
  el.style.display = show ? 'block' : 'none';
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (el) el.textContent = msg || '';
}

// =====================================================
// LOGIN
// =====================================================
async function cloudSyncLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-submit');
  showLoginError('');

  if (!email || !password) {
    showLoginError('Informe e-mail e senha.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando...';

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    showLoginError('E-mail ou senha inválidos.');
    btn.disabled = false;
    btn.textContent = 'Entrar';
    return;
  }

  await onAuthenticated(data.user);
}

function addLogoutUI(email) {
  const status = document.getElementById('cloud-sync-status');
  if (!status) return;
  status.style.display = 'block';
  status.innerHTML = '';

  const span = document.createElement('span');
  span.textContent = email + ' · ';

  const link = document.createElement('a');
  link.href = '#';
  link.textContent = 'Sair';
  link.style.color = 'inherit';
  link.onclick = async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    location.reload();
  };

  status.appendChild(span);
  status.appendChild(link);
}

// =====================================================
// CARREGA OS SCRIPTS DO APP NA ORDEM ORIGINAL
// (só depois que os dados da nuvem já estão no localStorage)
// =====================================================
function loadScriptsSequentially() {
  return SCRIPTS_TO_LOAD.reduce(
    (promise, src) =>
      promise.then(
        () =>
          new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Falha ao carregar ' + src));
            document.body.appendChild(s);
          })
      ),
    Promise.resolve()
  );
}

// =====================================================
// BUSCA DADOS DA NUVEM E MESCLA NO localStorage
// =====================================================
async function fetchAndMergeCloudData(user) {
  const { data: shared } = await supabaseClient
    .from('shared_data')
    .select('*')
    .eq('id', WORKSPACE_ID)
    .maybeSingle();

  const { data: userRow } = await supabaseClient
    .from('user_data')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const localRaw    = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  const localRegras = JSON.parse(localStorage.getItem('roteiroRegras') || '{}');

  const sharedEmpty  = !shared || (!(shared.pecas || []).length && !(shared.programas || []).length);
  const localHasData = (localRaw.pecas && localRaw.pecas.length) || (localRaw.programas && localRaw.programas.length);

  const merged = {};

  if (sharedEmpty && localHasData) {
    // Primeiro acesso: este navegador já tinha dados locais (uso anterior
    // sem login) e a nuvem ainda está vazia -> usamos os dados locais como
    // ponto de partida do banco compartilhado da equipe.
    merged.pecas           = localRaw.pecas || [];
    merged.programas       = localRaw.programas || [];
    merged.grade           = localRaw.grade || {};
    merged.gradeByDay      = localRaw.gradeByDay || {};
    merged.gradeOrder      = localRaw.gradeOrder || {};
    merged.gradeOrderByDay = localRaw.gradeOrderByDay || {};

    await supabaseClient.from('shared_data').upsert({
      id: WORKSPACE_ID,
      pecas: merged.pecas,
      programas: merged.programas,
      grade: merged.grade,
      grade_by_day: merged.gradeByDay,
      grade_order: merged.gradeOrder,
      grade_order_by_day: merged.gradeOrderByDay,
      regras: localRegras,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    });

    localStorage.setItem('roteiroRegras', JSON.stringify(localRegras));
  } else {
    merged.pecas           = shared?.pecas || [];
    merged.programas       = shared?.programas || [];
    merged.grade           = shared?.grade || {};
    merged.gradeByDay      = shared?.grade_by_day || {};
    merged.gradeOrder      = shared?.grade_order || {};
    merged.gradeOrderByDay = shared?.grade_order_by_day || {};

    localStorage.setItem('roteiroRegras', JSON.stringify(shared?.regras || {}));
  }

  merged.roteiros   = userRow?.roteiros   || localRaw.roteiros   || {};
  merged.pecasDia   = userRow?.pecas_dia  || localRaw.pecasDia   || {};
  merged.pecasFixas = localRaw.pecasFixas || [];

  _origSetItem.call(localStorage, 'roteiroApp', JSON.stringify(merged));

  if (!userRow) {
    await supabaseClient.from('user_data').upsert({
      user_id: user.id,
      roteiros: merged.roteiros,
      pecas_dia: merged.pecasDia,
      updated_at: new Date().toISOString(),
    });
  }
}

// =====================================================
// INTERCEPTA GRAVAÇÕES NO localStorage E REPLICA NA NUVEM
// =====================================================
function patchLocalStorage() {
  localStorage.setItem = function (key, value) {
    _origSetItem.call(localStorage, key, value);
    if (key === 'roteiroApp' || key === 'roteiroRegras') {
      clearTimeout(_pushTimer);
      _pushTimer = setTimeout(pushToCloud, 900);
    }
  };
}

async function pushToCloud() {
  if (!currentUser) return;
  const app    = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  const regras = JSON.parse(localStorage.getItem('roteiroRegras') || '{}');

  setSyncStatus('Sincronizando...');
  try {
    await supabaseClient
      .from('shared_data')
      .update({
        pecas: app.pecas || [],
        programas: app.programas || [],
        grade: app.grade || {},
        grade_by_day: app.gradeByDay || {},
        grade_order: app.gradeOrder || {},
        grade_order_by_day: app.gradeOrderByDay || {},
        regras: regras,
        updated_by: currentUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', WORKSPACE_ID);

    await supabaseClient
      .from('user_data')
      .update({
        roteiros: app.roteiros || {},
        pecas_dia: app.pecasDia || {},
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', currentUser.id);

    setSyncStatus('Sincronizado ✓ · ' + currentUser.email);
  } catch (e) {
    console.warn('cloud-sync: falha ao sincronizar', e);
    setSyncStatus('Falha ao sincronizar (verifique a internet)');
  }
}

// =====================================================
// TEMPO REAL — reflete edições de outros usuários no
// banco compartilhado (peças, programas, grade, regras)
// =====================================================
function setupRealtime() {
  supabaseClient
    .channel('shared_data_changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'shared_data', filter: `id=eq.${WORKSPACE_ID}` },
      (payload) => {
        if (!payload.new || payload.new.updated_by === currentUser.id) return; // ignora a própria escrita

        const app = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
        app.pecas           = payload.new.pecas || [];
        app.programas       = payload.new.programas || [];
        app.grade           = payload.new.grade || {};
        app.gradeByDay      = payload.new.grade_by_day || {};
        app.gradeOrder      = payload.new.grade_order || {};
        app.gradeOrderByDay = payload.new.grade_order_by_day || {};
        _origSetItem.call(localStorage, 'roteiroApp', JSON.stringify(app));
        _origSetItem.call(localStorage, 'roteiroRegras', JSON.stringify(payload.new.regras || {}));

        if (typeof state !== 'undefined') {
          state.pecas     = app.pecas;
          state.programas = app.programas;
        }
        if (typeof REGRAS !== 'undefined') {
          Object.assign(REGRAS, payload.new.regras || {});
        }
        if (typeof renderAll === 'function') renderAll();

        setSyncStatus('Atualizado por outro usuário ✓');
      }
    )
    .subscribe();
}

// =====================================================
// FLUXO PRINCIPAL
// =====================================================
async function onAuthenticated(user) {
  currentUser = user;
  document.getElementById('login-overlay').style.display = 'none';
  setSyncStatus('Carregando dados da equipe...');

  try {
    await fetchAndMergeCloudData(user);
    await loadScriptsSequentially();
    document.querySelector('.app').style.display = '';
    patchLocalStorage();
    setupRealtime();
    addLogoutUI(user.email);
  } catch (e) {
    console.error(e);
    setSyncStatus('Erro ao carregar dados. Recarregue a página.');
  }
}

(function boot() {
  _origSetItem = localStorage.setItem.bind(localStorage);

  if (!isConfigured()) {
    showLoginError('Configuração pendente: preencha SUPABASE_URL e SUPABASE_ANON_KEY em cloud-sync.js (veja DEPLOY.md).');
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') cloudSyncLogin();
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    if (data?.session?.user) {
      onAuthenticated(data.session.user);
    }
  });
})();

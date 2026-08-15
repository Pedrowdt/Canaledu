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

// SUPABASE_URL, SUPABASE_ANON_KEY e WORKSPACE_ID vêm de supabase-config.js
// (carregado antes deste arquivo no index.html) — preencha-os lá, uma vez só.
const PECAS_PROGRAMAS_PAGE = 'pecas-programas.html';

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
let scriptsLoaded = false;
let _origSetItem = null;
let _pushTimer = null;
let _pushInFlight = false; // true durante o await do pushToCloud

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
  const email    = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-submit');
  showLoginError('');

  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    // Toda a autenticação passa por CanalAuth (auth.js): validação do
    // formulário, tradução das mensagens de erro e sessão compartilhada
    // com a tela de Peças e Programas.
    const { user } = await CanalAuth.signIn(email, password);
    await onAuthenticated(user);
  } catch (e) {
    console.error('[login]', e);
    showLoginError(e.message);
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
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
    // Encerra a sessão única (vale para as duas telas) e recarrega,
    // garantindo que nenhum dado da equipe fique em tela após o logout.
    await CanalAuth.signOut();
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

  // FONTE DA VERDADE do banco de peças/programas: as tabelas relacionais
  // preenchidas pela tela "Peças e Programas". A ponte cai para o espelho
  // shared_data automaticamente se a migração ainda não foi aplicada.
  const cadastro = await RoteiroPecasBridge.carregarCadastro({
    client: supabaseClient,
    sharedRow: shared,
    workspaceId: WORKSPACE_ID,
  });
  console.info('[cloud-sync] cadastro carregado de:', cadastro.origem,
    '· peças:', cadastro.pecas.length, '· programas:', cadastro.programas.length);

  const { data: userRow } = await supabaseClient
    .from('user_data')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const localRaw    = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  const localRegras = JSON.parse(localStorage.getItem('roteiroRegras') || '{}');

  const sharedEmpty  = !cadastro.pecas.length && !cadastro.programas.length;
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
    // Cadastro manda: o que veio das tabelas relacionais substitui o
    // snapshot local, então uma peça cadastrada agora já aparece no roteiro.
    // Cadastro manda, MAS o que este usuário criou/editou e ainda não
    // sincronizou continua em tela (fila do CadastroSync).
    const unidoInicial = RoteiroPecasBridge.mergeCadastro(
      { pecas: localRaw.pecas || [], programas: localRaw.programas || [] },
      cadastro
    );
    merged.pecas           = unidoInicial.pecas;
    merged.programas       = unidoInicial.programas;
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
      _pushTimer = setTimeout(() => {
        _pushTimer = null;
        pushToCloud();
      }, 900);
    }
  };
}

// Há uma escrita local (grade/regras) agendada ou em andamento para a
// nuvem. Enquanto isso for verdade, uma atualização remota não pode
// substituir a grade local inteira — apagaria a mudança que este usuário
// acabou de fazer e ainda não teve chance de enviar. (peças/programas não
// precisam dessa guarda: RoteiroPecasBridge.mergeCadastro já funde com o
// que está pendente em vez de sobrescrever.)
function temAlteracoesPendentes() {
  return _pushTimer !== null || _pushInFlight;
}

async function pushToCloud() {
  if (!currentUser) return;
  // Marca em andamento ANTES do primeiro await: enquanto isso, o handler de
  // tempo real (abaixo) não pode aplicar um snapshot remoto de grade por
  // cima do que está sendo enviado agora nem do que ainda não terminou de subir.
  _pushInFlight = true;
  const app    = JSON.parse(localStorage.getItem('roteiroApp') || '{}');
  const regras = JSON.parse(localStorage.getItem('roteiroRegras') || '{}');

  setSyncStatus('Sincronizando...');
  try {
    await supabaseClient
      .from('shared_data')
      .update({
        // pecas/programas NÃO vão mais daqui: o cadastro relacional
        // (tela Peças e Programas) é a fonte da verdade e chega em
        // shared_data pelo espelho no banco. Enviar o snapshot do
        // localStorage apagava o que outro usuário havia cadastrado.
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

    if (window.CadastroSync) await CadastroSync.flush().catch(() => {});
    if (window.CanalLog) CanalLog.registrar('roteiro_sincronizado', { grade: Object.keys(app.grade || {}).length });
    setSyncStatus('Sincronizado ✓ · ' + currentUser.email);
  } catch (e) {
    console.warn('cloud-sync: falha ao sincronizar', e);
    if (window.CanalLog) CanalLog.registrar('roteiro_sync_falhou', { mensagem: e.message || String(e) }, { nivel: 'error' });
    setSyncStatus('Falha ao sincronizar (verifique a internet)');
  } finally {
    _pushInFlight = false;
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
        // Peças/programas passam SEMPRE pela ponte: ela une o que veio da
        // nuvem com o que este usuário ainda não sincronizou. Atribuir
        // payload.new.pecas direto apagava da tela peças locais (e as do
        // outro usuário, quando o espelho JSONB estava atrasado).
        const cadastroEspelho = { pecas: payload.new.pecas || [], programas: payload.new.programas || [] };
        const unido = RoteiroPecasBridge.mergeCadastro(app, cadastroEspelho);
        app.pecas     = unido.pecas;
        app.programas = unido.programas;

        if (temAlteracoesPendentes()) {
          // Não sobrescreve a grade/regras locais: a gravação pendente
          // deste usuário vai subir em cima do que acabou de chegar (mesma
          // linha shared_data) e o próprio pushToCloud não apaga o que
          // outro usuário só precisa ver após a tela recarregar. Evita
          // apagar uma edição de grade feita há poucos instantes e ainda
          // não enviada — a mesma causa raiz que fazia peças "sumirem".
          _origSetItem.call(localStorage, 'roteiroApp', JSON.stringify(app));
          if (typeof state !== 'undefined') {
            state.pecas     = app.pecas;
            state.programas = app.programas;
          }
          if (window.CanalLog) {
            CanalLog.registrar('roteiro_sync_adiado', { motivo: 'alteracao_remota_com_edicao_local_pendente' }, { nivel: 'warn' });
          }
          setSyncStatus('Atualização remota recebida — aplicando após sua edição...');
          if (typeof renderAll === 'function') renderAll();
          return;
        }

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
        if (window.CanalLog) {
          CanalLog.registrar('roteiro_atualizado_por_outro_usuario', {
            por: payload.new.updated_by || null,
            pecas: app.pecas.length,
            programas: app.programas.length,
          });
        }
        if (typeof REGRAS !== 'undefined') {
          Object.assign(REGRAS, payload.new.regras || {});
        }
        if (typeof renderAll === 'function') renderAll();

        setSyncStatus('Atualizado por outro usuário ✓');
      }
    )
    .subscribe();

  // Tempo real do CADASTRO (tabelas relacionais). Sem isto, uma peça
  // cadastrada por outro usuário só apareceria no roteiro após recarregar.
  try {
    if (window.PecasRepo && typeof PecasRepo.onRemoteChange === 'function') {
      PecasRepo.onRemoteChange(async () => {
        const cadastro = await RoteiroPecasBridge.carregarCadastro({
          client: supabaseClient,
          workspaceId: WORKSPACE_ID,
        });
        const app = RoteiroPecasBridge.mergeCadastro(
          JSON.parse(localStorage.getItem('roteiroApp') || '{}'),
          cadastro
        );
        _origSetItem.call(localStorage, 'roteiroApp', JSON.stringify(app));
        if (typeof state !== 'undefined' && RoteiroPecasBridge.aplicarNoEstado(state, cadastro)) {
          if (typeof renderAll === 'function') renderAll();
          setSyncStatus('Cadastro atualizado ✓');
        }
      });
    }
  } catch (e) {
    console.warn('cloud-sync: tempo real do cadastro indisponível', e);
  }
}

// =====================================================
// FLUXO PRINCIPAL
// =====================================================
async function onAuthenticated(user) {
  currentUser = user;
  if (window.CanalLog) {
    CanalLog.init({ client: supabaseClient, user, tela: 'roteiro', workspaceId: WORKSPACE_ID });
    CanalLog.registrar('login', { email: user.email });
  }
  document.getElementById('login-overlay').style.display = 'none';
  addLogoutUI(user.email);
  document.getElementById('hub-overlay').style.display = 'flex';
}

async function cloudSyncOpenRoteiro() {
  document.getElementById('hub-overlay').style.display = 'none';

  if (scriptsLoaded) {
    // Já entramos no Roteiro antes nesta sessão — só reexibe, sem recarregar nada.
    document.querySelector('.app').style.display = '';
    document.getElementById('switch-app-link').style.display = 'inline-block';
    return;
  }

  setSyncStatus('Carregando dados da equipe...');
  try {
    await fetchAndMergeCloudData(currentUser);
    await loadScriptsSequentially();
    scriptsLoaded = true;
    document.querySelector('.app').style.display = '';
    document.getElementById('switch-app-link').style.display = 'inline-block';
    patchLocalStorage();
    if (window.CadastroSync) {
      // Fila de pendências do cadastro: sobe o que foi criado/editado no
      // Roteiro e reenvia o que ficou pendente de sessões anteriores.
      CadastroSync.init({ client: supabaseClient, user: currentUser, workspaceId: WORKSPACE_ID });
    }
    setupRealtime();
    setSyncStatus('Sincronizado ✓ · ' + currentUser.email);
  } catch (e) {
    console.error(e);
    setSyncStatus('Erro ao carregar dados. Recarregue a página.');
  }
}

function cloudSyncBackToHub(e) {
  if (e) e.preventDefault();
  document.querySelector('.app').style.display = 'none';
  document.getElementById('switch-app-link').style.display = 'none';
  document.getElementById('hub-overlay').style.display = 'flex';
}

function cloudSyncOpenPecasProgramas() {
  location.href = PECAS_PROGRAMAS_PAGE;
}

(function boot() {
  _origSetItem = localStorage.setItem.bind(localStorage);

  try {
    // Cliente Supabase singleton (auth.js). Uma única instância evita
    // sessões concorrentes entre esta tela e o cadastro.
    supabaseClient = CanalAuth.getClient();
  } catch (e) {
    showLoginError(e.message);
    return;
  }

  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') cloudSyncLogin();
  });

  // Se a sessão sumir (logout em outra aba, token revogado), volta ao login
  // em vez de deixar a tela aberta com dados da equipe.
  CanalAuth.onAuthChange((event) => {
    if (event === 'SIGNED_OUT') location.reload();
  });

  // Restaura a sessão persistida (com retentativas) e entra direto.
  CanalAuth.resolveSession().then((session) => {
    if (session) onAuthenticated(session.user);
  });
})();

function normalizeDia(d) {
  return String(d || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
// =====================================================
// PEÇAS E PROGRAMAS — Cadastro compartilhado
// Roteiro Canal Educação
//
// Login: reaproveita a sessão já aberta no Roteiro
// (mesmo Supabase Auth). Se não houver sessão, volta
// para a tela de login do Roteiro.
//
// Dados: lidos/gravados direto na mesma tabela
// compartilhada (shared_data) usada pelo Roteiro —
// colunas "pecas" e "programas". Qualquer edição aqui
// aparece automaticamente no banco de peças do Roteiro,
// e vice-versa (tempo real).
// =====================================================

'use strict';

const CATS = {
  CHAMADA_QUENTE:{label:'Chamada quente',short:'CHQTE',text:'#854F0B',bg:'#FAEEDA',border:'#EF9F27',dot:'#EF9F27'},
  RCOM:{label:'Comercial',short:'RCOM',text:'#0C447C',bg:'#E6F1FB',border:'#378ADD',dot:'#378ADD'},
  RPOL:{label:'Político',short:'RPOL',text:'#3C3489',bg:'#EEEDFE',border:'#7F77DD',dot:'#7F77DD'},
  INTGOV:{label:'Interprograma gov',short:'INTGOV',text:'#085041',bg:'#E1F5EE',border:'#1D9E75',dot:'#1D9E75'},
  MANUT:{label:'Manutenção',short:'MANUT',text:'#444441',bg:'#F1EFE8',border:'#888780',dot:'#888780'},
  BUSSOLA:{label:'Bússola',short:'BÜSS',text:'#72243E',bg:'#FBEAF0',border:'#D4537E',dot:'#D4537E'},
};
const HAS_KILL = ['RCOM','RPOL','INTGOV'];
const TODAY = new Date();

// =====================================================
// IDENTIDADE ESTRUTURADA DO PROGRAMA (MVP-CADASTRO.md, Fase 1)
// Réplica não-modular de src/core/pecasCatalog.js#baseProgramTitle/
// getEpisodeId/parseEpisodioInfo (mesma regra, coberta pelos testes de
// lá — atualize os dois lugares juntos). Usadas aqui para: sugerir
// programas no campo "Programa relacionado" das vinhetas, e para
// preencher automaticamente programa_titulo/temporada/episodio/bloco ao
// salvar um programa.
// =====================================================
function baseProgramTitle(desc) {
  return String(desc || '')
    .replace(/^\s*PGM\s+/i, '')
    .replace(/\s*-?\s*T\s*\d+\s*EP\s*\d+.*$/i, '') // remove "T 01 EP 03", "T01 EP03", com ou sem hífen/espacamento
    .replace(/\s*-?\s*EP\s*\d+.*$/i, '') // remove "EP 01" com ou sem hífen
    .replace(/\s*-\s*BL\s*\d+\s*$/i, '')
    .replace(/\s*BL\s*\d+\s*$/i, '')
    .replace(/\s*\(.*?\)\s*$/, '')
    .replace(/\s*\d+'\s*$/, '')
    .trim();
}

function parseEpisodioInfo(desc) {
  const s = String(desc || '').toUpperCase();
  const mTE = s.match(/T\s*(\d+)\s*EP\s*(\d+)/);
  const mBL = s.match(/BL\s*(\d+)/);
  return {
    temporada: mTE ? Number(mTE[1]) : null,
    episodio: mTE ? Number(mTE[2]) : null,
    bloco: mBL ? Number(mBL[1]) : null,
  };
}

const FUNCOES_COM_PROGRAMA = new Set([
  'assinatura_infantil', 'assinatura_jovem', 'assinatura_adulto', 'assinatura_padrao',
  'vh_a_seguir', 'vh_daqui_a_pouco', 'vh_voce_esta_assistindo',
]);

const FUNCAO_LABEL = {
  assinatura_infantil: 'Assinatura Infantil', assinatura_jovem: 'Assinatura Jovem',
  assinatura_adulto: 'Assinatura Adulto', assinatura_padrao: 'Assinatura Padrão',
  vh_a_seguir: 'A seguir', vh_daqui_a_pouco: 'Daqui a pouco',
  vh_voce_esta_assistindo: 'Você está assistindo', classificacao_indicativa: 'Classificação indicativa',
  cartela_oficial: 'Cartela oficial', vinheta_id: 'Vinheta ID', transicao: 'Transição', outro: 'Outro',
};

/** Mostra/esconde os campos de função da vinheta — só fazem sentido para type=EVNH. */
function toggleFuncaoFields() {
  const isEvnh = document.getElementById('f-type').value === 'EVNH';
  document.getElementById('funcao-fields').style.display = isEvnh ? 'block' : 'none';
  if (isEvnh) {
    // Sugestões do datalist: título-base de cada programa cadastrado, sem duplicatas.
    const titulos = [...new Set(programas.map(p => baseProgramTitle(p.descricao)).filter(Boolean))].sort();
    document.getElementById('programa-relacionado-list').innerHTML =
      titulos.map(t => `<option value="${escapeHtml(t)}">`).join('');
    toggleProgramaRelacionadoField();
  }
}

/** O campo "Programa relacionado" só aparece para funções que de fato referenciam um programa (assinaturas e VHs de chamada). */
function toggleProgramaRelacionadoField() {
  const funcao = document.getElementById('f-funcao').value;
  document.getElementById('programa-relacionado-field').style.display =
    FUNCOES_COM_PROGRAMA.has(funcao) ? 'block' : 'none';
}

let supabaseClient = null;
let currentUser = null;
let pecas = [];
let programas = [];
let activeTab = 'pecas';   // 'pecas' | 'programas'
let activeCat = 'ALL';
let editingId = null;
let deleteId = null;
let pushTimer = null;
let lastPushAt = 0;
let pushInFlight = false; // true durante o await do pushToCloud (grava + recarrega)

// =====================================================
// RASCUNHO PENDENTE — persistência local de segurança
//
// Bug corrigido aqui: `pecas`/`programas`/`deletedPecas`/`deletedProgramas`
// só existiam em memória, e `scheduleSync()` só envia 700ms depois da
// última mudança. Qualquer recarregamento de página nesse meio-tempo —
// principalmente o `location.reload()` automático em SIGNED_OUT, que
// dispara sempre que a sessão do Supabase Auth deste navegador muda (por
// exemplo, outra pessoa fazendo login no MESMO navegador/computador) —
// descartava silenciosamente tudo que ainda não tinha sido confirmado no
// banco, inclusive exclusões: a peça "voltava", porque o DELETE nunca
// chegou a sair, e o reload só truxe de volta o que já estava no banco.
//
// Aqui a marca de pendência é gravada de forma SÍNCRONA a cada mudança —
// antes do debounce — e sobrevive a um reload porque fica em localStorage,
// não em memória. `startApp()` verifica essa marca ao carregar e, se
// existir, restaura o rascunho por cima do que acabou de vir da nuvem e
// tenta reenviar na hora, em vez de descartar.
// =====================================================
const RASCUNHO_KEY  = 'cadastroRascunho';
const PENDENTE_KEY  = 'cadastroSyncPendente';

function persistirRascunho() {
  try {
    localStorage.setItem(RASCUNHO_KEY, JSON.stringify({
      pecas, programas, deletedPecas, deletedProgramas,
      email: currentUser && currentUser.email,
      salvoEm: new Date().toISOString(),
    }));
    localStorage.setItem(PENDENTE_KEY, '1');
  } catch (e) {
    console.warn('[Peças e Programas] não foi possível salvar rascunho local', e);
  }
}

function limparRascunho() {
  try {
    localStorage.removeItem(RASCUNHO_KEY);
    localStorage.setItem(PENDENTE_KEY, '0');
  } catch (e) { /* localStorage indisponível — nada a fazer */ }
}

function haRascunhoPendente() {
  try { return localStorage.getItem(PENDENTE_KEY) === '1'; }
  catch (e) { return false; }
}

function lerRascunho() {
  try {
    const raw = JSON.parse(localStorage.getItem(RASCUNHO_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return null;
    return {
      pecas: Array.isArray(raw.pecas) ? raw.pecas : [],
      programas: Array.isArray(raw.programas) ? raw.programas : [],
      deletedPecas: Array.isArray(raw.deletedPecas) ? raw.deletedPecas : [],
      deletedProgramas: Array.isArray(raw.deletedProgramas) ? raw.deletedProgramas : [],
      email: raw.email || null,
    };
  } catch (e) { return null; }
}

/** Cancela o debounce e envia agora — usado antes do reload automático em SIGNED_OUT, como melhor esforço (a sessão pode já não ser mais válida nesse ponto; a rede de segurança de verdade é o rascunho em localStorage). */
function flushPendingSync() {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  if (!currentUser) return Promise.resolve();
  return pushToCloud();
}

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

function items(){ return activeTab === 'pecas' ? pecas : programas; }
function setItems(arr){ if (activeTab === 'pecas') pecas = arr; else programas = arr; }

function setSyncStatus(msg){ document.getElementById('sync-status').textContent = msg || ''; }

function setGateMessage(msg){
  const el = document.getElementById('gate-msg');
  if (el) el.textContent = msg;
}

function showGateLogin(errorMsg){
  setGateMessage('Cadastro de Peças e Programas');
  const box = document.getElementById('gate-login');
  if (box) box.style.display = 'block';
  const err = document.getElementById('gate-error');
  if (err) err.textContent = errorMsg || '';
  const email = document.getElementById('gate-email');
  if (email) email.focus();
}

// =====================================================
// GATE DE LOGIN — sessão única via auth.js (CanalAuth)
//
// Regra de acesso: NINGUÉM abre o cadastro sem sessão
// válida. Se não houver sessão, mostramos o formulário de
// login aqui mesmo (login inline) — nunca um redirect
// silencioso, que fazia a página "não entrar" sem erro.
// =====================================================
(async function boot() {
  try {
    // Cliente Supabase singleton: mesma sessão da tela do Roteiro.
    supabaseClient = CanalAuth.getClient();
  } catch (e) {
    // Config ausente ou CDN do Supabase bloqueada.
    setGateMessage(e.message);
    return;
  }

  // Guarda para onde voltar depois do login (esta própria página).
  CanalAuth.rememberReturnTo('pecas-programas.html');

  // Sessão expirada/logout em outra aba -> recarrega e cai no gate. Se
  // houver algo pendente de envio (ex.: outra pessoa logando neste mesmo
  // navegador no meio de uma edição), tenta enviar agora — melhor esforço,
  // já que a sessão pode não ser mais válida neste ponto; a rede de
  // segurança de verdade é o rascunho em localStorage (ver startApp).
  CanalAuth.onAuthChange(async (event) => {
    if (event !== 'SIGNED_OUT') return;
    try { await flushPendingSync(); } catch (e) { /* ver comentário acima */ }
    location.reload();
  });

  // Rede de segurança para fechar a aba/navegar para fora com algo
  // agendado ainda não enviado.
  window.addEventListener('pagehide', () => {
    if (pushTimer) flushPendingSync();
  });

  const user = await CanalAuth.requireUser();
  if (!user) {
    showGateLogin();
    wireGateLogin();
    return;
  }
  await startApp(user);
})();

// Login inline do gate. Reaproveita CanalAuth.signIn, que valida o
// formulário e traduz o erro do Supabase para linguagem da equipe.
function wireGateLogin() {
  const btn = document.getElementById('gate-submit');
  const email = document.getElementById('gate-email');
  const pass = document.getElementById('gate-password');
  const err = document.getElementById('gate-error');

  const submit = async () => {
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Entrando...';
    try {
      const { user } = await CanalAuth.signIn(email.value, pass.value);
      document.getElementById('gate-login').style.display = 'none';
      await startApp(user);
    } catch (e) {
      console.error('falha no login', e);
      err.textContent = e.message;
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  };

  btn.addEventListener('click', submit);
  [email, pass].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
}

// =====================================================
// CONTEXTO DE EMISSORA NA TELA
// =====================================================
async function trocarEmissoraAtiva(novaEmissoraId) {
  if (!novaEmissoraId) return;
  if (window.EmissoraContext) {
    EmissoraContext.setEmissoraAtivaId(novaEmissoraId);
  }
  if (window.PecasRepo && typeof PecasRepo.setEmissoraId === 'function') {
    PecasRepo.setEmissoraId(novaEmissoraId);
  }
  setGateMessage('Carregando peças da emissora...');
  document.getElementById('gate').style.display = 'flex';
  try {
    const dados = await PecasRepo.loadAll();
    pecas = Array.isArray(dados.pecas) ? dados.pecas : [];
    programas = Array.isArray(dados.programas) ? dados.programas : [];
    deletedPecas = [];
    deletedProgramas = [];
    render();
  } catch (e) {
    console.error('[Peças e Programas] Erro ao trocar emissora:', e);
  } finally {
    document.getElementById('gate').style.display = 'none';
  }
}

async function startApp(user) {
  currentUser = user;
  setGateMessage('Carregando cadastro...');
  document.getElementById('user-email').textContent = currentUser.email;
  document.getElementById('logout-link').addEventListener('click', async (e) => {
    e.preventDefault();
    await CanalAuth.signOut('index.html');
  });

  // Carrega e preenche o seletor de emissoras
  if (window.EmissoraContext && supabaseClient) {
    try {
      const emissoras = await EmissoraContext.carregarEmissoras(supabaseClient, currentUser.id);
      if (emissoras && emissoras.length > 0) {
        const ativa = EmissoraContext.resolverEmissoraAtiva(emissoras);
        const sel = document.getElementById('select-emissora');
        const wrap = document.getElementById('emissora-wrap');
        if (sel && wrap) {
          sel.innerHTML = emissoras.map(e => `
            <option value="${e.id}" ${ativa && ativa.id === e.id ? 'selected' : ''}>
              ${escapeHtml(e.nome)}
            </option>
          `).join('');
          wrap.style.display = 'flex';
        }
        if (ativa && window.PecasRepo && typeof PecasRepo.setEmissoraId === 'function') {
          PecasRepo.setEmissoraId(ativa.id);
        }
      }
    } catch (err) {
      console.warn('[Peças e Programas] Não foi possível listar emissoras:', err);
    }
  }

  try {
    // Banco relacional (public.pecas / public.programas) com fallback
    // automático para o formato antigo (shared_data JSONB).
    if (window.CanalLog) {
      CanalLog.init({ client: supabaseClient, user: currentUser, tela: 'cadastro', workspaceId: WORKSPACE_ID });
      CanalLog.registrar('cadastro_aberto', { email: currentUser.email });
    }
    const modo = await PecasRepo.init(supabaseClient, WORKSPACE_ID);

    if (window.CadastroSync) {
      // Única tela autorizada a gravar no cadastro (fluxo de mão única).
      CadastroSync.init({
        client: supabaseClient,
        user: currentUser,
        workspaceId: WORKSPACE_ID,
        allowWrite: true,
      });
    }
    console.info('[Peças e Programas] modo de banco:', modo);
    await loadFromCloud();
    restaurarRascunhoPendenteSeExistir();
    setupRealtime();
  } catch (e) {
    // Nunca deixar a tela travada no gate por causa de uma falha de rede/banco.
    console.error('falha ao inicializar o cadastro', e);
    setSyncStatus('Falha ao carregar');
    showToast('Falha ao carregar o cadastro: ' + (e.message || e), true);
  }

  document.getElementById('gate').style.display = 'none';
  render();
}

async function loadFromCloud() {
  setSyncStatus('Carregando...');
  try {
    const data = await PecasRepo.loadAll();
    pecas     = (data.pecas     || []).map(p => ({ id: p.id || uid(), ...p }));
    programas = (data.programas || []).map(p => ({ id: p.id || uid(), ...p }));
    setSyncStatus('Sincronizado ✓');
  } catch (e) {
    console.error('falha ao carregar cadastro', e);
    setSyncStatus('Falha ao carregar');
    showToast('Não foi possível carregar o cadastro: ' + (e.message || e), true);
  }
}

/**
 * Se a marca de "sincronização pendente" ainda estiver presente ao abrir a
 * tela, é sinal de que uma sessão anterior (deste ou de outro usuário, no
 * mesmo navegador) fez alterações — inclusive exclusões — que nunca
 * chegaram a ser confirmadas no banco antes da página recarregar. Em vez de
 * descartar (o bug relatado: "as alterações que fiz, inclusive exclusão de
 * peças, voltaram"), o rascunho local vence o que acabou de vir da nuvem, e
 * o envio é refeito na hora — o mecanismo normal de conflito por
 * row_version em pushToCloud() cobre qualquer edição de terceiros que
 * porventura tenha acontecido nesse meio-tempo.
 */
function restaurarRascunhoPendenteSeExistir() {
  if (!haRascunhoPendente()) return;
  const rascunho = lerRascunho();
  if (!rascunho) { limparRascunho(); return; }

  pecas             = rascunho.pecas;
  programas         = rascunho.programas;
  deletedPecas      = rascunho.deletedPecas;
  deletedProgramas  = rascunho.deletedProgramas;

  const deEmail = rascunho.email && rascunho.email !== currentUser.email ? ` (feitas por ${rascunho.email})` : '';
  showToast(`Alterações não sincronizadas de uma sessão anterior${deEmail} foram recuperadas e estão sendo enviadas agora.`, false);
  if (window.CanalLog) {
    CanalLog.registrar('cadastro_rascunho_recuperado', {
      email_original: rascunho.email,
      exclusoesPecas: deletedPecas.length,
      exclusoesProgramas: deletedProgramas.length,
    }, { nivel: 'warn' });
  }
  scheduleSync();
}

// Codes excluídos explicitamente nesta tela (a única coisa que autoriza um
// DELETE no banco compartilhado). Sem isso, um snapshot velho apagaria o que
// outro usuário acabou de cadastrar.
let deletedPecas = [];
let deletedProgramas = [];

function marcarExcluidos(codes) {
  const alvo = activeTab === 'pecas' ? deletedPecas : deletedProgramas;
  codes.filter(Boolean).forEach((c) => { if (!alvo.includes(c)) alvo.push(c); });
  if (window.CanalLog) {
    CanalLog.registrar('cadastro_exclusao_marcada', { aba: activeTab }, { codes: codes.filter(Boolean), nivel: 'warn' });
  }
}

async function pushToCloud() {
  // Marca em andamento ANTES de qualquer await: enquanto isso, o listener de
  // tempo real (setupRealtime, logo abaixo) não pode recarregar e sobrescrever
  // `pecas`/`programas` por cima do que está sendo enviado agora — era essa
  // janela que fazia peças recém-criadas "sumirem" quando outro usuário
  // salvava algo enquanto o envio deste usuário ainda estava agendado.
  pushInFlight = true;
  setSyncStatus('Sincronizando...');
  const delP = deletedPecas.slice();
  const delG = deletedProgramas.slice();
  try {
    const res = await PecasRepo.saveDelta({
      pecas, programas,
      deletedPecas: delP,
      deletedProgramas: delG,
      userId: currentUser.id,
    });
    deletedPecas = deletedPecas.filter((c) => !delP.includes(c));
    deletedProgramas = deletedProgramas.filter((c) => !delG.includes(c));
    // O delta foi gravado no banco com sucesso (mesmo que parte tenha vindo
    // como conflito, abaixo) — não há mais nada pendente para proteger.
    limparRascunho();
    if (window.CanalLog) {
      CanalLog.registrar('cadastro_salvo', {
        aplicados: res && res.aplicados,
        removidos: res && res.removidos,
        conflitos: ((res && res.conflitos) || []).map((c) => c.code),
      }, { codes: [...delP, ...delG], nivel: ((res && res.conflitos) || []).length ? 'warn' : 'info' });
    }
    lastPushAt = Date.now();

    const conflitos = (res && res.conflitos) || [];
    // Recarrega para trazer as versões atuais (inclui edições de outros usuários).
    await loadFromCloud();
    render();

    if (conflitos.length) {
      showToast('Alguns itens foram editados por outra pessoa e não foram sobrescritos: ' +
        conflitos.map((c) => c.code).join(', ') + '. A tela foi atualizada com a versão do banco.', true);
      setSyncStatus('Conflito resolvido — tela atualizada');
      return;
    }
    setSyncStatus('Sincronizado ✓');
  } catch (e) {
    console.error('falha ao sincronizar', e);
    if (window.CanalLog) CanalLog.registrar('cadastro_salvo_falhou', { mensagem: e.message || String(e) }, { nivel: 'error' });
    setSyncStatus('Falha ao sincronizar');
    showToast('Falha ao salvar no banco: ' + (e.message || e), true);
  } finally {
    pushInFlight = false;
  }
}

function scheduleSync() {
  // Grava o rascunho ANTES do debounce — se a página recarregar nos
  // próximos 700ms (ou a qualquer momento antes do envio confirmar), essa
  // cópia em localStorage é o que garante que a mudança não se perde.
  persistirRascunho();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushToCloud();
  }, 700);
}

// Há alterações locais ainda não gravadas no banco (agendadas ou em
// andamento). Enquanto isso for verdade, um recarregamento vindo do tempo
// real NÃO pode substituir `pecas`/`programas` por inteiro — apagaria da
// tela (e, ao sincronizar em seguida, também do banco) o que o usuário
// acabou de criar/editar/excluir e ainda não teve a chance de enviar.
function temAlteracoesPendentes() {
  return pushTimer !== null || pushInFlight;
}

function setupRealtime() {
  // Recarrega quando outra pessoa da equipe edita o cadastro.
  // Ignora eco da própria escrita (janela de 1,5s após o último push).
  PecasRepo.onRemoteChange(async () => {
    if (Date.now() - lastPushAt < 1500) return;

    if (temAlteracoesPendentes()) {
      // Não sobrescreve a tela: o envio pendente deste usuário vai gravar
      // seu delta em cima da versão mais nova do banco (a RPC já trata
      // conflito por row_version) e, ao terminar, recarrega tudo — inclusive
      // a mudança do outro usuário que acabou de chegar.
      if (window.CanalLog) {
        CanalLog.registrar('cadastro_sync_adiado', {
          motivo: 'alteracao_remota_com_edicao_local_pendente',
        }, { nivel: 'warn' });
      }
      setSyncStatus('Atualização remota recebida — aplicando após sua edição...');
      return;
    }

    await loadFromCloud();
    render();
    setSyncStatus('Atualizado por outro usuário ✓');
  });
}

// =====================================================
// ABAS (Peças / Programas)
// =====================================================
function switchTab(tab) {
  activeTab = tab;
  activeCat = 'ALL';
  document.getElementById('tab-pecas').classList.toggle('active', tab === 'pecas');
  document.getElementById('tab-programas').classList.toggle('active', tab === 'programas');
  document.getElementById('sidebar').style.display = tab === 'pecas' ? 'flex' : 'none';
  document.getElementById('header-title').textContent = tab === 'pecas' ? 'Peças de inserção' : 'Programas';
  document.getElementById('new-btn-label').textContent = tab === 'pecas' ? 'Nova peça' : 'Novo programa';
  document.getElementById('pecas-only-fields').style.display = tab === 'pecas' ? 'block' : 'none';
  document.getElementById('programa-only-fields').style.display = tab === 'programas' ? 'block' : 'none';
  render();
}

// =====================================================
// CATEGORIAS (Peças) — combina categorias conhecidas
// com quaisquer outras já existentes nos dados (ex:
// vindas de importações antigas do banco de peças).
// =====================================================
function allCategoryKeys() {
  const known = Object.keys(CATS);
  const extra = [...new Set(pecas.map(p => p.categoria).filter(c => c && !known.includes(c)))];
  return [...known, ...extra];
}
function catMeta(cat) {
  return CATS[cat] || { label: cat, short: cat, text: '#555', bg: '#eee', border: '#ccc', dot: '#aaa' };
}

// kStatus/kBadgeHtml assumem `ds` em AAAA-MM-DD (o cadastro grava sempre
// nesse formato via input[type=date] + f-validade). Isso é o mesmo contrato
// que src/core/normalize.js#parseValidade/formatValidade documentam e testam
// para o resto do sistema (Roteiro, import de peças do dia) — aqui o cálculo
// de "expira em Nd" fica local por já não precisar aceitar outros formatos.
function kStatus(ds){
  if(!ds)return null;
  const d=new Date(ds+'T12:00:00');
  const diff=Math.ceil((d-TODAY)/86400000);
  if(diff<0)return{kind:'expired',label:'Expirada'};
  if(diff===0)return{kind:'soon',label:'Expira hoje'};
  if(diff<=7)return{kind:'soon',label:`Expira em ${diff}d`};
  return{kind:'ok',label:ds.split('-').reverse().join('/')};
}
function kBadgeHtml(ds){
  const s=kStatus(ds);
  if(!s)return'<span class="kbadge none">—</span>';
  return`<span class="kbadge ${s.kind}">${s.label}</span>`;
}
function catBadgeHtml(cat){
  if(!cat)return'—';
  const c=catMeta(cat);
  return`<span class="badge" style="color:${c.text};background:${c.bg};border-color:${c.border}">${c.short}</span>`;
}
const ASSINATURA_META = {
  infantil: { label: 'Infantil', text: '#0C447C', bg: '#E6F1FB', border: '#378ADD' },
  jovem:    { label: 'Jovem',    text: '#085041', bg: '#E1F5EE', border: '#1D9E75' },
  adulto:   { label: 'Adulto',  text: '#72243E', bg: '#FBEAF0', border: '#D4537E' },
};
function assinaturaBadgeHtml(list){
  if(!list||!list.length)return'—';
  return list.map(a=>{
    const m=ASSINATURA_META[a]||{label:a,text:'#555',bg:'#eee',border:'#ccc'};
    return`<span class="badge" style="color:${m.text};background:${m.bg};border-color:${m.border};margin-right:3px">${escapeHtml(m.label)}</span>`;
  }).join('');
}
/** Selo pequeno mostrando a função da vinheta (MVP-CADASTRO.md, Fase 1) — só aparece quando cadastrada; sem isso, célula fica vazia (nada muda para peças que não usam o campo novo). */
function funcaoBadgeHtml(p){
  if (p.type !== 'EVNH' || !p.funcao) return '';
  const label = FUNCAO_LABEL[p.funcao] || p.funcao;
  const rel = p.programaRelacionado ? ` · ${escapeHtml(p.programaRelacionado)}` : '';
  return `<div style="font-size:9px;color:var(--muted,#888);margin-top:2px">📋 ${escapeHtml(label)}${rel}</div>`;
}

function horLabel(p){
  const parts=[];
  if(p.hIni||p.hFim)parts.push((p.hIni||'–')+(p.hFim?'→'+p.hFim:''));
  if(p.dias&&p.dias.length){const d=p.dias.slice(0,3).join(',')+(p.dias.length>3?'…':'');parts.push(d);}
  if(p.freq)parts.push(p.freq+'x');
  return parts.join(' · ')||'—';
}

// =====================================================
// SIDEBAR (só na aba Peças)
// =====================================================
function renderSidebar(){
  const keys = allCategoryKeys();
  const counts = keys.reduce((a,k)=>({...a,[k]:pecas.filter(p=>p.categoria===k).length}),{});
  const alerts = pecas.filter(p=>{const s=kStatus(p.validade);return s&&s.kind!=='ok';}).length;

  let html=`<button class="cat-btn ${activeCat==='ALL'?'active':''}" onclick="setCat('ALL')">
    <span>Todas</span><span class="cat-count">${pecas.length}</span></button>`;
  for(const k of keys){
    const c = catMeta(k);
    html+=`<button class="cat-btn ${activeCat===k?'active':''}" onclick="setCat('${k}')">
      <span><span class="cat-dot" style="background:${c.dot}"></span>${c.label}</span>
      <span class="cat-count">${counts[k]||0}</span></button>`;
  }
  document.getElementById('sidebar-cats').innerHTML=html;
  document.getElementById('alert-box').innerHTML=alerts>0?`<div class="alert-box">⚠ ${alerts} com validade crítica</div>`:'';
}
function setCat(c){activeCat=c;render();}
// =====================================================
// DUPLICADOS E SELEÇÃO EM LOTE
// =====================================================
let filtroDuplicadosApenas = false;
let selectedCodes = new Set();

function toggleFiltroDuplicados() {
  filtroDuplicadosApenas = !filtroDuplicadosApenas;
  const btn = document.getElementById('btn-toggle-duplicados');
  if (btn) {
    btn.style.background = filtroDuplicadosApenas ? '#FFE58F' : '';
    btn.style.fontWeight = filtroDuplicadosApenas ? '600' : 'normal';
  }
  render();
}

function toggleSelectAll(checked) {
  const checkboxes = document.querySelectorAll('.batch-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
    if (checked) selectedCodes.add(cb.value);
    else selectedCodes.delete(cb.value);
  });
  atualizarBarraLote();
}

function toggleSelectRow(code, checked) {
  if (checked) selectedCodes.add(code);
  else selectedCodes.delete(code);
  atualizarBarraLote();
}

function limparSelecao() {
  selectedCodes.clear();
  const selectAllCb = document.getElementById('select-all-cb');
  if (selectAllCb) selectAllCb.checked = false;
  document.querySelectorAll('.batch-checkbox').forEach(cb => cb.checked = false);
  atualizarBarraLote();
}

function atualizarBarraLote() {
  const bar = document.getElementById('batch-bar');
  const countSpan = document.getElementById('batch-count');
  if (!bar || !countSpan) return;

  if (selectedCodes.size > 0 || filtroDuplicadosApenas) {
    bar.style.display = 'flex';
    countSpan.textContent = `${selectedCodes.size} ite${selectedCodes.size === 1 ? 'm' : 'ns'} selecionado${selectedCodes.size === 1 ? '' : 's'}`;
  } else {
    bar.style.display = 'none';
  }
}

function selecionarSugeridosLimpeza() {
  if (!window.PecasDeduplicador) {
    alert('Módulo de deduplicação não carregado.');
    return;
  }
  const lista = items();
  const grupos = window.PecasDeduplicador.encontrarDuplicados(lista);
  const descartar = window.PecasDeduplicador.selecionarParaAcao(grupos, 'manter_recente');
  
  selectedCodes = new Set(descartar);
  render();
  atualizarBarraLote();
}

function executarAcaoLote(acao) {
  if (selectedCodes.size === 0) {
    alert('Nenhum item selecionado.');
    return;
  }
  const codes = Array.from(selectedCodes);
  const qtd = codes.length;

  if (acao === 'excluir') {
    if (!confirm(`Tem certeza que deseja excluir ${qtd} ite${qtd === 1 ? 'm' : 'ns'} selecionado${qtd === 1 ? '' : 's'}?`)) {
      return;
    }
    marcarExcluidos(codes);
    setItems(items().filter(x => !selectedCodes.has(x.code)));
    limparSelecao();
    render();
    scheduleSync();
    if (window.toast) window.toast(`${qtd} itens excluídos.`);
  } else if (acao === 'desativar') {
    const atualizados = items().map(x => {
      if (selectedCodes.has(x.code)) {
        return { ...x, ativo: false };
      }
      return x;
    });
    setItems(atualizados);
    limparSelecao();
    render();
    scheduleSync();
    if (window.toast) window.toast(`${qtd} itens desativados.`);
  }
}

// =====================================================
// RENDER PRINCIPAL
// =====================================================
function render(){
  const isPecas = activeTab === 'pecas';
  const q=document.getElementById('search').value.toLowerCase();
  let list = items();

  // Contagem e identificação de duplicados
  let duplicateCodes = new Set();
  if (window.PecasDeduplicador) {
    const grupos = window.PecasDeduplicador.encontrarDuplicados(list);
    for (const normalizado in grupos) {
      grupos[normalizado].forEach(p => duplicateCodes.add(p.code));
    }
    const lblDuplicados = document.getElementById('lbl-duplicados');
    if (lblDuplicados) {
      lblDuplicados.textContent = `Apenas duplicados (${duplicateCodes.size})`;
    }
  }

  const filtered=list.filter(p=>{
    if(filtroDuplicadosApenas && !duplicateCodes.has(p.code)) return false;
    if(isPecas && activeCat!=='ALL' && p.categoria!==activeCat)return false;
    if(q)return (p.code||'').toLowerCase().includes(q)||(p.descricao||'').toLowerCase().includes(q)||(p.type||'').toLowerCase().includes(q);
    return true;
  });

  const noun = isPecas ? 'peça' : 'programa';
  const sub=`${filtered.length} ${noun}${filtered.length!==1?'s':''}${isPecas&&activeCat!=='ALL'?' · '+catMeta(activeCat).label:''}${filtroDuplicadosApenas?' · [Duplicados]':''}`;
  document.getElementById('header-sub').textContent = sub;
  
  const thead = document.getElementById('thead');
  thead.innerHTML = isPecas
    ? `<tr><th style="width:36px;text-align:center"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></th><th>Code</th><th style="width:34%">Descrição</th><th>Tempo</th><th>Type</th><th>Categoria</th><th>Validade</th><th>Horário</th><th style="width:52px"></th></tr>`
    : `<tr><th style="width:36px;text-align:center"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></th><th>Code</th><th style="width:38%">Descrição</th><th>Tempo</th><th>Type</th><th>Mídia</th><th>Assinatura</th><th style="width:52px"></th></tr>`;

  if(filtered.length===0){
    const colspan = isPecas ? 9 : 8;
    document.getElementById('tbody').innerHTML=`<tr class="empty-row"><td colspan="${colspan}">${q?'Nada encontrado.':(filtroDuplicadosApenas?'Nenhum item duplicado encontrado.':'Nenhum item nesta categoria. Clique em "Novo" para adicionar.')}</td></tr>`;
    if (isPecas) renderSidebar();
    atualizarBarraLote();
    return;
  }

  document.getElementById('tbody').innerHTML=filtered.map(p=> {
    const isChecked = selectedCodes.has(p.code) ? 'checked' : '';
    const isDupl = duplicateCodes.has(p.code);
    const rowStyle = isDupl ? 'background:#FFFDF5;' : '';
    const duplBadge = isDupl ? '<span style="background:#FFE58F;color:#874D00;font-size:10px;padding:1px 4px;border-radius:3px;margin-left:4px">duplicado</span>' : '';

    return isPecas ? `
    <tr style="${rowStyle}">
      <td style="text-align:center"><input type="checkbox" class="batch-checkbox" value="${escapeHtml(p.code)}" ${isChecked} onchange="toggleSelectRow('${escapeHtml(p.code)}', this.checked)"></td>
      <td class="code-cell">${escapeHtml(p.code)}</td>
      <td>
        <div class="desc-main">${escapeHtml(p.descricao)}${duplBadge}</div>
        ${p.obs?`<div class="desc-obs">${escapeHtml(p.obs)}</div>`:''}
        ${funcaoBadgeHtml(p)}
      </td>
      <td class="tempo-cell">${escapeHtml(p.tempo)}</td>
      <td class="type-cell">${escapeHtml(p.type)}</td>
      <td>${catBadgeHtml(p.categoria)}</td>
      <td>${kBadgeHtml(p.validade)}</td>
      <td class="hor-cell">${horLabel(p)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" onclick="openModal('${p.id}')" title="Editar">✏️</button>
          <button class="icon-btn del" onclick="openDel('${p.id}')" title="Excluir">🗑</button>
        </div>
      </td>
    </tr>` : `
    <tr style="${rowStyle}">
      <td style="text-align:center"><input type="checkbox" class="batch-checkbox" value="${escapeHtml(p.code)}" ${isChecked} onchange="toggleSelectRow('${escapeHtml(p.code)}', this.checked)"></td>
      <td class="code-cell">${escapeHtml(p.code)}</td>
      <td><div class="desc-main">${escapeHtml(p.descricao)}${duplBadge}</div></td>
      <td class="tempo-cell">${escapeHtml(p.tempo)}</td>
      <td class="type-cell">${escapeHtml(p.type)}</td>
      <td class="hor-cell">${escapeHtml(p.midia||'')}</td>
      <td>${assinaturaBadgeHtml(p.assinatura)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" onclick="openModal('${p.id}')" title="Editar">✏️</button>
          <button class="icon-btn del" onclick="openDel('${p.id}')" title="Excluir">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  if (isPecas) renderSidebar();
  atualizarBarraLote();
}

// =====================================================
// MODAL (criar/editar)
// =====================================================
function openModal(id){
  editingId=id;
  const isPecas = activeTab === 'pecas';
  const p = id ? items().find(x=>x.id===id) : null;

  document.getElementById('modal-title').textContent = p ? `Editar ${isPecas?'peça':'programa'}` : `Nov${isPecas?'a peça':'o programa'}`;
  document.getElementById('save-btn').textContent = p ? 'Salvar' : 'Adicionar';
  document.getElementById('f-code').value = p?.code || '';
  document.getElementById('f-midia').value = p?.midia || '0OMN';
  document.getElementById('f-desc').value = p?.descricao || '';
  document.getElementById('f-tempo').value = p?.tempo || '00:00:00';
  document.getElementById('f-type').value = p?.type || (isPecas ? 'ECHE' : 'RPRO');

  if (isPecas) {
    document.getElementById('f-cat').value = p?.categoria || 'CHAMADA_QUENTE';
    document.getElementById('f-validade').value = p?.validade || '';
    document.getElementById('f-obs').value = p?.obs || '';
    document.getElementById('f-hini').value = p?.hIni || '';
    document.getElementById('f-hfim').value = p?.hFim || '';
    document.getElementById('f-freq').value = p?.freq || '';

    const hasH = !!(p?.hIni || p?.hFim || p?.dias?.length);
    document.getElementById('f-showh').checked = hasH;
    document.getElementById('horario-fields').style.display = hasH ? 'block' : 'none';

    document.querySelectorAll('#dias-wrap .dia-btn').forEach(b=>{
      const pDias = (p?.dias || []).map(normalizeDia);
    b.classList.toggle('active', pDias.includes(normalizeDia(b.dataset.d)));
    });

    document.getElementById('f-funcao').value = p?.funcao || '';
    document.getElementById('f-programa-relacionado').value = p?.programaRelacionado || '';
    toggleFuncaoFields();
  } else {
    document.querySelectorAll('#assinatura-wrap .dia-btn').forEach(b=>{
      b.classList.toggle('active', !!(p?.assinatura||[]).includes(b.dataset.a));
    });
  }

  const warnEl = document.getElementById('f-code-warn');
  if (warnEl && warnEl.style) { warnEl.style.display = 'none'; warnEl.textContent = ''; }
  const codeEl = document.getElementById('f-code');
  if (codeEl && codeEl.style) codeEl.style.borderColor = '';

  document.getElementById('modal-overlay').style.display='flex';
}
/** Verifica se o código informado já existe na aba ativa. Em edição, permite manter o próprio código da peça/programa. */
function checkDuplicateCode() {
  const codeEl = document.getElementById('f-code');
  const warnEl = document.getElementById('f-code-warn');
  if (!codeEl) return null;
  const value = codeEl.value.trim();
  if (!value) {
    if (warnEl && warnEl.style) { warnEl.style.display = 'none'; warnEl.textContent = ''; }
    if (codeEl && codeEl.style) codeEl.style.borderColor = '';
    return null;
  }

  const duplicate = items().find(item =>
    (!editingId || item.id !== editingId) &&
    String(item.code || '').trim().toLowerCase() === value.toLowerCase()
  );
  if (duplicate) {
    if (warnEl && warnEl.style) {
      warnEl.textContent = `⚠️ Código já cadastrado: ${duplicate.descricao || duplicate.code}`;
      warnEl.style.display = 'block';
    }
    if (codeEl && codeEl.style) codeEl.style.borderColor = '#ef4444';
    return duplicate;
  }

  if (warnEl && warnEl.style) { warnEl.style.display = 'none'; warnEl.textContent = ''; }
  if (codeEl && codeEl.style) codeEl.style.borderColor = '';
  return null;
}

function closeModal(){
  document.getElementById('modal-overlay').style.display='none';
  editingId=null;
  const warnEl = document.getElementById('f-code-warn');
  if (warnEl && warnEl.style) { warnEl.style.display = 'none'; warnEl.textContent = ''; }
  const codeEl = document.getElementById('f-code');
  if (codeEl && codeEl.style) codeEl.style.borderColor = '';
}

function toggleHorario(){
  document.getElementById('horario-fields').style.display=document.getElementById('f-showh').checked?'block':'none';
}
function toggleDia(btn){btn.classList.toggle('active');}

function saveItem(){
  const isPecas = activeTab === 'pecas';
  const code=document.getElementById('f-code').value.trim();
  const descricao=document.getElementById('f-desc').value.trim();
  if(!code||!descricao)return alert('Code e Descrição são obrigatórios.');

  const duplicate = items().find(item =>
    (!editingId || item.id !== editingId) &&
    String(item.code || '').trim().toLowerCase() === code.toLowerCase()
  );
  if (duplicate) {
    alert(`Código duplicado!\n\nJá existe ${isPecas ? 'uma peça cadastrada' : 'um programa cadastrado'} com o código "${code}":\n"${duplicate.descricao || 'Sem descrição'}"\n\nNão é permitido cadastrar códigos duplicados.`);
    const codeEl = document.getElementById('f-code');
    if (codeEl && typeof codeEl.focus === 'function') codeEl.focus();
    checkDuplicateCode();
    return;
  }

  let p = {
    id: editingId || uid(), code, descricao,
    tempo: document.getElementById('f-tempo').value || '00:00:00',
    midia: document.getElementById('f-midia').value || '0OMN',
    type: document.getElementById('f-type').value,
  };

  if (isPecas) {
    const dias=[...document.querySelectorAll('.dia-btn.active')].map(b=>normalizeDia(b.dataset.d));
    const showH=document.getElementById('f-showh').checked;
    const funcao = document.getElementById('f-funcao').value;
    p = {
      ...p,
      categoria: document.getElementById('f-cat').value,
      validade: document.getElementById('f-validade').value || '',
      dias: showH?dias:[],
      hIni: showH?document.getElementById('f-hini').value:'',
      hFim: showH?document.getElementById('f-hfim').value:'',
      freq: showH?document.getElementById('f-freq').value:'',
      obs: document.getElementById('f-obs').value,
      // Só faz sentido para type=EVNH — em qualquer outro type o campo fica
      // escondido no formulário, então grava vazio para não sobrar lixo de
      // uma edição anterior (ex.: trocou de EVNH para ECHE).
      funcao: p.type === 'EVNH' ? funcao : '',
      programaRelacionado: (p.type === 'EVNH' && FUNCOES_COM_PROGRAMA.has(funcao))
        ? document.getElementById('f-programa-relacionado').value.trim() : '',
    };
  } else {
    // Campos estruturados (MVP-CADASTRO.md, Fase 1): calculados automaticamente
    // da descrição, mesma extração já usada pelo importador de grade em
    // app.js — o cadastro manual ganha o mesmo benefício sem digitar de novo.
    const episodioInfo = parseEpisodioInfo(descricao);
    p = {
      ...p,
      assinatura: [...document.querySelectorAll('#assinatura-wrap .dia-btn.active')].map(b=>b.dataset.a),
      programaTitulo: baseProgramTitle(descricao),
      temporada: episodioInfo.temporada,
      episodio: episodioInfo.episodio,
      bloco: episodioInfo.bloco,
    };
  }

  const list = items();
  if(editingId){ setItems(list.map(x=>x.id===editingId?p:x)); }
  else{ setItems([...list, p]); }

  render(); closeModal(); scheduleSync();
}

// =====================================================
// EXCLUIR (item único ou TODOS os itens da aba ativa)
// =====================================================
function openDel(id){
  deleteId=id;
  const isPecas = activeTab === 'pecas';
  const p=items().find(x=>x.id===id);
  document.getElementById('del-title').textContent = `Excluir ${isPecas?'peça':'programa'}`;
  document.getElementById('del-code').textContent=p.code;
  document.getElementById('del-desc').textContent=(p.descricao||'').slice(0,60);
  document.getElementById('del-overlay').style.display='flex';
}

// [NOVO] Botão "Excluir todos" — usa o mesmo modal de confirmação,
// mas marca deleteId com um sinalizador especial ('__ALL__') que o
// confirmDel() abaixo reconhece para apagar a lista inteira da aba ativa.
function openDeleteAll(){
  const isPecas = activeTab === 'pecas';
  const list = items();
  if (!list.length) { showToast('Não há nada para excluir.'); return; }

  deleteId = '__ALL__';
  document.getElementById('del-title').textContent = `Excluir TODAS as ${isPecas?'peças':'programas'}`;
  document.getElementById('del-code').textContent = `${list.length} ${isPecas?'peças':'programas'}`;
  document.getElementById('del-desc').textContent = 'Essa ação não pode ser desfeita e afeta todo o banco compartilhado da equipe.';
  document.getElementById('del-overlay').style.display='flex';
}

function closeDel(){document.getElementById('del-overlay').style.display='none';deleteId=null;}

function confirmDel(){
  if (deleteId === '__ALL__') {
    marcarExcluidos(items().map(x => x.code));
    // [NOVO] Exclusão geral: zera a lista da aba ativa (Peças OU Programas,
    // nunca as duas ao mesmo tempo) e sincroniza com a nuvem.
    setItems([]);
  } else {
    const alvo = items().find(x => x.id === deleteId);
    if (alvo) marcarExcluidos([alvo.code]);
    setItems(items().filter(x=>x.id!==deleteId));
  }
  render(); closeDel(); scheduleSync();
}

// =====================================================
// TOAST (feedback simples)
// =====================================================
let toastTimer = null;
function showToast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('error', !!isError);
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 4500);
}

// =====================================================
// IMPORTAÇÃO — XLSX e CSV (peças ou programas,
// dependendo da aba ativa no momento da importação)
// =====================================================
function excelTimeToHMS(v, fallback){
  fallback = fallback || '00:01:00';
  if (v == null || v === '') return fallback;
  if (typeof v === 'number') {
    const secs = Math.round(v * 86400);
    const hh = String(Math.floor(secs / 3600)).padStart(2, '0');
    const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  const s = String(v).trim();
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{1,2}:\d{2}$/.test(s)) return s + ':00';
  const n = parseFloat(s.replace(',', '.'));
  if (!isNaN(n) && s.match(/^[\d.,]+$/)) return excelTimeToHMS(n, fallback);
  return fallback;
}

function detectCols(headers, rows){
  // Para cada campo, testa as palavras-chave EM ORDEM DE PRIORIDADE (não pela posição
  // da coluna) e, entre as que baterem, prefere a que tiver mais linhas preenchidas —
  // evita pegar por engano uma coluna com nome parecido só porque está mais à esquerda.
  const dataRows = (rows || []).slice(1, 60); // amostra para checar preenchimento
  const filledCount = (idx) => dataRows.filter(r => String(r[idx] ?? '').trim() !== '').length;

  const fi = (tests) => {
    let candidates = [];
    for (const t of tests) {
      headers.forEach((h, idx) => { if (h.includes(t)) candidates.push(idx); });
      if (candidates.length) break; // já achou por essa palavra-chave, não desce pras próximas
    }
    if (!candidates.length) return -1;
    if (candidates.length === 1) return candidates[0];
    // várias colunas bateram com a mesma palavra-chave: escolhe a mais preenchida
    return candidates.sort((a, b) => filledCount(b) - filledCount(a))[0];
  };

  return {
    code:  fi(['CODE', 'COD', 'CÓDIGO']),
    desc:  fi(['PROGRAMA', 'DESC', 'ESPELHO', 'TITULO', 'TÍTULO', 'NOME']),
    tempo: fi(['TEMPO', 'DUR', 'DURAÇÃO']),
    type:  fi(['TYPE', 'TIPO']),
    val:   fi(['VALID', 'VALIDADE', 'KILL']),
    obs:   fi(['OBS', 'OBSERV']),
    cat:   fi(['CAT', 'CATEG']),
    midia: fi(['MIDIA', 'MÍDIA', 'MEDIA']),
  };
}

function importFile(e){
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    Papa.parse(file, {
      complete: (res) => processImportedRows(res.data),
      error: (err) => showToast('Erro ao ler o CSV: ' + err.message, true),
      skipEmptyLines: true,
    });
  } else if (ext === 'xlsx' || ext === 'xls') {
    if (!window.XLSX) { showToast('Biblioteca XLSX não carregada', true); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = window.XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        processImportedRows(rows);
      } catch (err) {
        showToast('Erro ao ler o XLSX: ' + err.message, true);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    showToast('Formato não suportado — use .xlsx, .xls ou .csv', true);
  }
}

function processImportedRows(rows) {
  const isPecas = activeTab === 'pecas';
  if (!rows || rows.length < 2) { showToast('Planilha vazia ou sem dados', true); return; }

  const headers = rows[0].map(h => String(h || '').trim().toUpperCase());
  const ci = detectCols(headers, rows);

  if (ci.code < 0 || ci.desc < 0) {
    showToast('Não encontrei as colunas CODE e DESCRIÇÃO na primeira linha', true);
    return;
  }

  const list = items();
  const existing = new Set(list.map(p => p.code));
  let added = 0, skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const code = String(r[ci.code] ?? '').trim();
    const desc = String(r[ci.desc] ?? '').trim();
    if (!code || !desc) continue;
    if (existing.has(code)) { skipped++; continue; }

    const tempo = excelTimeToHMS(ci.tempo >= 0 ? r[ci.tempo] : '', isPecas ? '00:01:00' : '00:30:00');

    let novo = {
      id: uid(),
      code, descricao: desc, tempo,
      midia: ci.midia >= 0 ? String(r[ci.midia] || '0OMN').trim() : '0OMN',
      // [OBS] Se o CSV/XLSX não tiver uma coluna TYPE/TIPO reconhecida (o que é o caso
      // dos arquivos exportados atualmente), TODO programa importado recebe "RPRO" por
      // padrão — é esse valor que a regra de negócio de assinatura (item 3) assume.
      type:  ci.type  >= 0 ? String(r[ci.type]  || (isPecas ? 'EVNH' : 'RPRO')).trim() : (isPecas ? 'EVNH' : 'RPRO'),
    };

    if (isPecas) {
      novo = {
        ...novo,
        validade: ci.val >= 0 ? String(r[ci.val] || '').trim() : '',
        obs:      ci.obs >= 0 ? String(r[ci.obs] || '').trim() : '',
        categoria: ci.cat >= 0 ? String(r[ci.cat] || '').trim() : 'IMPORTADO',
        dias: [], hIni: '', hFim: '', freq: '',
      };
    }

    list.push(novo);
    existing.add(code);
    added++;
  }

  setItems(list);
  render();
  scheduleSync();
  showToast(`✓ ${added} ${isPecas ? 'peças' : 'programas'} importados (${skipped} ignorados — já existiam)`);
}

// =====================================================
// EXPORTAR
// =====================================================
function exportJSON(){
  const isPecas = activeTab === 'pecas';
  const list = items();
  const out = isPecas
    ? {version:'1.0',exportedAt:new Date().toISOString(),total:list.length,pecas:list.map(p=>({code:p.code,descricao:p.descricao,tempo:p.tempo,midia:p.midia,type:p.type,categoria:p.categoria,validade:p.validade||null,horario:{dias:p.dias?.length?p.dias:null,horaInicio:p.hIni||null,horaFim:p.hFim||null,frequenciaMax:p.freq?Number(p.freq):null,obs:p.obs||null}}))}
    : {version:'1.0',exportedAt:new Date().toISOString(),total:list.length,programas:list.map(p=>({code:p.code,descricao:p.descricao,tempo:p.tempo,midia:p.midia,type:p.type,assinatura:p.assinatura||[]}))};
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'})),download:isPecas?'pecas-insercao.json':'programas.json'});
  a.click();
}

// =====================================================
// LOG DE ATIVIDADES (modal) — lê de window.CanalLog, o
// mesmo módulo usado pelo Roteiro. Sem sistema paralelo.
// =====================================================
let logEntradas = [];
let logUnsubscribe = null;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const LOG_NIVEL_LABEL = { info: 'Info', warn: 'Aviso', error: 'Erro' };

function fmtLogData(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return iso || ''; }
}

window._logExpandedIds = window._logExpandedIds || new Set();

const ROTULOS_CATEGORIA_LOG = {
  'inicializacao': '⚙️ Inicialização / Timing',
  'rede_nuvem':    '🌐 Rede / Sincronização Nuvem',
  'armazenamento': '💾 Armazenamento Local',
  'interface_dom': '🖱️ Interface / DOM',
  'geral':         '⚠️ Geral'
};

function fmtLogDetalhes(entrada) {
  const d = entrada.detalhe || {};
  const partes = [];
  if (d.categoria && ROTULOS_CATEGORIA_LOG[d.categoria]) {
    partes.push(`[${ROTULOS_CATEGORIA_LOG[d.categoria]}]`);
  }
  if (entrada.codes && entrada.codes.length) partes.push(`codes: ${entrada.codes.join(', ')}`);
  Object.entries(d).forEach(([k, v]) => {
    if (v == null || v === '') return;
    if (k === 'stack' || k === 'categoria' || k === 'breadcrumbs' || k === 'contexto') return;
    const val = Array.isArray(v) ? v.join(', ') : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    partes.push(`${k}: ${val}`);
  });
  return partes.join(' · ');
}

function toggleLogDetail(idx) {
  if (window._logExpandedIds.has(idx)) {
    window._logExpandedIds.delete(idx);
  } else {
    window._logExpandedIds.add(idx);
  }
  renderLog();
}

function copiarRelatorioLog(idx) {
  const entrada = (window._logEntradasFiltradas && window._logEntradasFiltradas[idx]) || logEntradas[idx];
  if (!entrada) return;
  const d = entrada.detalhe || {};
  const bcStr = (d.breadcrumbs && d.breadcrumbs.length) ? 'Últimas Ações:\n  - ' + d.breadcrumbs.join('\n  - ') : '';
  const stackStr = d.stack ? 'Stack Trace:\n' + d.stack : '';
  const partes = [
    '=== RELATÓRIO DE DIAGNÓSTICO CANALEDU ===',
    'Data/Hora: ' + (entrada.criado_em || new Date().toISOString()),
    'Tela: ' + (entrada.tela || '—') + ' | Nível: ' + (entrada.nivel || 'info') + ' | Evento: ' + (entrada.evento || '—'),
    'Usuário: ' + (entrada.user_email || 'anônimo'),
    'Categoria: ' + (d.categoria || 'não categorizado'),
    d.mensagem ? ('Mensagem: ' + d.mensagem) : '',
    d.arquivo ? ('Arquivo: ' + d.arquivo + (d.linha ? ':' + d.linha : '') + (d.coluna ? ':' + d.coluna : '')) : '',
    d.url ? ('URL da Página: ' + d.url) : '',
    bcStr,
    stackStr,
    '========================================'
  ];
  const relatorio = partes.filter(Boolean).join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(relatorio).then(() => {
      alert('✓ Relatório copiado para a área de transferência');
    }).catch(() => {
      prompt('Copie o relatório abaixo (Ctrl+C):', relatorio);
    });
  } else {
    prompt('Copie o relatório abaixo (Ctrl+C):', relatorio);
  }
}

async function openLog() {
  document.getElementById('log-overlay').style.display = 'flex';
  await loadLog();

  if (!logUnsubscribe && window.CanalLog && typeof CanalLog.onNovaEntrada === 'function') {
    logUnsubscribe = CanalLog.onNovaEntrada((entrada) => {
      logEntradas.unshift(entrada);
      renderLog();
    });
    const liveEl = document.getElementById('log-live');
    if (liveEl) liveEl.style.display = 'inline-flex';
  }
}

function closeLog() {
  document.getElementById('log-overlay').style.display = 'none';
  if (logUnsubscribe) { logUnsubscribe(); logUnsubscribe = null; }
  const liveEl = document.getElementById('log-live');
  if (liveEl) liveEl.style.display = 'none';
}

async function loadLog() {
  const body = document.getElementById('log-body');
  body.innerHTML = '<div class="log-empty">Carregando…</div>';
  logEntradas = window.CanalLog
    ? await CanalLog.equipe(200).then((r) => (r && r.length ? r : CanalLog.recentes(200).slice().reverse()))
    : [];
  renderLog();
}

function renderLog() {
  const body = document.getElementById('log-body');
  const filtroTela  = document.getElementById('log-filter-tela')?.value || '';
  const filtroNivel = document.getElementById('log-filter-nivel')?.value || '';
  const filtroTexto = (document.getElementById('log-filter-text')?.value || '').toLowerCase().trim();

  const filtradas = logEntradas.filter((e) => {
    if (filtroTela && e.tela !== filtroTela) return false;
    if (filtroNivel && e.nivel !== filtroNivel) return false;
    if (filtroTexto) {
      const d = e.detalhe || {};
      const busca = [
        e.evento, e.tela, e.nivel, e.user_email,
        d.categoria, d.mensagem, d.arquivo, d.stack,
        ...(e.codes || []),
        ...(d.breadcrumbs || [])
      ].filter(Boolean).join(' ').toLowerCase();
      if (!busca.includes(filtroTexto)) return false;
    }
    return true;
  });

  window._logEntradasFiltradas = filtradas;

  if (!filtradas.length) {
    body.innerHTML = '<div class="log-empty">Nenhum registro encontrado para os filtros selecionados.</div>';
    return;
  }

  const linhas = filtradas.map((e, idx) => {
    const d = e.detalhe || {};
    const hasExtra = Boolean(d.stack || d.breadcrumbs || d.categoria || d.url || (e.nivel === 'error'));
    const isExpanded = window._logExpandedIds.has(idx);

    let expandRowHtml = '';
    if (isExpanded) {
      const breadcrumbsHtml = (d.breadcrumbs && d.breadcrumbs.length)
        ? `<div style="margin-top:6px"><b>Últimas ações:</b> <span style="color:#999">${d.breadcrumbs.map(b => escapeHtml(b)).join(' → ')}</span></div>`
        : '';
      const contextHtml = d.url ? `<div style="margin-top:4px;color:#999"><b>URL:</b> ${escapeHtml(d.url)}</div>` : '';
      const stackHtml = d.stack ? `<pre class="log-stack-pre">${escapeHtml(d.stack)}</pre>` : '';

      expandRowHtml = `
        <tr>
          <td colspan="6" style="padding:0 12px 10px;background:rgba(0,0,0,0.15)">
            <div class="log-detail-box">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span style="font-weight:600;color:var(--accent, #4f8ef7)">🔍 Diagnóstico Detalhado do Evento</span>
                <button class="btn-outline" onclick="copiarRelatorioLog(${idx})" style="padding:2px 8px;font-size:11px">📋 Copiar Relatório</button>
              </div>
              <div><b>Evento:</b> ${escapeHtml(e.evento)} | <b>Tela:</b> ${escapeHtml(e.tela)} ${d.categoria ? `| <b>Categoria:</b> ${escapeHtml(ROTULOS_CATEGORIA_LOG[d.categoria] || d.categoria)}` : ''}</div>
              ${d.mensagem ? `<div style="margin-top:4px"><b>Mensagem:</b> ${escapeHtml(d.mensagem)}</div>` : ''}
              ${d.arquivo ? `<div style="margin-top:4px;color:#999"><b>Localização:</b> ${escapeHtml(d.arquivo)}${d.linha ? ':' + d.linha : ''}</div>` : ''}
              ${contextHtml}
              ${breadcrumbsHtml}
              ${stackHtml}
            </div>
          </td>
        </tr>`;
    }

    const clickAttr = hasExtra ? `onclick="toggleLogDetail(${idx})" title="Clique para expandir/ocultar detalhes técnicos"` : '';
    const btnExpandir = hasExtra
      ? `<button class="btn-outline" onclick="event.stopPropagation();toggleLogDetail(${idx})" style="padding:1px 6px;font-size:10px;margin-left:6px">${isExpanded ? '▲ Ocultar' : '▼ Detalhes'}</button>`
      : '';

    return `
      <tr class="${hasExtra ? 'log-row-interactive' : ''}" ${clickAttr}>
        <td style="white-space:nowrap;color:#999">${fmtLogData(e.criado_em)}</td>
        <td><span class="log-badge ${escapeHtml(e.nivel || 'info')}">${escapeHtml(LOG_NIVEL_LABEL[e.nivel] || e.nivel || 'info')}</span></td>
        <td style="white-space:nowrap">${escapeHtml(e.tela)}</td>
        <td style="font-weight:500">${escapeHtml(e.evento)}</td>
        <td style="white-space:nowrap">${escapeHtml(e.user_email || '—')}</td>
        <td class="log-detalhes">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span>${escapeHtml(fmtLogDetalhes(e))}</span>
            ${btnExpandir}
          </div>
        </td>
      </tr>
      ${expandRowHtml}
    `;
  }).join('');

  body.innerHTML = `
    <table class="log-table">
      <thead><tr><th>Quando</th><th>Nível</th><th>Tela</th><th>Evento</th><th>Usuário</th><th>Detalhes</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

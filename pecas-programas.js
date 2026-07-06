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

let supabaseClient = null;
let currentUser = null;
let pecas = [];
let programas = [];
let activeTab = 'pecas';   // 'pecas' | 'programas'
let activeCat = 'ALL';
let editingId = null;
let deleteId = null;
let pushTimer = null;

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

function items(){ return activeTab === 'pecas' ? pecas : programas; }
function setItems(arr){ if (activeTab === 'pecas') pecas = arr; else programas = arr; }

function setSyncStatus(msg){ document.getElementById('sync-status').textContent = msg || ''; }

// =====================================================
// GATE DE LOGIN — reaproveita a sessão do Supabase Auth
// =====================================================
(async function boot() {
  if (!isSupabaseConfigured()) {
    document.getElementById('gate').textContent = 'Configuração pendente (supabase-config.js). Veja DEPLOY.md.';
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data } = await supabaseClient.auth.getSession();
  if (!data?.session?.user) {
    location.href = 'index.html';
    return;
  }
  currentUser = data.session.user;
  document.getElementById('user-email').textContent = currentUser.email;
  document.getElementById('logout-link').addEventListener('click', async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    location.href = 'index.html';
  });

  await loadFromCloud();
  setupRealtime();
  document.getElementById('gate').style.display = 'none';
  render();
})();

async function loadFromCloud() {
  setSyncStatus('Carregando...');
  const { data: shared } = await supabaseClient
    .from('shared_data')
    .select('pecas, programas')
    .eq('id', WORKSPACE_ID)
    .maybeSingle();

  pecas     = (shared?.pecas     || []).map(p => ({ id: p.id || uid(), ...p }));
  programas = (shared?.programas || []).map(p => ({ id: p.id || uid(), ...p }));
  setSyncStatus('Sincronizado ✓');
}

async function pushToCloud() {
  setSyncStatus('Sincronizando...');
  try {
    await supabaseClient
      .from('shared_data')
      .update({
        pecas: pecas,
        programas: programas,
        updated_by: currentUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', WORKSPACE_ID);
    setSyncStatus('Sincronizado ✓');
  } catch (e) {
    console.warn('falha ao sincronizar', e);
    setSyncStatus('Falha ao sincronizar');
  }
}

function scheduleSync() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushToCloud, 700);
}

function setupRealtime() {
  supabaseClient
    .channel('pecas_programas_changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'shared_data', filter: `id=eq.${WORKSPACE_ID}` },
      (payload) => {
        if (!payload.new || payload.new.updated_by === currentUser.id) return; // ignora a própria escrita
        pecas     = (payload.new.pecas     || []).map(p => ({ id: p.id || uid(), ...p }));
        programas = (payload.new.programas || []).map(p => ({ id: p.id || uid(), ...p }));
        render();
        setSyncStatus('Atualizado por outro usuário ✓');
      }
    )
    .subscribe();
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
// RENDER PRINCIPAL
// =====================================================
function render(){
  const isPecas = activeTab === 'pecas';
  const q=document.getElementById('search').value.toLowerCase();
  const list = items();
  const filtered=list.filter(p=>{
    if(isPecas && activeCat!=='ALL' && p.categoria!==activeCat)return false;
    if(q)return (p.code||'').toLowerCase().includes(q)||(p.descricao||'').toLowerCase().includes(q)||(p.type||'').toLowerCase().includes(q);
    return true;
  });

  const noun = isPecas ? 'peça' : 'programa';
  const sub=`${filtered.length} ${noun}${filtered.length!==1?'s':''}${isPecas&&activeCat!=='ALL'?' · '+catMeta(activeCat).label:''}`;
  document.getElementById('header-sub').textContent = sub;

  const thead = document.getElementById('thead');
  thead.innerHTML = isPecas
    ? `<tr><th>Code</th><th style="width:34%">Descrição</th><th>Tempo</th><th>Type</th><th>Categoria</th><th>Validade</th><th>Horário</th><th style="width:52px"></th></tr>`
    : `<tr><th>Code</th><th style="width:44%">Descrição</th><th>Tempo</th><th>Type</th><th>Mídia</th><th style="width:52px"></th></tr>`;

  if(filtered.length===0){
    const colspan = isPecas ? 8 : 6;
    document.getElementById('tbody').innerHTML=`<tr class="empty-row"><td colspan="${colspan}">${q?'Nada encontrado.':'Nenhum item nesta categoria. Clique em "Novo" para adicionar.'}</td></tr>`;
    if (isPecas) renderSidebar();
    return;
  }

  document.getElementById('tbody').innerHTML=filtered.map(p=> isPecas ? `
    <tr>
      <td class="code-cell">${p.code}</td>
      <td>
        <div class="desc-main">${p.descricao}</div>
        ${p.obs?`<div class="desc-obs">${p.obs}</div>`:''}
      </td>
      <td class="tempo-cell">${p.tempo}</td>
      <td class="type-cell">${p.type}</td>
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
    <tr>
      <td class="code-cell">${p.code}</td>
      <td><div class="desc-main">${p.descricao}</div></td>
      <td class="tempo-cell">${p.tempo}</td>
      <td class="type-cell">${p.type}</td>
      <td class="hor-cell">${p.midia||''}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" onclick="openModal('${p.id}')" title="Editar">✏️</button>
          <button class="icon-btn del" onclick="openDel('${p.id}')" title="Excluir">🗑</button>
        </div>
      </td>
    </tr>`
  ).join('');

  if (isPecas) renderSidebar();
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

    document.querySelectorAll('.dia-btn').forEach(b=>{
      b.classList.toggle('active', !!(p?.dias||[]).includes(b.dataset.d));
    });
    onCatChange();
  }

  document.getElementById('modal-overlay').style.display='flex';
}
function closeModal(){document.getElementById('modal-overlay').style.display='none';editingId=null;}

function onCatChange(){
  const c=document.getElementById('f-cat').value;
  document.getElementById('kill-field').style.display=HAS_KILL.includes(c)?'block':'none';
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

  let p = {
    id: editingId || uid(), code, descricao,
    tempo: document.getElementById('f-tempo').value || '00:00:00',
    midia: document.getElementById('f-midia').value || '0OMN',
    type: document.getElementById('f-type').value,
  };

  if (isPecas) {
    const dias=[...document.querySelectorAll('.dia-btn.active')].map(b=>b.dataset.d);
    const showH=document.getElementById('f-showh').checked;
    p = {
      ...p,
      categoria: document.getElementById('f-cat').value,
      validade: document.getElementById('f-validade').value || '',
      dias: showH?dias:[],
      hIni: showH?document.getElementById('f-hini').value:'',
      hFim: showH?document.getElementById('f-hfim').value:'',
      freq: showH?document.getElementById('f-freq').value:'',
      obs: document.getElementById('f-obs').value,
    };
  }

  const list = items();
  if(editingId){ setItems(list.map(x=>x.id===editingId?p:x)); }
  else{ setItems([...list, p]); }

  render(); closeModal(); scheduleSync();
}

// =====================================================
// EXCLUIR
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
function closeDel(){document.getElementById('del-overlay').style.display='none';deleteId=null;}
function confirmDel(){
  setItems(items().filter(x=>x.id!==deleteId));
  render(); closeDel(); scheduleSync();
}

// =====================================================
// EXPORTAR
// =====================================================
function exportJSON(){
  const isPecas = activeTab === 'pecas';
  const list = items();
  const out = isPecas
    ? {version:'1.0',exportedAt:new Date().toISOString(),total:list.length,pecas:list.map(p=>({code:p.code,descricao:p.descricao,tempo:p.tempo,midia:p.midia,type:p.type,categoria:p.categoria,validade:p.validade||null,horario:{dias:p.dias?.length?p.dias:null,horaInicio:p.hIni||null,horaFim:p.hFim||null,frequenciaMax:p.freq?Number(p.freq):null,obs:p.obs||null}}))}
    : {version:'1.0',exportedAt:new Date().toISOString(),total:list.length,programas:list.map(p=>({code:p.code,descricao:p.descricao,tempo:p.tempo,midia:p.midia,type:p.type}))};
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'})),download:isPecas?'pecas-insercao.json':'programas.json'});
  a.click();
}

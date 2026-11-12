/**
 * src/ui/admin-painel.js
 * Painel Administrativo para gestão de emissoras, operadores e diagnóstico de saúde do sistema.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AdminPainel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  let _supabase = null;
  let _user = null;
  let _emissorasLista = [];
  let _emissoraSelecionadaId = null;

  function obterEmissoraAtivaId() {
    if (_emissoraSelecionadaId) return _emissoraSelecionadaId;
    if (window.EmissoraContext && typeof window.EmissoraContext.getEmissoraAtivaId === 'function') {
      return window.EmissoraContext.getEmissoraAtivaId();
    }
    const sel = document.getElementById('select-emissora');
    return sel ? sel.value : null;
  }

  function obterEmissoraAtivaNome() {
    const selecionada = _emissorasLista.find(e => e.id === _emissoraSelecionadaId);
    if (selecionada) return selecionada.nome;
    const sel = document.getElementById('select-emissora');
    if (sel && sel.selectedOptions && sel.selectedOptions[0]) {
      return sel.selectedOptions[0].text.trim();
    }
    return 'Emissora';
  }

  async function atualizarVisibilidadeBotao() {
    const btn = document.getElementById('btn-admin-painel');
    const hubCard = document.getElementById('hub-card-admin');

    if (!_supabase || !_user) {
      if (btn) btn.style.display = 'none';
      if (hubCard) hubCard.style.display = 'none';
      return;
    }

    try {
      const { data, error } = await _supabase
        .from('usuarios_emissoras')
        .select('emissora_id')
        .eq('usuario_id', _user.id)
        .eq('papel', 'admin')
        .eq('ativo', true)
        .limit(1);

      const ehAdmin = !error && data && data.length > 0;

      if (hubCard) {
        hubCard.style.display = ehAdmin ? 'block' : 'none';
      }
      if (btn) {
        btn.style.display = ehAdmin ? 'inline-flex' : 'none';
      }
    } catch (e) {
      if (hubCard) hubCard.style.display = 'none';
      if (btn) btn.style.display = 'none';
    }
  }

  function injetarBotao() {
    // Acesso ao painel administrativo centralizado exclusivamente no Hub
  }

  function renderModal() {
    if (document.getElementById('modal-admin-painel')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-admin-painel';
    modal.style.cssText = `
      display: none; position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,0.65); align-items: center; justify-content: center;
      backdrop-filter: blur(2px); font-family: inherit;
    `;

    modal.innerHTML = `
      <div style="background: #1e293b; color: #f8fafc; width: 94%; max-width: 700px;
                  border-radius: 12px; padding: 22px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
                  border: 1px solid #334155; max-height: 88vh; overflow-y: auto;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="assets/icone-roteirohub.png" alt="RoteiroHub" style="width: 26px; height: 26px; border-radius: 5px; object-fit: contain;">
            <div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; letter-spacing: 0.02em;">Painel de Administração · RoteiroHub</h3>
              <span id="admin-subtitulo-emissora" style="font-size: 0.82rem; color: #94a3b8;"></span>
            </div>
          </div>
          <button id="admin-btn-fechar" style="background: none; border: none; font-size: 1.4rem; color: #94a3b8; cursor: pointer;">&times;</button>
        </div>

        <div style="display: flex; gap: 8px; border-bottom: 1px solid #334155; margin-bottom: 18px; flex-wrap: wrap;">
          <button id="admin-tab-emissoras" style="padding: 8px 14px; background: none; border: none; border-bottom: 2px solid #38bdf8; color: #38bdf8; font-weight: 600; cursor: pointer; font-size: 0.88rem;">Emissoras Cadastradas</button>
          <button id="admin-tab-membros" style="padding: 8px 14px; background: none; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.88rem;">Equipe da Emissora</button>
          <button id="admin-tab-nova" style="padding: 8px 14px; background: none; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.88rem;">+ Nova Emissora</button>
          <button id="admin-tab-saude" style="padding: 8px 14px; background: none; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.88rem;">🩺 Saúde do Sistema</button>
        </div>

        <!-- ABA: EMISSORAS CADASTRADAS -->
        <div id="admin-painel-emissoras">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong style="font-size:.86rem;color:#cbd5e1;">Emissoras disponíveis para sua conta</strong>
            <button id="admin-btn-recarregar-emissoras" type="button" style="background:none;border:0;color:#38bdf8;cursor:pointer;">↻ Atualizar</button>
          </div>
          <div id="admin-lista-emissoras" style="border:1px solid #334155;border-radius:8px;overflow:hidden;background:#0f172a;">
            <p style="padding:14px;color:#94a3b8;margin:0;font-size:.85rem;">Carregando emissoras...</p>
          </div>
        </div>

        <!-- ABA 1: MEMBROS -->
        <div id="admin-painel-membros" style="display:none;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;background:#0f172a;padding:10px 14px;border-radius:8px;border:1px solid #334155;">
            <label for="admin-select-emissora-equipe" style="font-size:.85rem;font-weight:600;color:#cbd5e1;white-space:nowrap;">Equipe de:</label>
            <select id="admin-select-emissora-equipe" style="background:#1e293b;color:#fff;border:1px solid #475569;padding:6px 10px;border-radius:6px;font-size:.85rem;flex:1;"><option value="">Carregando...</option></select>
          </div>
          <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; color: #cbd5e1;">Adicionar ou Atualizar Membro</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <input type="email" id="admin-email-membro" placeholder="email@exemplo.com" style="flex: 2; min-width: 180px; padding: 7px 10px; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: #fff; font-size: 0.85rem;">
              <select id="admin-papel-membro" style="flex: 1; padding: 7px 8px; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: #fff; font-size: 0.85rem;">
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
                <option value="leitor">Leitor</option>
              </select>
              <button id="admin-btn-salvar-membro" style="background: #2563eb; color: #fff; border: none; padding: 7px 14px; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">Vincular</button>
            </div>
            <p id="admin-msg-membro" style="margin: 6px 0 0 0; font-size: 0.8rem;"></p>
          </div>

          <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; color: #cbd5e1;">Membros Cadastrados</div>
          <div id="admin-corpo-lista-membros" style="border: 1px solid #334155; border-radius: 8px; overflow: hidden; background: #0f172a;">
            <p style="padding: 14px; color: #94a3b8; margin: 0; font-size: 0.85rem;">Carregando...</p>
          </div>
        </div>

        <!-- ABA 2: NOVA EMISSORA -->
        <div id="admin-painel-nova" style="display: none;">
          <form id="admin-form-nova" style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.8rem; margin-bottom: 4px; color: #94a3b8;">Nome da Emissora *</label>
              <input type="text" id="admin-nova-nome" required placeholder="Ex: TV Brasil Central" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 0.85rem;">
            </div>
            <div style="display: flex; gap: 10px;">
              <div style="flex: 2;">
                <label style="display: block; font-size: 0.8rem; margin-bottom: 4px; color: #94a3b8;">Slug (identificador URL)</label>
                <input type="text" id="admin-nova-slug" placeholder="Ex: tbc" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 0.85rem;">
              </div>
              <div style="flex: 1;">
                <label style="display: block; font-size: 0.8rem; margin-bottom: 4px; color: #94a3b8;">Cor de Destaque</label>
                <input type="color" id="admin-nova-cor" value="#0066cc" style="width: 100%; height: 35px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; cursor: pointer;">
              </div>
            </div>
            <button type="submit" style="background: #10b981; color: #fff; border: none; padding: 9px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.9rem; margin-top: 4px;">Cadastrar Emissora</button>
            <p id="admin-msg-nova" style="margin: 4px 0 0 0; font-size: 0.8rem;"></p>
          </form>
        </div>

        <!-- ABA 3: SAÚDE DO SISTEMA -->
        <div id="admin-painel-saude" style="display: none;">
          
          <!-- BLOCO 1: CONEXÃO SUPABASE -->
          <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="font-size: 0.88rem; font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 6px;">
                <span>🌐 Conexão com Nuvem (Supabase)</span>
              </div>
              <button id="admin-btn-ping" style="background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 4px 10px; border-radius: 5px; font-size: 0.78rem; cursor: pointer;">🔄 Testar Latência</button>
            </div>
            <div id="admin-saude-conexao-status" style="font-size: 0.82rem; color: #94a3b8; display: flex; flex-direction: column; gap: 4px;">
              Aguardando teste...
            </div>
          </div>

          <!-- BLOCO 2: VOLUME DO BANCO & CATÁLOGO -->
          <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="font-size: 0.88rem; font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 6px;">
                <span>📊 Volume do Banco & Catálogo (Supabase)</span>
              </div>
              <button id="admin-btn-volume-banco" style="background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 4px 10px; border-radius: 5px; font-size: 0.78rem; cursor: pointer;">🔄 Analisar Volume</button>
            </div>

            <!-- Grade de Métricas -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-bottom: 10px;">
              <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 8px 10px; text-align: center;">
                <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase;">Peças da Emissora</div>
                <div id="admin-metrica-pecas" style="font-size: 1.15rem; font-weight: 700; color: #38bdf8; margin-top: 2px;">--</div>
              </div>
              <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 8px 10px; text-align: center;">
                <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase;">Programas</div>
                <div id="admin-metrica-programas" style="font-size: 1.15rem; font-weight: 700; color: #38bdf8; margin-top: 2px;">--</div>
              </div>
              <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 8px 10px; text-align: center;">
                <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase;">Payload user_data</div>
                <div id="admin-metrica-payload" style="font-size: 1.15rem; font-weight: 700; color: #10b981; margin-top: 2px;">--</div>
              </div>
              <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 8px 10px; text-align: center;">
                <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase;">Peças Sem Vínculo</div>
                <div id="admin-metrica-orfaos" style="font-size: 1.15rem; font-weight: 700; color: #10b981; margin-top: 2px;">--</div>
              </div>
            </div>

            <div id="admin-saude-banco-detalhes" style="font-size: 0.78rem; color: #94a3b8;">
              Clique em "Analisar Volume" para consultar os dados remotos.
            </div>
          </div>

          <!-- BLOCO 3: ARMAZENAMENTO LOCAL -->
          <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="font-size: 0.88rem; font-weight: 600; color: #cbd5e1;">
                💾 Armazenamento Local (Navegador)
              </div>
              <button id="admin-btn-recalcular-storage" style="background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 4px 10px; border-radius: 5px; font-size: 0.78rem; cursor: pointer;">🔄 Atualizar</button>
            </div>

            <!-- Barra de Progresso do LocalStorage -->
            <div style="margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #94a3b8; margin-bottom: 4px;">
                <span id="admin-storage-usado-txt">Uso: calculando...</span>
                <span id="admin-storage-limite-txt">Limite estimado: ~5 MB</span>
              </div>
              <div style="width: 100%; height: 10px; background: #1e293b; border-radius: 5px; overflow: hidden; border: 1px solid #334155;">
                <div id="admin-storage-progresso-barra" style="height: 100%; width: 0%; background: #10b981; transition: width 0.3s ease, background 0.3s ease;"></div>
              </div>
            </div>

            <!-- Tabela detalhada de chaves -->
            <div style="font-size: 0.8rem; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">Chaves e Caches Armazenados:</div>
            <div id="admin-storage-lista-chaves" style="max-height: 150px; overflow-y: auto; border: 1px solid #334155; border-radius: 6px; background: #1e293b; font-size: 0.78rem;">
              <p style="padding: 10px; color: #94a3b8; margin: 0;">Analisando chaves...</p>
            </div>

            <!-- Ações de Manutenção -->
            <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
              <button id="admin-btn-limpar-orfaos" style="background: #b45309; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer;">
                🧹 Limpar Caches Órfãos / Legados
              </button>
              <button id="admin-btn-backup-storage" style="background: #2563eb; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer;">
                📥 Baixar Backup Local (.json)
              </button>
            </div>
            <p id="admin-msg-storage" style="margin: 6px 0 0 0; font-size: 0.78rem;"></p>
          </div>

        </div>

      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('admin-btn-fechar').onclick = fecharModal;
    modal.onclick = (e) => { if (e.target === modal) fecharModal(); };

    document.getElementById('admin-tab-emissoras').onclick = () => alternarAba('emissoras');
    document.getElementById('admin-tab-membros').onclick = () => alternarAba('membros');
    document.getElementById('admin-btn-recarregar-emissoras').onclick = carregarListaEmissoras;
    document.getElementById('admin-select-emissora-equipe').onchange = (e) => {
      _emissoraSelecionadaId = e.target.value || null;
      carregarMembros();
    };
    document.getElementById('admin-tab-nova').onclick = () => alternarAba('nova');
    document.getElementById('admin-tab-saude').onclick = () => alternarAba('saude');

    document.getElementById('admin-btn-salvar-membro').onclick = salvarMembro;
    document.getElementById('admin-form-nova').onsubmit = (e) => {
      e.preventDefault();
      criarEmissora();
    };

    // Listeners da aba Saúde
    document.getElementById('admin-btn-ping').onclick = executarPingSupabase;
    document.getElementById('admin-btn-volume-banco').onclick = analisarVolumeBanco;
    document.getElementById('admin-btn-recalcular-storage').onclick = analisarArmazenamentoLocal;
    document.getElementById('admin-btn-limpar-orfaos').onclick = limparCachesOrfaos;
    document.getElementById('admin-btn-backup-storage').onclick = baixarBackupLocalStorage;
  }

  function alternarAba(aba) {
    const tabE = document.getElementById('admin-tab-emissoras');
    const tabM = document.getElementById('admin-tab-membros');
    const tabN = document.getElementById('admin-tab-nova');
    const tabS = document.getElementById('admin-tab-saude');
    const painelE = document.getElementById('admin-painel-emissoras');
    const painelM = document.getElementById('admin-painel-membros');
    const painelN = document.getElementById('admin-painel-nova');
    const painelS = document.getElementById('admin-painel-saude');

    [tabE, tabM, tabN, tabS].forEach(t => {
      if (t) {
        t.style.borderBottom = 'none';
        t.style.color = '#94a3b8';
      }
    });
    [painelE, painelM, painelN, painelS].forEach(p => {
      if (p) p.style.display = 'none';
    });

    if (aba === 'emissoras') {
      tabE.style.borderBottom = '2px solid #38bdf8';
      tabE.style.color = '#38bdf8';
      painelE.style.display = 'block';
      carregarListaEmissoras();
    } else if (aba === 'membros') {
      tabM.style.borderBottom = '2px solid #38bdf8';
      tabM.style.color = '#38bdf8';
      painelM.style.display = 'block';
      carregarMembros();
    } else if (aba === 'nova') {
      tabN.style.borderBottom = '2px solid #10b981';
      tabN.style.color = '#10b981';
      painelN.style.display = 'block';
    } else if (aba === 'saude') {
      tabS.style.borderBottom = '2px solid #a855f7';
      tabS.style.color = '#a855f7';
      painelS.style.display = 'block';
      carregarDiagnosticoSaude();
    }
  }

  async function abrirModal() {
    const modal = document.getElementById('modal-admin-painel');
    if (!modal) return;
    modal.style.display = 'flex';
    await carregarListaEmissoras();
    document.getElementById('admin-subtitulo-emissora').textContent = 'Emissora atual: ' + obterEmissoraAtivaNome();
    alternarAba('emissoras');
  }

  function fecharModal() {
    const modal = document.getElementById('modal-admin-painel');
    if (modal) modal.style.display = 'none';
  }

  // ==========================================
  // ABA 3: SAÚDE DO SISTEMA & DIAGNÓSTICO
  // ==========================================

  function carregarDiagnosticoSaude() {
    executarPingSupabase();
    analisarVolumeBanco();
    analisarArmazenamentoLocal();
  }

  async function executarPingSupabase() {
    const statusEl = document.getElementById('admin-saude-conexao-status');
    if (!statusEl) return;

    statusEl.innerHTML = '<span style="color: #38bdf8;">⏳ Testando conexão com Supabase...</span>';

    if (!_supabase) {
      statusEl.innerHTML = '<span style="color: #ef4444;">❌ Cliente Supabase não inicializado.</span>';
      return;
    }

    try {
      const t0 = performance.now();
      const { data, error } = await _supabase
        .from('emissoras')
        .select('id')
        .limit(1);
      const t1 = performance.now();
      const latencia = Math.round(t1 - t0);

      if (error) throw error;

      let corSemaforo = '#10b981'; // verde
      let classificacao = 'Excelente';
      if (latencia > 250 && latencia <= 600) {
        corSemaforo = '#f59e0b'; // amarelo
        classificacao = 'Moderada';
      } else if (latencia > 600) {
        corSemaforo = '#ef4444'; // vermelho
        classificacao = 'Lenta';
      }

      const usuarioEmail = _user?.email || 'Autenticado';
      const emissoraNome = obterEmissoraAtivaNome();
      const emissoraId = obterEmissoraAtivaId() || 'Nenhuma';

      statusEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${corSemaforo}; box-shadow: 0 0 6px ${corSemaforo};"></span>
          <span style="font-weight: 600; color: #f8fafc;">Conexão Online:</span>
          <span style="color: ${corSemaforo}; font-weight: 600;">${latencia} ms (${classificacao})</span>
        </div>
        <div style="color: #94a3b8; font-size: 0.76rem;">
          <div>• <strong>Operador:</strong> ${escapeHtml(usuarioEmail)}</div>
          <div>• <strong>Emissora Ativa:</strong> ${escapeHtml(emissoraNome)} <span style="font-family: monospace; font-size: 0.72rem; color: #64748b;">(${emissoraId})</span></div>
          <div>• <strong>Servidor:</strong> Supabase PostgreSQL (REST API OK)</div>
        </div>
      `;

    } catch (err) {
      statusEl.innerHTML = `
        <div style="color: #ef4444; font-weight: 600;">❌ Falha na conexão com Supabase:</div>
        <div style="color: #f87171; font-size: 0.75rem; margin-top: 2px;">${escapeHtml(err.message)}</div>
      `;
    }
  }

  async function analisarVolumeBanco() {
    const elPecas = document.getElementById('admin-metrica-pecas');
    const elProgramas = document.getElementById('admin-metrica-programas');
    const elPayload = document.getElementById('admin-metrica-payload');
    const elOrfaos = document.getElementById('admin-metrica-orfaos');
    const elDetalhes = document.getElementById('admin-saude-banco-detalhes');

    if (!elPecas || !elProgramas || !elPayload || !elOrfaos || !elDetalhes) return;

    const emissoraId = obterEmissoraAtivaId();
    if (!_supabase || !emissoraId) {
      elDetalhes.innerHTML = '<span style="color: #ef4444;">Selecione uma emissora ativa para analisar o banco.</span>';
      return;
    }

    elPecas.textContent = '...';
    elProgramas.textContent = '...';
    elPayload.textContent = '...';
    elOrfaos.textContent = '...';
    elDetalhes.innerHTML = '<span style="color: #38bdf8;">⏳ Consultando volume de registros e payload em nuvem...</span>';

    try {
      // 1. Contagem de Peças da Emissora
      const { count: countPecas, error: errPecas } = await _supabase
        .from('pecas')
        .select('id', { count: 'exact', head: true })
        .eq('emissora_id', emissoraId);

      // 2. Contagem de Programas da Emissora
      const { count: countProgramas, error: errProg } = await _supabase
        .from('programas')
        .select('id', { count: 'exact', head: true })
        .eq('emissora_id', emissoraId);

      // 3. Verificação de Peças Sem Vínculo (emissora_id IS NULL)
      const { count: countOrfaos, error: errOrfaos } = await _supabase
        .from('pecas')
        .select('id', { count: 'exact', head: true })
        .is('emissora_id', null);

      // 4. Estimativa do Payload em user_data
      let tamanhoUserDataKB = '0.0';
      let payloadStatus = 'Sem dados';
      let payloadCor = '#94a3b8';
      let atualizadoEmTxt = 'Nunca';

      const { data: userDataRows, error: errUser } = await _supabase
        .from('user_data')
        .select('updated_at, data')
        .eq('emissora_id', emissoraId)
        .limit(1);

      if (!errUser && userDataRows && userDataRows.length > 0) {
        const row = userDataRows[0];
        const jsonStr = JSON.stringify(row.data || {});
        const bytes = new TextEncoder().encode(jsonStr).length;
        const kb = (bytes / 1024).toFixed(1);
        tamanhoUserDataKB = kb;

        if (bytes > 500 * 1024) {
          payloadStatus = 'Pesado';
          payloadCor = '#ef4444';
        } else if (bytes > 200 * 1024) {
          payloadStatus = 'Moderado';
          payloadCor = '#f59e0b';
        } else {
          payloadStatus = 'Saudável';
          payloadCor = '#10b981';
        }

        if (row.updated_at) {
          atualizadoEmTxt = new Date(row.updated_at).toLocaleString('pt-BR');
        }
      }

      // Renderiza Métricas
      elPecas.textContent = errPecas ? 'Erro' : (countPecas ?? 0);
      elProgramas.textContent = errProg ? 'Erro' : (countProgramas ?? 0);

      elPayload.textContent = `${tamanhoUserDataKB} KB`;
      elPayload.style.color = payloadCor;

      const qtdOrfaos = countOrfaos ?? 0;
      elOrfaos.textContent = qtdOrfaos;
      if (qtdOrfaos > 0) {
        elOrfaos.style.color = '#ef4444';
      } else {
        elOrfaos.style.color = '#10b981';
      }

      // Mensagem explicativa
      let alertaOrfaos = '';
      if (qtdOrfaos > 0) {
        alertaOrfaos = `<div style="color: #ef4444; margin-top: 4px;">⚠️ <strong>Atenção:</strong> Existem ${qtdOrfaos} peças sem emissora vinculada no banco!</div>`;
      } else {
        alertaOrfaos = `<div style="color: #10b981; margin-top: 4px;">✅ Todas as peças estão devidamente vinculadas a emissoras.</div>`;
      }

      elDetalhes.innerHTML = `
        <div>• <strong>Estado do Roteiro em Nuvem:</strong> ${payloadStatus} (${tamanhoUserDataKB} KB) — Último sync: ${escapeHtml(atualizadoEmTxt)}</div>
        ${alertaOrfaos}
      `;

    } catch (err) {
      elDetalhes.innerHTML = `<span style="color: #ef4444;">Erro ao consultar volume do banco: ${escapeHtml(err.message)}</span>`;
    }
  }

  function analisarArmazenamentoLocal() {
    const usadoTxt = document.getElementById('admin-storage-usado-txt');
    const barra = document.getElementById('admin-storage-progresso-barra');
    const listaEl = document.getElementById('admin-storage-lista-chaves');
    if (!usadoTxt || !barra || !listaEl) return;

    let totalBytes = 0;
    const chaves = [];
    const limiteEstimadoBytes = 5 * 1024 * 1024; // 5 MB

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const val = localStorage.getItem(key) || '';
        // Em UTF-16, cada caractere ocupa 2 bytes
        const bytes = (key.length + val.length) * 2;
        totalBytes += bytes;

        const isLegado = key === 'roteiroApp' || key === 'gradeBase_legado';
        const isApp = key.startsWith('roteiroApp_') || key.startsWith('gradeEditor_') || key.startsWith('pecas_') || key.startsWith('programas_');

        chaves.push({
          chave: key,
          bytes: bytes,
          kb: (bytes / 1024).toFixed(1),
          isLegado,
          isApp
        });
      }

      chaves.sort((a, b) => b.bytes - a.bytes);

      const totalKB = (totalBytes / 1024).toFixed(1);
      const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
      const pct = Math.min(100, (totalBytes / limiteEstimadoBytes) * 100);
      const pctFormatado = pct.toFixed(1);

      usadoTxt.textContent = `Uso: ${totalMB} MB (${totalKB} KB) — ${pctFormatado}% da cota`;
      barra.style.width = `${pct}%`;

      if (pct < 60) {
        barra.style.background = '#10b981'; // verde
      } else if (pct < 85) {
        barra.style.background = '#f59e0b'; // amarelo
      } else {
        barra.style.background = '#ef4444'; // vermelho
      }

      if (chaves.length === 0) {
        listaEl.innerHTML = '<p style="padding: 10px; color: #94a3b8; margin: 0;">Nenhum dado salvo localmente.</p>';
        return;
      }

      listaEl.innerHTML = chaves.map(item => {
        let tag = '';
        if (item.isLegado) {
          tag = '<span style="background: #991b1b; color: #fee2e2; padding: 1px 5px; border-radius: 3px; font-size: 0.7rem; margin-left: 6px;">Órfão/Legado</span>';
        } else if (item.isApp) {
          tag = '<span style="background: #1e3a8a; color: #dbeafe; padding: 1px 5px; border-radius: 3px; font-size: 0.7rem; margin-left: 6px;">App Emissora</span>';
        }

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-bottom: 1px solid #334155;">
            <div style="font-family: monospace; word-break: break-all; max-width: 75%;">
              ${escapeHtml(item.chave)} ${tag}
            </div>
            <div style="font-weight: 600; color: #cbd5e1; white-space: nowrap;">
              ${item.kb} KB
            </div>
          </div>
        `;
      }).join('');

    } catch (e) {
      usadoTxt.textContent = 'Erro ao ler armazenamento: ' + e.message;
    }
  }

  function limparCachesOrfaos() {
    const msg = document.getElementById('admin-msg-storage');
    let removidos = 0;
    let bytesLiberados = 0;

    const chavesParaRemover = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key === 'roteiroApp' || key === 'gradeBase_legado') {
        chavesParaRemover.push(key);
      }
    }

    if (chavesParaRemover.length === 0) {
      if (msg) {
        msg.style.color = '#38bdf8';
        msg.textContent = 'Nenhum cache órfão ou legado encontrado. Armazenamento já está limpo!';
      }
      return;
    }

    if (!confirm(`Foram encontrados ${chavesParaRemover.length} cache(s) legados (${chavesParaRemover.join(', ')}). Deseja removê-los? Os dados das emissoras particionadas NÃO serão afetados.`)) {
      return;
    }

    chavesParaRemover.forEach(key => {
      const val = localStorage.getItem(key) || '';
      bytesLiberados += (key.length + val.length) * 2;
      localStorage.removeItem(key);
      removidos++;
    });

    analisarArmazenamentoLocal();

    if (msg) {
      msg.style.color = '#10b981';
      msg.textContent = `Sucesso! ${removidos} chave(s) legadas removidas. ${(bytesLiberados / 1024).toFixed(1)} KB liberados.`;
    }
  }

  function baixarBackupLocalStorage() {
    const dados = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        dados[key] = localStorage.getItem(key);
      }
    }

    const jsonStr = JSON.stringify(dados, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dataHora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `backup_storage_${dataHora}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const msg = document.getElementById('admin-msg-storage');
    if (msg) {
      msg.style.color = '#10b981';
      msg.textContent = 'Backup baixado com sucesso!';
    }
  }

  // ==========================================
  // ABA 1 & 2: MEMBROS E NOVA EMISSORA
  // ==========================================


  async function carregarListaEmissoras() {
    const lista = document.getElementById('admin-lista-emissoras');
    const selectEquipe = document.getElementById('admin-select-emissora-equipe');
    if (!lista || !_supabase) return;
    lista.innerHTML = '<p style="padding:14px;color:#94a3b8;margin:0;">Buscando emissoras...</p>';
    try {
      const { data, error } = await _supabase.rpc('fn_admin_listar_emissoras');
      if (error) throw error;
      _emissorasLista = Array.isArray(data) ? data : [];
      if (!_emissoraSelecionadaId || !_emissorasLista.some(e => e.id === _emissoraSelecionadaId)) {
        const ativa = window.EmissoraContext?.getEmissoraAtivaId?.();
        _emissoraSelecionadaId = _emissorasLista.some(e => e.id === ativa) ? ativa : (_emissorasLista[0]?.id || null);
      }
      if (selectEquipe) {
        selectEquipe.innerHTML = _emissorasLista.length
          ? _emissorasLista.map(e => `<option value="${escapeHtml(e.id)}" ${e.id === _emissoraSelecionadaId ? 'selected' : ''}>${escapeHtml(e.nome)}</option>`).join('')
          : '<option value="">Nenhuma emissora vinculada</option>';
      }
      if (!_emissorasLista.length) {
        lista.innerHTML = '<p style="padding:14px;color:#94a3b8;margin:0;">Nenhuma emissora administrada foi encontrada para este usuário.</p>';
        return;
      }
      lista.innerHTML = _emissorasLista.map(e => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-bottom:1px solid #334155;gap:10px;">
          <div><div style="font-weight:600;color:#f8fafc;">${escapeHtml(e.nome)}</div>
          <div style="font-size:.75rem;color:#94a3b8;">Slug: ${escapeHtml(e.slug || '—')} · ${Number(e.total_membros || 0)} membro(s)</div></div>
          <button class="admin-ver-equipe" data-id="${escapeHtml(e.id)}" style="background:#1e293b;border:1px solid #38bdf8;color:#38bdf8;padding:5px 9px;border-radius:6px;cursor:pointer;">Ver equipe</button>
        </div>`).join('');
      lista.querySelectorAll('.admin-ver-equipe').forEach(btn => btn.onclick = () => {
        _emissoraSelecionadaId = btn.dataset.id;
        if (selectEquipe) selectEquipe.value = _emissoraSelecionadaId;
        alternarAba('membros');
      });
    } catch (err) {
      lista.innerHTML = `<p style="padding:14px;color:#ef4444;margin:0;">Não foi possível listar emissoras: ${escapeHtml(err.message)}. Confirme a migration 016.</p>`;
    }
  }

  async function carregarMembros() {
    const corpo = document.getElementById('admin-corpo-lista-membros');
    const emissoraId = obterEmissoraAtivaId();
    if (!corpo) return;
    if (!_supabase) {
      corpo.innerHTML = '<p style="padding:14px;color:#ef4444;margin:0;">Cliente Supabase não inicializado. Recarregue e entre novamente.</p>';
      return;
    }
    if (!emissoraId) {
      corpo.innerHTML = '<p style="padding:14px;color:#94a3b8;margin:0;">Selecione uma emissora para carregar a equipe.</p>';
      return;
    }

    corpo.innerHTML = '<p style="padding: 12px; color: #94a3b8; margin: 0; font-size: 0.85rem;">Buscando membros...</p>';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_listar_membros', {
        p_emissora_id: emissoraId
      });

      if (error) throw error;
      const membros = Array.isArray(data) ? data : [];

      if (membros.length === 0) {
        corpo.innerHTML = '<p style="padding: 12px; color: #94a3b8; margin: 0; font-size: 0.85rem;">Nenhum membro encontrado.</p>';
        return;
      }

      corpo.innerHTML = membros.map(m => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #334155;">
          <div>
            <div style="font-weight: 600; font-size: 0.85rem;">${escapeHtml(m.email)}</div>
            <div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase;">Papel: <strong>${escapeHtml(m.papel)}</strong></div>
          </div>
          <button class="admin-remover-membro-btn" data-uid="${m.usuario_id}" style="background: none; border: 1px solid #ef4444; color: #ef4444; border-radius: 4px; padding: 3px 8px; font-size: 0.75rem; cursor: pointer;">Remover</button>
        </div>
      `).join('');

      corpo.querySelectorAll('.admin-remover-membro-btn').forEach(b => {
        b.onclick = () => removerMembro(b.dataset.uid);
      });

    } catch (err) {
      corpo.innerHTML = `<p style="padding: 12px; color: #ef4444; margin: 0; font-size: 0.85rem;">Erro: ${err.message}</p>`;
    }
  }

  async function salvarMembro() {
    const emailInput = document.getElementById('admin-email-membro');
    const papelInput = document.getElementById('admin-papel-membro');
    const msg = document.getElementById('admin-msg-membro');
    const emissoraId = obterEmissoraAtivaId();

    const email = emailInput.value.trim();
    const papel = papelInput.value;

    if (!email) {
      msg.style.color = '#ef4444';
      msg.textContent = 'Informe o e-mail.';
      return;
    }

    msg.style.color = '#94a3b8';
    msg.textContent = 'Salvando...';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_salvar_membro', {
        p_emissora_id: emissoraId,
        p_email: email,
        p_papel: papel
      });

      if (error) throw error;
      if (data && data.ok === false) {
        msg.style.color = '#ef4444';
        msg.textContent = data.mensagem || 'Usuário não encontrado.';
        return;
      }

      msg.style.color = '#10b981';
      msg.textContent = 'Vínculo atualizado com sucesso!';
      emailInput.value = '';
      carregarMembros(emissoraId);
      carregarListaEmissoras();
    } catch (err) {
      msg.style.color = '#ef4444';
      msg.textContent = 'Erro: ' + err.message;
    }
  }

  async function removerMembro(usuarioId) {
    if (!confirm('Deseja realmente remover o acesso deste membro a esta emissora?')) return;

    const emissoraId = obterEmissoraAtivaId();
    try {
      const { error } = await _supabase.rpc('fn_admin_remover_membro', {
        p_emissora_id: emissoraId,
        p_usuario_id: usuarioId
      });

      if (error) throw error;
      carregarMembros(emissoraId);
      carregarListaEmissoras();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  }

  async function criarEmissora() {
    const nome = document.getElementById('admin-nova-nome').value.trim();
    const slug = document.getElementById('admin-nova-slug').value.trim();
    const cor = document.getElementById('admin-nova-cor').value;
    const msg = document.getElementById('admin-msg-nova');

    msg.style.color = '#94a3b8';
    msg.textContent = 'Criando emissora...';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_criar_emissora', {
        p_nome: nome,
        p_slug: slug || null,
        p_cor: cor
      });

      if (error) throw error;

      msg.style.color = '#10b981';
      msg.textContent = `Emissora "${nome}" criada! Atualizando lista...`;
      if (data?.emissora_id) _emissoraSelecionadaId = data.emissora_id;
      await carregarListaEmissoras();
      setTimeout(() => alternarAba('emissoras'), 500);

    } catch (err) {
      msg.style.color = '#ef4444';
      msg.textContent = 'Erro: ' + err.message;
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return {
    init: function (supabaseClient, currentUser) {
      _supabase = supabaseClient;
      _user = currentUser;
      // Botão agora vive apenas no Hub
      renderModal();
      atualizarVisibilidadeBotao();
    },
    atualizarBotao: atualizarVisibilidadeBotao,
    abrir: abrirModal,
    fechar: fecharModal
  };
});

/**
 * src/ui/admin-painel.js
 * Painel Administrativo White-Label:
 * - Listagem, criação, edição e exclusão segura de emissoras
 * - Gestão de equipe e operadores por emissora com designação, alteração de papel e desvinculação
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
  let _emissorasCache = [];
  let _emissoraEquipeSelecionadaId = null;

  function obterEmissoraAtivaId() {
    if (window.EmissoraContext && typeof window.EmissoraContext.getEmissoraAtivaId === 'function') {
      return window.EmissoraContext.getEmissoraAtivaId();
    }
    const sel = document.getElementById('select-emissora');
    return sel ? sel.value : null;
  }

  async function verificarSeEhAdmin() {
    if (!_supabase || !_user) return false;
    try {
      const { data, error } = await _supabase
        .from('usuarios_emissoras')
        .select('emissora_id')
        .eq('usuario_id', _user.id)
        .eq('papel', 'admin')
        .eq('ativo', true)
        .limit(1);

      return !error && Array.isArray(data) && data.length > 0;
    } catch (e) {
      return false;
    }
  }

  async function atualizarVisibilidadeCardHub() {
    const hubCard = document.getElementById('hub-card-admin') || document.getElementById('card-hub-admin');
    const btnTopbar = document.getElementById('btn-admin-painel');
    const ehAdmin = await verificarSeEhAdmin();

    if (hubCard) hubCard.style.display = ehAdmin ? 'block' : 'none';
    if (btnTopbar) btnTopbar.style.display = ehAdmin ? 'inline-flex' : 'none';
  }

  function renderModal() {
    if (document.getElementById('modal-admin-painel')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-admin-painel';
    modal.style.cssText = `
      display: none; position: fixed; inset: 0; z-index: 9999;
      background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px);
      align-items: center; justify-content: center; padding: 16px;
      font-family: inherit; box-sizing: border-box;
    `;

    modal.innerHTML = `
      <div style="
        background: #1e293b; color: #f8fafc; width: 100%; max-width: 760px;
        max-height: 90vh; border-radius: 12px; border: 1px solid #334155;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); display: flex;
        flex-direction: column; overflow: hidden;
      ">
        <!-- Cabeçalho -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #334155; background: #0f172a;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.3rem;">⚙️</span>
            <div>
              <h2 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #f8fafc;">Painel de Administração</h2>
              <p style="margin: 0; font-size: 0.8rem; color: #94a3b8;">Gerencie emissoras, slugs, logos e operadores</p>
            </div>
          </div>
          <button id="admin-modal-fechar" style="background: none; border: none; color: #94a3b8; font-size: 1.4rem; cursor: pointer; padding: 4px 8px; border-radius: 4px; line-height: 1;">✕</button>
        </div>

        <!-- Abas -->
        <div style="display: flex; border-bottom: 1px solid #334155; background: #0f172a; padding: 0 16px; gap: 8px;">
          <button id="admin-tab-emissoras" style="background: none; border: none; border-bottom: 2px solid #38bdf8; color: #38bdf8; padding: 12px 16px; font-weight: 600; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            🏢 Emissoras
          </button>
          <button id="admin-tab-equipe" style="background: none; border: none; border-bottom: 2px solid transparent; color: #94a3b8; padding: 12px 16px; font-weight: 600; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            👥 Equipe e Operadores
          </button>
        </div>

        <!-- Conteúdo do Modal (Scrollável) -->
        <div style="flex: 1; overflow-y: auto; padding: 20px;">
          
          <!-- ABA 1: EMISSORAS (LISTAGEM, EDIÇÃO, EXCLUSÃO E CRIAÇÃO) -->
          <div id="admin-aba-emissoras">
            
            <!-- Vista 1: Lista Geral de Emissoras -->
            <div id="admin-secao-lista-emissoras">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div>
                  <h3 style="margin: 0; font-size: 1rem; color: #e2e8f0;">Emissoras Gerenciadas</h3>
                  <p style="margin: 4px 0 0 0; font-size: 0.82rem; color: #94a3b8;">Todas as emissoras onde você possui permissão de administrador</p>
                </div>
                <button id="admin-btn-nova-emissora-abrir" style="background: #10b981; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
                  + Nova Emissora
                </button>
              </div>

              <div id="admin-lista-emissoras-container" style="display: flex; flex-direction: column; gap: 10px;">
                <p style="color: #94a3b8; font-size: 0.88rem;">Carregando emissoras...</p>
              </div>
            </div>

            <!-- Vista 2: Formulário de Edição de Emissora (inclusive Slug) -->
            <div id="admin-secao-editar-emissora" style="display: none;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                <button id="admin-btn-voltar-lista" style="background: none; border: 1px solid #475569; color: #cbd5e1; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;">← Voltar à Lista</button>
                <h3 id="admin-titulo-edicao" style="margin: 0; font-size: 1rem; color: #38bdf8;">Editar Emissora</h3>
              </div>

              <form id="admin-form-editar-emissora" style="display: flex; flex-direction: column; gap: 14px; background: #0f172a; padding: 18px; border-radius: 8px; border: 1px solid #334155;">
                <input type="hidden" id="admin-edit-id" />

                <div>
                  <label style="display: block; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; font-weight: 600;">Nome da Emissora *</label>
                  <input type="text" id="admin-edit-nome" required style="width: 100%; box-sizing: border-box; background: #1e293b; border: 1px solid #475569; border-radius: 6px; padding: 8px 12px; color: #f8fafc; font-size: 0.9rem;" />
                </div>

                <div>
                  <label style="display: block; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; font-weight: 600;">Slug da Emissora (identificador exclusivo) *</label>
                  <input type="text" id="admin-edit-slug" required pattern="[a-z0-9_-]+" style="width: 100%; box-sizing: border-box; background: #1e293b; border: 1px solid #475569; border-radius: 6px; padding: 8px 12px; color: #f8fafc; font-size: 0.9rem; font-family: monospace;" />
                  <span style="font-size: 0.75rem; color: #94a3b8;">Use apenas letras minúsculas, números, hifens e sublinhados (ex: tv-brasil-central, canaledu).</span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label style="display: block; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; font-weight: 600;">Cor Primária</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <input type="color" id="admin-edit-cor-picker" style="width: 42px; height: 38px; border: none; border-radius: 6px; background: transparent; cursor: pointer;" />
                      <input type="text" id="admin-edit-cor-text" maxlength="7" style="flex: 1; background: #1e293b; border: 1px solid #475569; border-radius: 6px; padding: 8px 10px; color: #f8fafc; font-size: 0.9rem; font-family: monospace;" />
                    </div>
                  </div>

                  <div>
                    <label style="display: block; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; font-weight: 600;">URL do Logotipo</label>
                    <input type="url" id="admin-edit-logo" placeholder="https://exemplo.com/logo.png" style="width: 100%; box-sizing: border-box; background: #1e293b; border: 1px solid #475569; border-radius: 6px; padding: 8px 12px; color: #f8fafc; font-size: 0.9rem;" />
                  </div>
                </div>

                <div id="admin-edit-msg" style="display: none; padding: 10px; border-radius: 6px; font-size: 0.85rem;"></div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
                  <button type="button" id="admin-btn-cancelar-edicao" style="background: #334155; color: #cbd5e1; border: none; padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; cursor: pointer;">Cancelar</button>
                  <button type="submit" id="admin-btn-salvar-edicao" style="background: #38bdf8; color: #0f172a; border: none; padding: 8px 20px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; cursor: pointer;">Salvar Alterações</button>
                </div>
              </form>
            </div>

            <!-- Vista 3: Formulário de Nova Emissora -->
            <div id="admin-secao-nova-emissora" style="display: none;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                <button id="admin-btn-voltar-lista-2" style="background: none; border: 1px solid #475569; color: #cbd5e1; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;">← Voltar à Lista</button>
                <h3 style="margin: 0; font-size: 1rem; color: #10b981;">Cadastrar Nova Emissora</h3>
              </div>

              <form id="admin-form-nova-emissora" style="display: flex; flex-direction: column; gap: 14px; background: #0f172a; padding: 18px; border-radius: 8px; border: 1px solid #334155;">
                <div>
                  <label style="display: block; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; font-weight: 600;">Nome da Emissora *</label>
                  <input type="text" id="admin-nova-nome" required placeholder="Ex: TV Brasil Central" style="width: 100%; box-sizing: border-box; background: #1e293b; border: 1px solid #475569; border-radius: 6px; padding: 8px 12px; color: #f8fafc; font-size: 0.9rem;" />
                </div>

                <div>
                  <label style="display: block; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; font-weight: 600;">Slug (opcional)</label>
                  <input type="text" id="admin-nova-slug" placeholder="Ex: tv-brasil-central (gerado automaticamente se vazio)" style="width: 100%; box-sizing: border-box; background: #1e293b; border: 1px solid #475569; border-radius: 6px; padding: 8px 12px; color: #f8fafc; font-size: 0.9rem; font-family: monospace;" />
                </div>

                <div>
                  <label style="display: block; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; font-weight: 600;">Cor Primária</label>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="color" id="admin-nova-cor-picker" value="#0066cc" style="width: 42px; height: 38px; border: none; border-radius: 6px; background: transparent; cursor: pointer;" />
                    <input type="text" id="admin-nova-cor-text" value="#0066cc" maxlength="7" style="flex: 1; background: #1e293b; border: 1px solid #475569; border-radius: 6px; padding: 8px 10px; color: #f8fafc; font-size: 0.9rem; font-family: monospace;" />
                  </div>
                </div>

                <div id="admin-nova-msg" style="display: none; padding: 10px; border-radius: 6px; font-size: 0.85rem;"></div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
                  <button type="button" id="admin-btn-cancelar-nova" style="background: #334155; color: #cbd5e1; border: none; padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; cursor: pointer;">Cancelar</button>
                  <button type="submit" style="background: #10b981; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; cursor: pointer;">Criar Emissora</button>
                </div>
              </form>
            </div>

          </div>

          <!-- ABA 2: EQUIPE E OPERADORES POR EMISSORA -->
          <div id="admin-aba-equipe" style="display: none;">
            
            <!-- Barra superior de seleção da Emissora gerenciada -->
            <div style="background: #0f172a; padding: 14px 18px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 18px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <label style="font-weight: 700; font-size: 0.9rem; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
                  <span>🏢</span> Gerenciar Equipe da Emissora:
                </label>
                <select id="admin-equipe-seletor-emissora" style="background: #1e293b; color: #f8fafc; border: 1px solid #38bdf8; border-radius: 6px; padding: 6px 12px; font-size: 0.9rem; font-weight: 600; cursor: pointer; outline: none;">
                  <option value="">Carregando emissoras...</option>
                </select>
              </div>
              <span id="admin-equipe-contador" style="font-size: 0.8rem; color: #94a3b8; background: #1e293b; padding: 4px 10px; border-radius: 12px; border: 1px solid #334155;">
                0 membros
              </span>
            </div>

            <!-- Lista de Membros da Emissora Selecionada -->
            <div style="margin-bottom: 20px;">
              <h4 style="margin: 0 0 10px 0; font-size: 0.9rem; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.05em;">Operadores e Permissões</h4>
              <div id="admin-lista-membros-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto;">
                <p style="color: #94a3b8; font-size: 0.85rem;">Selecione uma emissora para carregar os membros.</p>
              </div>
            </div>

            <!-- Formulário para Designar / Adicionar Membro -->
            <div style="background: #0f172a; padding: 16px 18px; border-radius: 8px; border: 1px solid #334155;">
              <h4 style="margin: 0 0 12px 0; font-size: 0.9rem; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
                <span>➕</span> <span id="admin-lbl-designar-titulo">Vincular Novo Membro à Emissora</span>
              </h4>

              <form id="admin-form-adicionar-membro" style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
                  <div>
                    <label style="display: block; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 4px; font-weight: 600;">E-mail do Usuário *</label>
                    <input type="email" id="admin-membro-email" required placeholder="operador@emissora.com" style="width: 100%; box-sizing: border-box; background: #1e293b; border: 1px solid #475569; border-radius: 6px; padding: 8px 12px; color: #f8fafc; font-size: 0.85rem;" />
                  </div>
                  <div>
                    <label style="display: block; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 4px; font-weight: 600;">Papel / Permissão *</label>
                    <select id="admin-membro-papel" style="width: 100%; box-sizing: border-box; background: #1e293b; border: 1px solid #475569; border-radius: 6px; padding: 8px 10px; color: #f8fafc; font-size: 0.85rem; cursor: pointer;">
                      <option value="operador">Operador (Edita roteiros e peças)</option>
                      <option value="admin">Admin (Acesso total e gestão)</option>
                      <option value="leitor">Leitor (Apenas visualização)</option>
                    </select>
                  </div>
                </div>

                <div id="admin-membro-msg" style="display: none; padding: 8px 12px; border-radius: 6px; font-size: 0.82rem;"></div>

                <div style="display: flex; justify-content: flex-end;">
                  <button type="submit" id="admin-btn-salvar-membro" style="background: #38bdf8; color: #0f172a; border: none; padding: 8px 18px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; cursor: pointer;">
                    + Designar à Emissora
                  </button>
                </div>
              </form>
            </div>

          </div>

        </div>
      </div>
    `;

    document.body.appendChild(modal);
    configurarEventosModal();
  }

  function configurarEventosModal() {
    document.getElementById('admin-modal-fechar').onclick = fecharModal;
    const modal = document.getElementById('modal-admin-painel');
    modal.onclick = (e) => {
      if (e.target === modal) fecharModal();
    };

    const tabEmissoras = document.getElementById('admin-tab-emissoras');
    const tabEquipe = document.getElementById('admin-tab-equipe');

    tabEmissoras.onclick = () => alternarAbaPrincipal('emissoras');
    tabEquipe.onclick = () => alternarAbaPrincipal('equipe');

    document.getElementById('admin-btn-nova-emissora-abrir').onclick = () => mostrarSubsecaoEmissora('nova');
    document.getElementById('admin-btn-voltar-lista').onclick = () => mostrarSubsecaoEmissora('lista');
    document.getElementById('admin-btn-voltar-lista-2').onclick = () => mostrarSubsecaoEmissora('lista');
    document.getElementById('admin-btn-cancelar-edicao').onclick = () => mostrarSubsecaoEmissora('lista');
    document.getElementById('admin-btn-cancelar-nova').onclick = () => mostrarSubsecaoEmissora('lista');

    const pickerEdit = document.getElementById('admin-edit-cor-picker');
    const textEdit = document.getElementById('admin-edit-cor-text');
    pickerEdit.oninput = () => textEdit.value = pickerEdit.value;
    textEdit.oninput = () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(textEdit.value)) pickerEdit.value = textEdit.value;
    };

    const pickerNova = document.getElementById('admin-nova-cor-picker');
    const textNova = document.getElementById('admin-nova-cor-text');
    pickerNova.oninput = () => textNova.value = pickerNova.value;
    textNova.oninput = () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(textNova.value)) pickerNova.value = textNova.value;
    };

    document.getElementById('admin-form-nova-emissora').onsubmit = async (e) => {
      e.preventDefault();
      await salvarNovaEmissora();
    };

    document.getElementById('admin-form-editar-emissora').onsubmit = async (e) => {
      e.preventDefault();
      await salvarEdicaoEmissora();
    };

    document.getElementById('admin-equipe-seletor-emissora').onchange = (e) => {
      _emissoraEquipeSelecionadaId = e.target.value;
      carregarMembrosDaEmissoraSelecionada();
    };

    document.getElementById('admin-form-adicionar-membro').onsubmit = async (e) => {
      e.preventDefault();
      await adicionarMembro();
    };
  }

  function alternarAbaPrincipal(aba) {
    const tabEmissoras = document.getElementById('admin-tab-emissoras');
    const tabEquipe = document.getElementById('admin-tab-equipe');
    const abaEmissoras = document.getElementById('admin-aba-emissoras');
    const abaEquipe = document.getElementById('admin-aba-equipe');

    if (aba === 'emissoras') {
      tabEmissoras.style.borderBottom = '2px solid #38bdf8';
      tabEmissoras.style.color = '#38bdf8';
      tabEquipe.style.borderBottom = '2px solid transparent';
      tabEquipe.style.color = '#94a3b8';
      abaEmissoras.style.display = 'block';
      abaEquipe.style.display = 'none';
      carregarListaEmissoras();
    } else {
      tabEquipe.style.borderBottom = '2px solid #38bdf8';
      tabEquipe.style.color = '#38bdf8';
      tabEmissoras.style.borderBottom = '2px solid transparent';
      tabEmissoras.style.color = '#94a3b8';
      abaEquipe.style.display = 'block';
      abaEmissoras.style.display = 'none';
      atualizarSeletorEmissorasEquipe();
    }
  }

  function mostrarSubsecaoEmissora(subsecao) {
    const secLista = document.getElementById('admin-secao-lista-emissoras');
    const secEditar = document.getElementById('admin-secao-editar-emissora');
    const secNova = document.getElementById('admin-secao-nova-emissora');

    secLista.style.display = subsecao === 'lista' ? 'block' : 'none';
    secEditar.style.display = subsecao === 'editar' ? 'block' : 'none';
    secNova.style.display = subsecao === 'nova' ? 'block' : 'none';
  }

  async function carregarListaEmissoras() {
    const container = document.getElementById('admin-lista-emissoras-container');
    if (!container || !_supabase) return;

    container.innerHTML = '<p style="color: #94a3b8; font-size: 0.88rem; padding: 8px 0;">Carregando emissoras...</p>';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_listar_emissoras');
      if (error) throw error;

      _emissorasCache = Array.isArray(data) ? data : [];

      if (_emissorasCache.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8; font-size: 0.88rem;">Nenhuma emissora cadastrada sob sua administração.</p>';
        return;
      }

      container.innerHTML = _emissorasCache.map(e => `
        <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: ${e.cor_primaria || '#0066cc'}; border: 2px solid #334155; flex-shrink: 0;"></div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">${e.nome}</span>
                <span style="font-family: monospace; font-size: 0.75rem; background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 4px; border: 1px solid #334155;">slug: ${e.slug}</span>
              </div>
              <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 2px;">
                👥 ${e.total_membros || 1} membro(s) vinculados
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn-editar-emissora" data-id="${e.id}" style="background: #1e293b; border: 1px solid #475569; color: #f8fafc; padding: 6px 14px; border-radius: 6px; font-size: 0.82rem; font-weight: 600; cursor: pointer;">
              ✏️ Editar
            </button>
            ${e.id !== '00000000-0000-0000-0000-000000000001' ? `
              <button class="btn-excluir-emissora" data-id="${e.id}" data-nome="${e.nome}" style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #ef4444; padding: 6px 12px; border-radius: 6px; font-size: 0.82rem; font-weight: 600; cursor: pointer;">
                🗑️ Excluir
              </button>
            ` : ''}
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.btn-editar-emissora').forEach(btn => {
        btn.onclick = () => iniciarEdicaoEmissora(btn.dataset.id);
      });

      container.querySelectorAll('.btn-excluir-emissora').forEach(btn => {
        btn.onclick = () => confirmarExclusaoEmissora(btn.dataset.id, btn.dataset.nome);
      });

    } catch (err) {
      container.innerHTML = `<p style="color: #ef4444; font-size: 0.85rem;">Erro ao listar emissoras: ${err.message}</p>`;
    }
  }

  async function confirmarExclusaoEmissora(emissoraId, nome) {
    if (!emissoraId || !_supabase) return;
    if (emissoraId === '00000000-0000-0000-0000-000000000001') {
      alert('A emissora principal (Canal Educação) não pode ser excluída.');
      return;
    }

    const conf = confirm(`Deseja realmente excluir a emissora "${nome}"?\nEsta ação apagará a emissora e todos os seus vínculos.\nNão poderá ser desfeita.`);
    if (!conf) return;

    try {
      const { data, error } = await _supabase.rpc('fn_admin_excluir_emissora', {
        p_emissora_id: emissoraId
      });

      if (error) throw error;

      alert(`✓ Emissora "${nome}" excluída com sucesso!`);

      const ativaId = obterEmissoraAtivaId();
      if (ativaId === emissoraId) {
        if (window.EmissoraContext && typeof window.EmissoraContext.setEmissoraAtiva === 'function') {
          window.EmissoraContext.setEmissoraAtiva('00000000-0000-0000-0000-000000000001');
        }
      }

      await carregarListaEmissoras();

      if (window.EmissoraContext && typeof window.EmissoraContext.carregarEmissorasAutorizadas === 'function') {
        await window.EmissoraContext.carregarEmissorasAutorizadas();
      }
    } catch (err) {
      alert(`Erro ao excluir emissora: ${err.message}`);
    }
  }

  function iniciarEdicaoEmissora(emissoraId) {
    const emissora = _emissorasCache.find(e => e.id === emissoraId);
    if (!emissora) return;

    document.getElementById('admin-edit-id').value = emissora.id;
    document.getElementById('admin-edit-nome').value = emissora.nome || '';
    document.getElementById('admin-edit-slug').value = emissora.slug || '';
    
    const cor = emissora.cor_primaria || '#0066cc';
    document.getElementById('admin-edit-cor-picker').value = cor;
    document.getElementById('admin-edit-cor-text').value = cor;
    document.getElementById('admin-edit-logo').value = emissora.logo_url || '';

    const msg = document.getElementById('admin-edit-msg');
    msg.style.display = 'none';

    document.getElementById('admin-titulo-edicao').textContent = `Editar: ${emissora.nome}`;
    mostrarSubsecaoEmissora('editar');
  }

  async function salvarEdicaoEmissora() {
    const id = document.getElementById('admin-edit-id').value;
    const nome = document.getElementById('admin-edit-nome').value.trim();
    const slug = document.getElementById('admin-edit-slug').value.trim();
    const cor = document.getElementById('admin-edit-cor-text').value.trim();
    const logoUrl = document.getElementById('admin-edit-logo').value.trim();
    const msg = document.getElementById('admin-edit-msg');

    msg.style.display = 'block';
    msg.style.background = '#1e293b';
    msg.style.color = '#38bdf8';
    msg.textContent = 'Salvando alterações da emissora...';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_atualizar_emissora', {
        p_emissora_id: id,
        p_nome: nome,
        p_slug: slug,
        p_cor: cor,
        p_logo_url: logoUrl || null
      });

      if (error) throw error;

      msg.style.background = 'rgba(16, 185, 129, 0.15)';
      msg.style.color = '#34d399';
      msg.textContent = '✓ Emissora e slug atualizados com sucesso!';

      setTimeout(async () => {
        mostrarSubsecaoEmissora('lista');
        await carregarListaEmissoras();
        if (window.EmissoraContext && typeof window.EmissoraContext.carregarEmissorasAutorizadas === 'function') {
          await window.EmissoraContext.carregarEmissorasAutorizadas();
        }
      }, 900);

    } catch (err) {
      msg.style.background = 'rgba(239, 68, 68, 0.15)';
      msg.style.color = '#f87171';
      msg.textContent = `Erro ao salvar: ${err.message}`;
    }
  }

  async function salvarNovaEmissora() {
    const nome = document.getElementById('admin-nova-nome').value.trim();
    const slug = document.getElementById('admin-nova-slug').value.trim();
    const cor = document.getElementById('admin-nova-cor-text').value.trim();
    const msg = document.getElementById('admin-nova-msg');

    msg.style.display = 'block';
    msg.style.background = '#1e293b';
    msg.style.color = '#38bdf8';
    msg.textContent = 'Criando emissora...';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_criar_emissora', {
        p_nome: nome,
        p_slug: slug || null,
        p_cor: cor || '#0066cc'
      });

      if (error) throw error;

      msg.style.background = 'rgba(16, 185, 129, 0.15)';
      msg.style.color = '#34d399';
      msg.textContent = `✓ Emissora "${nome}" criada com sucesso!`;

      setTimeout(async () => {
        document.getElementById('admin-form-nova-emissora').reset();
        mostrarSubsecaoEmissora('lista');
        await carregarListaEmissoras();
        if (window.EmissoraContext && typeof window.EmissoraContext.carregarEmissorasAutorizadas === 'function') {
          await window.EmissoraContext.carregarEmissorasAutorizadas();
        }
      }, 1000);

    } catch (err) {
      msg.style.background = 'rgba(239, 68, 68, 0.15)';
      msg.style.color = '#f87171';
      msg.textContent = `Erro ao criar: ${err.message}`;
    }
  }

  async function atualizarSeletorEmissorasEquipe() {
    const sel = document.getElementById('admin-equipe-seletor-emissora');
    if (!sel || !_supabase) return;

    if (_emissorasCache.length === 0) {
      try {
        const { data } = await _supabase.rpc('fn_admin_listar_emissoras');
        if (Array.isArray(data)) _emissorasCache = data;
      } catch (e) {
        console.warn('Erro ao carregar emissoras para equipe:', e);
      }
    }

    if (_emissorasCache.length === 0) {
      sel.innerHTML = '<option value="">Nenhuma emissora disponível</option>';
      return;
    }

    sel.innerHTML = _emissorasCache.map(e => `
      <option value="${e.id}">${e.nome} (${e.slug})</option>
    `).join('');

    const ativaId = obterEmissoraAtivaId();
    if (ativaId && _emissorasCache.some(e => e.id === ativaId)) {
      sel.value = ativaId;
      _emissoraEquipeSelecionadaId = ativaId;
    } else {
      _emissoraEquipeSelecionadaId = _emissorasCache[0].id;
      sel.value = _emissoraEquipeSelecionadaId;
    }

    carregarMembrosDaEmissoraSelecionada();
  }

  async function carregarMembrosDaEmissoraSelecionada() {
    const container = document.getElementById('admin-lista-membros-container');
    const contador = document.getElementById('admin-equipe-contador');
    const lblTitulo = document.getElementById('admin-lbl-designar-titulo');
    const emissoraId = _emissoraEquipeSelecionadaId;

    if (!emissoraId || !_supabase) return;

    const emissora = _emissorasCache.find(e => e.id === emissoraId);
    const nomeEmissora = emissora ? emissora.nome : 'Emissora';
    if (lblTitulo) lblTitulo.textContent = `Designar Novo Membro para "${nomeEmissora}"`;

    container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; padding: 10px 0;">Carregando operadores...</p>';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_listar_membros', {
        p_emissora_id: emissoraId
      });

      if (error) throw error;

      const membros = Array.isArray(data) ? data : [];
      if (contador) contador.textContent = `${membros.length} membro(s)`;

      if (membros.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; padding: 8px 0;">Nenhum membro vinculado a esta emissora ainda.</p>';
        return;
      }

      container.innerHTML = membros.map(m => `
        <div style="background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div>
            <span style="font-weight: 600; font-size: 0.9rem; color: #f8fafc; display: block;">${m.email}</span>
            <span style="font-size: 0.75rem; color: #94a3b8;">Cadastrado em: ${m.created_at ? new Date(m.created_at).toLocaleDateString('pt-BR') : '—'}</span>
          </div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <select class="admin-sel-papel" data-email="${m.email}" style="background: #1e293b; color: #cbd5e1; border: 1px solid #475569; border-radius: 4px; padding: 4px 8px; font-size: 0.8rem; cursor: pointer;">
              <option value="operador" ${m.papel === 'operador' ? 'selected' : ''}>Operador</option>
              <option value="admin" ${m.papel === 'admin' ? 'selected' : ''}>Admin</option>
              <option value="leitor" ${m.papel === 'leitor' ? 'selected' : ''}>Leitor</option>
            </select>
            
            <button class="btn-remover-membro" data-uid="${m.usuario_id}" data-email="${m.email}" title="Desvincular da emissora" style="background: none; border: 1px solid #ef4444; color: #ef4444; border-radius: 4px; padding: 4px 8px; font-size: 0.78rem; cursor: pointer;">
              Remover
            </button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.admin-sel-papel').forEach(sel => {
        sel.onchange = async (e) => {
          await alterarPapelMembro(sel.dataset.email, e.target.value);
        };
      });

      container.querySelectorAll('.btn-remover-membro').forEach(btn => {
        btn.onclick = async () => {
          await removerMembro(btn.dataset.uid, btn.dataset.email);
        };
      });

    } catch (err) {
      container.innerHTML = `<p style="color: #ef4444; font-size: 0.85rem;">Erro ao listar membros: ${err.message}</p>`;
    }
  }

  async function alterarPapelMembro(email, novoPapel) {
    const emissoraId = _emissoraEquipeSelecionadaId;
    if (!emissoraId || !_supabase) return;

    try {
      const { data, error } = await _supabase.rpc('fn_admin_salvar_membro', {
        p_emissora_id: emissoraId,
        p_email: email,
        p_papel: novoPapel
      });

      if (error) throw error;
      await carregarMembrosDaEmissoraSelecionada();
    } catch (err) {
      alert(`Erro ao alterar permissão: ${err.message}`);
      await carregarMembrosDaEmissoraSelecionada();
    }
  }

  async function removerMembro(usuarioId, email) {
    const emissoraId = _emissoraEquipeSelecionadaId;
    if (!emissoraId || !_supabase) return;

    const conf = confirm(`Deseja realmente desvincular o usuário "${email}" desta emissora?`);
    if (!conf) return;

    try {
      const { data, error } = await _supabase.rpc('fn_admin_remover_membro', {
        p_emissora_id: emissoraId,
        p_usuario_id: usuarioId
      });

      if (error) throw error;
      await carregarMembrosDaEmissoraSelecionada();
    } catch (err) {
      alert(`Não foi possível remover: ${err.message}`);
    }
  }

  async function adicionarMembro() {
    const email = document.getElementById('admin-membro-email').value.trim();
    const papel = document.getElementById('admin-membro-papel').value;
    const msg = document.getElementById('admin-membro-msg');
    const emissoraId = _emissoraEquipeSelecionadaId;

    if (!emissoraId) {
      alert('Selecione uma emissora antes de adicionar membros.');
      return;
    }

    msg.style.display = 'block';
    msg.style.background = '#1e293b';
    msg.style.color = '#38bdf8';
    msg.textContent = 'Vinculando membro...';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_salvar_membro', {
        p_emissora_id: emissoraId,
        p_email: email,
        p_papel: papel
      });

      if (error) throw error;

      if (data && data.ok === false) {
        msg.style.background = 'rgba(239, 68, 68, 0.15)';
        msg.style.color = '#f87171';
        msg.textContent = data.mensagem || 'Usuário não encontrado.';
        return;
      }

      msg.style.background = 'rgba(16, 185, 129, 0.15)';
      msg.style.color = '#34d399';
      msg.textContent = `✓ Usuário "${email}" vinculado com sucesso como ${papel}!`;
      document.getElementById('admin-membro-email').value = '';

      setTimeout(() => {
        msg.style.display = 'none';
      }, 3000);

      await carregarMembrosDaEmissoraSelecionada();

    } catch (err) {
      msg.style.background = 'rgba(239, 68, 68, 0.15)';
      msg.style.color = '#f87171';
      msg.textContent = `Erro ao salvar: ${err.message}`;
    }
  }

  function abrirModal() {
    renderModal();
    const modal = document.getElementById('modal-admin-painel');
    if (modal) {
      modal.style.display = 'flex';
      alternarAbaPrincipal('emissoras');
    }
  }

  function fecharModal() {
    const modal = document.getElementById('modal-admin-painel');
    if (modal) modal.style.display = 'none';
  }

  return {
    init: function (supabaseClient, currentUser) {
      _supabase = supabaseClient;
      _user = currentUser;
      renderModal();
      atualizarVisibilidadeCardHub();
    },
    atualizarBotao: atualizarVisibilidadeCardHub,
    atualizarCard: atualizarVisibilidadeCardHub,
    abrir: abrirModal,
    fechar: fecharModal
  };
});

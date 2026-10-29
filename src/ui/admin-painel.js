/**
 * admin-painel.js
 * Painel Administrativo para cadastro, edição de emissoras e gestão de equipe.
 */
(function (window) {
  'use strict';

  let _supabase = null;
  let _user = null;

  function obterEmissoraAtivaId() {
    if (window.EmissoraContext && typeof window.EmissoraContext.getEmissoraAtivaId === 'function') {
      return window.EmissoraContext.getEmissoraAtivaId();
    }
    const sel = document.getElementById('select-emissora');
    return sel ? sel.value : null;
  }

  function obterEmissoraAtivaNome() {
    const sel = document.getElementById('select-emissora');
    if (sel && sel.selectedOptions && sel.selectedOptions[0]) {
      return sel.selectedOptions[0].text;
    }
    return 'Emissora';
  }

  async function atualizarVisibilidadeCardHub() {
    const cardHub = (document.getElementById('hub-card-admin') || document.getElementById('card-hub-admin'));
    if (!_supabase || !_user) {
      if (cardHub) cardHub.style.display = 'none';
      return;
    }

    try {
      const { data, error } = await _supabase
        .from('usuarios_emissoras')
        .select('emissora_id')
        .eq('usuario_id', _user.id)
        .eq('papel', 'admin')
        .eq('ativo', true);

      const ehAdmin = !error && data && data.length > 0;
      if (cardHub) {
        cardHub.style.display = ehAdmin ? 'flex' : 'none';
      }
    } catch (err) {
      console.warn('[AdminPainel] Erro ao verificar papel admin:', err);
      if (cardHub) cardHub.style.display = 'none';
    }
  }

  function renderModal() {
    if (document.getElementById('modal-admin-painel')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-admin-painel';
    modal.style.cssText = [
      'display: none',
      'position: fixed',
      'inset: 0',
      'z-index: 10000',
      'background: rgba(0,0,0,0.65)',
      'align-items: center',
      'justify-content: center',
      'backdrop-filter: blur(2px)',
      'font-family: inherit'
    ].join(';') + ';';

    modal.innerHTML = `
      <div style="background: #1e293b; color: #f8fafc; width: 92%; max-width: 620px;
                  border-radius: 12px; padding: 22px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
                  border: 1px solid #334155; max-height: 88vh; overflow-y: auto;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h3 style="margin: 0; font-size: 1.2rem;">Painel de Administração</h3>
            <span id="admin-subtitulo-emissora" style="font-size: 0.82rem; color: #94a3b8;"></span>
          </div>
          <button id="admin-btn-fechar" style="background: none; border: none; font-size: 1.4rem; color: #94a3b8; cursor: pointer;">&times;</button>
        </div>

        <div style="display: flex; gap: 8px; border-bottom: 1px solid #334155; margin-bottom: 18px;">
          <button id="admin-tab-membros" style="padding: 8px 14px; background: none; border: none; border-bottom: 2px solid #38bdf8; color: #38bdf8; font-weight: 600; cursor: pointer; font-size: 0.9rem;">Equipe da Emissora</button>
          <button id="admin-tab-editar" style="padding: 8px 14px; background: none; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.9rem;">⚙️ Dados da Emissora</button>
          <button id="admin-tab-nova" style="padding: 8px 14px; background: none; border: none; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 0.9rem;">+ Nova Emissora</button>
        </div>

        <!-- ABA 1: MEMBROS -->
        <div id="admin-painel-membros">
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

        <!-- ABA 2: EDITAR DADOS DA EMISSORA -->
        <div id="admin-painel-editar" style="display: none;">
          <form id="admin-form-editar" style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.8rem; margin-bottom: 4px; color: #94a3b8;">Nome da Emissora *</label>
              <input type="text" id="admin-editar-nome" required placeholder="Nome da emissora" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 0.85rem;">
            </div>

            <div style="display: flex; gap: 10px;">
              <div style="flex: 2;">
                <label style="display: block; font-size: 0.8rem; margin-bottom: 4px; color: #94a3b8;">Slug (identificador fixo)</label>
                <input type="text" id="admin-editar-slug" disabled style="width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: #94a3b8; font-size: 0.85rem; cursor: not-allowed;">
              </div>
              <div style="flex: 1;">
                <label style="display: block; font-size: 0.8rem; margin-bottom: 4px; color: #94a3b8;">Cor de Destaque</label>
                <input type="color" id="admin-editar-cor" value="#0066cc" style="width: 100%; height: 35px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; cursor: pointer;">
              </div>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; margin-bottom: 4px; color: #94a3b8;">URL da Logomarca (opcional)</label>
              <input type="url" id="admin-editar-logo" placeholder="https://exemplo.com/logo.png" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 0.85rem;">
            </div>

            <button type="submit" style="background: #2563eb; color: #fff; border: none; padding: 9px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.9rem; margin-top: 4px;">Salvar Alterações</button>
            <p id="admin-msg-editar" style="margin: 4px 0 0 0; font-size: 0.8rem;"></p>
          </form>
        </div>

        <!-- ABA 3: NOVA EMISSORA -->
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

      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('admin-btn-fechar').onclick = fecharModal;
    modal.onclick = (e) => { if (e.target === modal) fecharModal(); };

    document.getElementById('admin-tab-membros').onclick = () => alternarAba('membros');
    document.getElementById('admin-tab-editar').onclick = () => alternarAba('editar');
    document.getElementById('admin-tab-nova').onclick = () => alternarAba('nova');

    document.getElementById('admin-btn-salvar-membro').onclick = salvarMembro;
    document.getElementById('admin-form-editar').onsubmit = (e) => {
      e.preventDefault();
      salvarDadosEmissora();
    };
    document.getElementById('admin-form-nova').onsubmit = (e) => {
      e.preventDefault();
      criarEmissora();
    };
  }

  function alternarAba(aba) {
    const tabM = document.getElementById('admin-tab-membros');
    const tabE = document.getElementById('admin-tab-editar');
    const tabN = document.getElementById('admin-tab-nova');
    const pM = document.getElementById('admin-painel-membros');
    const pE = document.getElementById('admin-painel-editar');
    const pN = document.getElementById('admin-painel-nova');

    [tabM, tabE, tabN].forEach((t) => {
      if (t) {
        t.style.borderBottom = 'none';
        t.style.color = '#94a3b8;'
      }
    });
    [pM, pE, pN].forEach((p) => {
      if (p) p.style.display = 'none';
    });

    if (aba === 'membros') {
      tabM.style.borderBottom = '2px solid #38bdf8';
      tabM.style.color = '#38bdf8';
      pM.style.display = 'block';
      carregarMembros();
    } else if (aba === 'editar') {
      tabE.style.borderBottom = '2px solid #3b82f6';
      tabE.style.color = '#3b82f6';
      pE.style.display = 'block';
      carregarDadosEmissora();
    } else if (aba === 'nova') {
      tabN.style.borderBottom = '2px solid #10b981';
      tabN.style.color = '#10b981';
      pN.style.display = 'block';
    }
  }

  function abrirModal() {
    renderModal();
    const modal = document.getElementById('modal-admin-painel');
    const subtitulo = document.getElementById('admin-subtitulo-emissora');
    if (subtitulo) {
      subtitulo.textContent = 'Emissora ativa: ' + obterEmissoraAtivaNome();
    }
    if (modal) {
      modal.style.display = 'flex';
      alternarAba('membros');
    }
  }

  function fecharModal() {
    const modal = document.getElementById('modal-admin-painel');
    if (modal) modal.style.display = 'none';
  }

  async function carregarMembros() {
    const corpo = document.getElementById('admin-corpo-lista-membros');
    const emissoraId = obterEmissoraAtivaId();
    if (!corpo || !emissoraId || !_supabase) return;

    corpo.innerHTML = '<p style="padding: 12px; color: #94a3b8; margin: 0; font-size: 0.85rem;">Carregando membros...</p>';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_listar_membros', {
        p_emissora_id: emissoraId
      });

      if (error) {
        corpo.innerHTML = `<p style="padding: 12px; color: #f87171; margin: 0; font-size: 0.85rem;">Erro: ${escapeHtml(error.message)}</p>`;
        return;
      }

      if (!data || data.length === 0) {
        corpo.innerHTML = '<p style="padding: 12px; color: #94a3b8; margin: 0; font-size: 0.85rem;">Nenhum membro cadastrado.</p>';
        return;
      }

      let html = '<div style="display: flex; flex-direction: column;">';
      data.forEach((m) => {
        const papelCores = {
          admin: 'background: #0284c7; color: #fff;',
          operador: 'background: #334155; color: #cbd5e1;',
          leitor: 'background: #1e293b; color: #94a3b8;'
        };
        const badgeEstilo = papelCores[m.papel] || papelCores.operador;

        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #1e293b;">
            <div>
              <div style="font-size: 0.85rem; font-weight: 500; color: #f1f5f9;">${escapeHtml(m.email)}</div>
              <div style="font-size: 0.75rem; color: #64748b;">Adicionado em: ${new Date(m.created_at).toLocaleDateString('pt-BR')}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.72rem; padding: 3px 8px; border-radius: 9999px; text-transform: uppercase; font-weight: 600; ${badgeEstilo}">${m.papel}</span>
              <button class="admin-remover-membro-btn" data-uid="${m.usuario_id}" data-email="${escapeHtml(m.email)}" style="background: none; border: none; color: #ef4444; font-size: 0.8rem; cursor: pointer; padding: 4px 6px;">Remover</button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      corpo.innerHTML = html;

      corpo.querySelectorAll('.admin-remover-membro-btn').forEach((b) => {
        b.onclick = () => removerMembro(b.getAttribute('data-uid'), b.getAttribute('data-email'));
      });
    } catch (err) {
      corpo.innerHTML = `<p style="padding: 12px; color: #f87171; margin: 0; font-size: 0.85rem;">Erro: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function carregarDadosEmissora() {
    const emissoraId = obterEmissoraAtivaId();
    const msg = document.getElementById('admin-msg-editar');
    if (!emissoraId || !_supabase) return;

    if (msg) msg.textContent = 'Carregando dados da emissora...';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_obter_emissora', {
        p_emissora_id: emissoraId
      });

      if (error) {
        if (msg) {
          msg.style.color = '#f87171';
          msg.textContent = 'Erro ao buscar dados: ' + error.message;
        }
        return;
      }

      if (data) {
        const nomeInput = document.getElementById('admin-editar-nome');
        const slugInput = document.getElementById('admin-editar-slug');
        const corInput = document.getElementById('admin-editar-cor');
        const logoInput = document.getElementById('admin-editar-logo');

        if (nomeInput) nomeInput.value = data.nome || '';
        if (slugInput) slugInput.value = data.slug || '';
        if (corInput) corInput.value = data.cor_primaria || '#0066cc';
        if (logoInput) logoInput.value = data.logo_url || '';
        if (msg) msg.textContent = '';
      }
    } catch (err) {
      if (msg) {
        msg.style.color = '#f87171';
        msg.textContent = 'Erro: ' + err.message;
      }
    }
  }

  async function salvarDadosEmissora() {
    const emissoraId = obterEmissoraAtivaId();
    const nome = (document.getElementById('admin-editar-nome').value || '').trim();
    const cor = document.getElementById('admin-editar-cor').value;
    const logo = (document.getElementById('admin-editar-logo').value || '').trim();
    const msg = document.getElementById('admin-msg-editar');

    if (!emissoraId || !nome || !_supabase) return;

    msg.style.color = '#38bdf8';
    msg.textContent = 'Salvando alterações...';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_atualizar_emissora', {
        p_emissora_id: emissoraId,
        p_nome: nome,
        p_cor: cor,
        p_logo_url: logo || null
      });

      if (error) {
        msg.style.color = '#f87171';
        msg.textContent = 'Erro: ' + error.message;
        return;
      }

      msg.style.color = '#10b981';
      msg.textContent = 'Emissora atualizada com sucesso!';

      const sel = document.getElementById('select-emissora');
      if (sel && sel.selectedOptions && sel.selectedOptions[0]) {
        sel.selectedOptions[0].text = nome;
      }
      const subtitulo = document.getElementById('admin-subtitulo-emissora');
      if (subtitulo) {
        subtitulo.textContent = 'Emissora ativa: ' + nome;
      }
    } catch (err) {
      msg.style.color = '#f87171';
      msg.textContent = 'Erro: ' + err.message;
    }
  }

  async function salvarMembro() {
    const emailInput = document.getElementById('admin-email-membro');
    const papelSelect = document.getElementById('admin-papel-membro');
    const msg = document.getElementById('admin-msg-membro');
    const emissoraId = obterEmissoraAtivaId();

    const email = (emailInput.value || '').trim();
    const papel = papelSelect.value;

    if (!email || !emissoraId || !_supabase) return;

    msg.style.color = '#38bdf8';
    msg.textContent = 'Vinculando...';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_salvar_membro', {
        p_emissora_id: emissoraId,
        p_email: email,
        p_papel: papel
      });

      if (error) {
        msg.style.color = '#f87171';
        msg.textContent = 'Erro: ' + error.message;
        return;
      }

      msg.style.color = '#10b981';
      msg.textContent = 'Membro vinculado com sucesso!';
      emailInput.value = '';
      carregarMembros();
    } catch (err) {
      msg.style.color = '#f87171';
      msg.textContent = 'Erro: ' + err.message;
    }
  }

  async function removerMembro(uid, email) {
    if (!confirm('Deseja realmente remover o acesso deste membro a esta emissora?')) return;

    const emissoraId = obterEmissoraAtivaId();
    if (!emissoraId || !uid || !_supabase) return;

    try {
      const { error } = await _supabase.rpc('fn_admin_remover_membro', {
        p_emissora_id: emissoraId,
        p_usuario_id: uid
      });

      if (error) {
        alert('Erro ao remover: ' + error.message);
        return;
      }

      carregarMembros();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  }

  async function criarEmissora() {
    const nome = (document.getElementById('admin-nova-nome').value || '').trim();
    const slug = (document.getElementById('admin-nova-slug').value || '').trim();
    const cor = document.getElementById('admin-nova-cor').value;
    const msg = document.getElementById('admin-msg-nova');

    if (!nome || !_supabase) return;

    msg.style.color = '#38bdf8';
    msg.textContent = 'Criando emissora...';

    try {
      const { data, error } = await _supabase.rpc('fn_admin_criar_emissora', {
        p_nome: nome,
        p_slug: slug || null,
        p_cor: cor
      });

      if (error) {
        msg.style.color = '#f87171';
        msg.textContent = 'Erro: ' + error.message;
        return;
      }

      msg.style.color = '#10b981';
      msg.textContent = `Emissora "${nome}" criada! Recarregando...`;
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      msg.style.color = '#f87171';
      msg.textContent = 'Erro: ' + err.message;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.AdminPainel = {
    init: function (supabaseClient, currentUser) {
      _supabase = supabaseClient;
      _user = currentUser;

      const cardHub = (document.getElementById('hub-card-admin') || document.getElementById('card-hub-admin'));
      if (cardHub) {
        cardHub.onclick = () => abrirModal();
      }
      atualizarVisibilidadeCardHub();
    },
    abrir: abrirModal,
    atualizarVisibilidade: atualizarVisibilidadeCardHub,
    atualizarBotao: atualizarVisibilidadeCardHub
  };
})(window);
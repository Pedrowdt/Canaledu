// =====================================================
// BANCO MANAGER — Gerenciador de Peças e Programas
// Roteiro Canal Educação · V3.4.5
// GNU GPL v3 · Canal Educação / MEC · 2026
//
// Responsável por:
//  - Importar peças via JSON ou XLSX
//  - Importar programas via JSON ou XLSX
//  - Exportar peças e programas como JSON ou XLSX
//  - Excluir itens individuais ou em massa
//  - Confirmar antes de operações destrutivas
// =====================================================

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna a data atual no formato YYYY-MM-DD, usada para nomear arquivos exportados.
 */
function _bmTodayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Converte uma fração decimal do dia (formato Excel) para string "HH:MM:SS".
 * Caso o valor não seja numérico, retorna o próprio valor como string.
 * @param {*} v - Valor da célula Excel.
 * @returns {string} Tempo formatado como "HH:MM:SS".
 */
function _bmExcelTimeToHMS(v) {
  if (v == null || v === '') return '00:01:00';
  // Se for número, é fração do dia (ex: 0.5 = 12:00:00)
  if (typeof v === 'number') {
    const secs = Math.round(v * 86400);
    const hh = String(Math.floor(secs / 3600)).padStart(2, '0');
    const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  // Se for string no formato HH:MM:SS já está bom
  const s = String(v).trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  // Tenta converter número como string
  const n = parseFloat(s);
  if (!isNaN(n)) return _bmExcelTimeToHMS(n);
  return '00:01:00';
}

/**
 * Detecta os índices de colunas de uma linha de cabeçalho XLSX
 * buscando por palavras-chave em cada célula (case-insensitive).
 * @param {string[]} headers - Array com os cabeçalhos normalizados (maiúsculos).
 * @returns {object} Mapa { code, desc, tempo, type, val, obs, cat } → índice ou -1.
 */
function _bmDetectCols(headers) {
  const fi = (tests) => headers.findIndex(h => tests.some(t => h.includes(t)));
  return {
    code:  fi(['CODE', 'COD', 'CÓDIGO']),
    desc:  fi(['DESC', 'NOME', 'ESPELHO', 'TITULO', 'TÍTULO']),
    tempo: fi(['TEMPO', 'DUR', 'DURAÇÃO']),
    type:  fi(['TYPE', 'TIPO']),
    val:   fi(['VALID', 'VALIDADE']),
    obs:   fi(['OBS', 'OBSERV']),
    cat:   fi(['CAT', 'CATEG']),
    midia: fi(['MIDIA', 'MÍDIA', 'MEDIA']),
  };
}

/**
 * Baixa um Blob como arquivo para o usuário.
 * @param {Blob} blob - Conteúdo do arquivo.
 * @param {string} filename - Nome do arquivo a ser salvo.
 */
function _bmDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoga o URL após pequeno delay para garantir que o download iniciou
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTAÇÃO DE PEÇAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ponto de entrada para importar peças do banco via JSON ou XLSX.
 * Chamado pelo input[type=file] do painel "Banco de Peças".
 * @param {Event} e - Evento de change do input file.
 */
function importBancoManager(e) {
  const file = e.target.files[0];
  if (!file) return;
  // Limpa o input para permitir reimportar o mesmo arquivo
  e.target.value = '';

  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'json') {
    _bmImportPecasJSON(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    _bmImportPecasXLSX(file);
  } else {
    // Informa formato não suportado sem lançar exceção
    if (typeof toast === 'function') toast('Formato não suportado — use .xlsx ou .json', 'error');
  }
}

/**
 * Importa peças a partir de um arquivo JSON.
 * Aceita array direto ou objeto { pecas: [...] }.
 * Itens com code já existente no banco são ignorados (merge).
 * @param {File} file - Arquivo JSON selecionado pelo usuário.
 */
function _bmImportPecasJSON(file) {
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      // Aceita tanto array puro quanto envelope { pecas: [...] }
      const arr = Array.isArray(data) ? data : (data.pecas || []);
      if (!arr.length) {
        if (typeof toast === 'function') toast('Nenhuma peça encontrada no JSON', 'error');
        return;
      }

      // Índice dos codes já existentes para evitar duplicatas
      const existing = new Set(state.pecas.map(p => p.code));
      let added = 0, skipped = 0;

      arr.forEach(function(p) {
        if (!p.code || !p.descricao) return; // Ignora itens inválidos
        if (existing.has(String(p.code))) {
          skipped++;
          return;
        }
        // Sanitiza texto removendo caracteres problemáticos (́ ` ~ ^)
        const desc = (typeof sanitizeText === 'function') ? sanitizeText(p.descricao) : p.descricao;
        const obs  = (typeof sanitizeText === 'function') ? sanitizeText(p.obs || '') : (p.obs || '');
        state.pecas.push({
          code:      String(p.code),
          descricao: desc,
          tempo:     p.tempo     || '00:01:00',
          midia:     p.midia     || '0OMN',
          type:      p.type      || 'EVNH',
          validade:  p.validade  || '',
          obs:       obs,
          categoria: p.categoria || 'IMPORTADO',
        });
        existing.add(String(p.code));
        added++;
      });

      // Persiste e re-renderiza os painéis
      if (typeof saveState === 'function') saveState();
      if (typeof renderPecasSidebar === 'function') renderPecasSidebar();
      if (typeof renderPecasPanel === 'function') renderPecasPanel();
      if (typeof toast === 'function') {
        toast(`✓ ${added} peças importadas do JSON (${skipped} ignoradas — já existiam)`, 'success');
      }
    } catch(err) {
      if (typeof toast === 'function') toast('Erro ao ler o JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

/**
 * Importa peças a partir de um arquivo XLSX.
 * Detecta automaticamente as colunas por cabeçalho (linha 1).
 * Colunas esperadas: CODE, DESCRIÇÃO, TEMPO, TYPE, VALIDADE, OBS, CATEGORIA.
 * Itens com code já existente no banco são ignorados (merge).
 * @param {File} file - Arquivo XLSX selecionado pelo usuário.
 */
function _bmImportPecasXLSX(file) {
  if (!window.XLSX) {
    if (typeof toast === 'function') toast('SheetJS (XLSX) não carregado', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb   = window.XLSX.read(ev.target.result, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]]; // Usa a primeira aba
      // raw:false converte datas e frações Excel para strings quando possível
      const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
      if (rows.length < 2) {
        if (typeof toast === 'function') toast('Planilha vazia ou sem dados', 'error');
        return;
      }

      // Normaliza cabeçalhos para maiúsculas para detecção robusta
      const headers = rows[0].map(h => String(h || '').trim().toUpperCase());
      const ci = _bmDetectCols(headers);

      if (ci.code < 0 || ci.desc < 0) {
        if (typeof toast === 'function') {
          toast('Planilha: colunas CODE e DESCRIÇÃO não encontradas na linha 1', 'error');
        }
        return;
      }

      const existing = new Set(state.pecas.map(p => p.code));
      let added = 0, skipped = 0;

      // Percorre todas as linhas de dados (a partir da segunda linha)
      for (let i = 1; i < rows.length; i++) {
        const r    = rows[i];
        const code = String(r[ci.code] || '').trim();
        const desc = String(r[ci.desc] || '').trim();
        if (!code || !desc) continue; // Ignora linhas em branco

        if (existing.has(code)) { skipped++; continue; }

        // Converte o tempo (pode ser fração decimal do Excel ou "HH:MM:SS")
        const tempoRaw = ci.tempo >= 0 ? r[ci.tempo] : '00:01:00';
        const tempo = _bmExcelTimeToHMS(tempoRaw);

        // Sanitiza campos de texto livre
        const desc2 = (typeof sanitizeText === 'function') ? sanitizeText(desc) : desc;
        const obs2  = ci.obs >= 0
          ? ((typeof sanitizeText === 'function') ? sanitizeText(String(r[ci.obs] || '')) : String(r[ci.obs] || ''))
          : '';

        state.pecas.push({
          code,
          descricao: desc2,
          tempo,
          midia:    ci.midia >= 0 ? String(r[ci.midia] || '0OMN').trim() : '0OMN',
          type:     ci.type  >= 0 ? String(r[ci.type]  || 'EVNH').trim() : 'EVNH',
          validade: ci.val   >= 0 ? String(r[ci.val]   || '').trim()     : '',
          obs:      obs2,
          categoria: ci.cat >= 0 ? String(r[ci.cat] || '').trim() : 'IMPORTADO',
        });
        existing.add(code);
        added++;
      }

      if (typeof saveState === 'function') saveState();
      if (typeof renderPecasSidebar === 'function') renderPecasSidebar();
      if (typeof renderPecasPanel === 'function') renderPecasPanel();
      if (typeof toast === 'function') {
        toast(`✓ ${added} peças importadas do XLSX (${skipped} ignoradas — já existiam)`, 'success');
      }
    } catch(err) {
      if (typeof toast === 'function') toast('Erro ao ler o XLSX: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTAÇÃO DE PROGRAMAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ponto de entrada para importar programas via JSON ou XLSX.
 * Chamado pelo input[type=file] do painel "Programas".
 * @param {Event} e - Evento de change do input file.
 */
function importProgramasManager(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'json') {
    _bmImportProgramasJSON(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    _bmImportProgramasXLSX(file);
  } else {
    if (typeof toast === 'function') toast('Formato não suportado — use .xlsx ou .json', 'error');
  }
}

/**
 * Importa programas de um arquivo JSON.
 * Aceita array direto ou objeto { programas: [...] }.
 * Itens com code já existente são ignorados (merge).
 * @param {File} file - Arquivo JSON.
 */
function _bmImportProgramasJSON(file) {
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      // Aceita array ou envelope { programas: [...] }
      const arr = Array.isArray(data) ? data : (data.programas || []);
      if (!arr.length) {
        if (typeof toast === 'function') toast('Nenhum programa encontrado no JSON', 'error');
        return;
      }

      const existing = new Set(state.programas.map(p => p.code));
      let added = 0, skipped = 0;

      arr.forEach(function(p) {
        if (!p.code || !p.descricao) return;
        if (existing.has(String(p.code))) { skipped++; return; }

        const desc = (typeof sanitizeText === 'function') ? sanitizeText(p.descricao) : p.descricao;
        state.programas.push({
          code:      String(p.code),
          descricao: desc,
          tempo:     p.tempo || '00:30:00',
          midia:     p.midia || '0OMN',
          type:      p.type  || 'RPRO',
        });
        existing.add(String(p.code));
        added++;
      });

      if (typeof saveState === 'function') saveState();
      if (typeof renderProgramas === 'function') renderProgramas();
      if (typeof toast === 'function') {
        toast(`✓ ${added} programas importados do JSON (${skipped} ignorados — já existiam)`, 'success');
      }
    } catch(err) {
      if (typeof toast === 'function') toast('Erro ao ler o JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

/**
 * Importa programas de um arquivo XLSX.
 * Detecta colunas automaticamente pela linha de cabeçalho.
 * Colunas mínimas: CODE, DESCRIÇÃO/NOME, TEMPO.
 * @param {File} file - Arquivo XLSX.
 */
function _bmImportProgramasXLSX(file) {
  if (!window.XLSX) {
    if (typeof toast === 'function') toast('SheetJS (XLSX) não carregado', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb   = window.XLSX.read(ev.target.result, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
      if (rows.length < 2) {
        if (typeof toast === 'function') toast('Planilha vazia ou sem dados', 'error');
        return;
      }

      const headers = rows[0].map(h => String(h || '').trim().toUpperCase());
      const ci = _bmDetectCols(headers);

      if (ci.code < 0 || ci.desc < 0) {
        if (typeof toast === 'function') {
          toast('Planilha: colunas CODE e DESCRIÇÃO não encontradas na linha 1', 'error');
        }
        return;
      }

      const existing = new Set(state.programas.map(p => p.code));
      let added = 0, skipped = 0;

      for (let i = 1; i < rows.length; i++) {
        const r    = rows[i];
        const code = String(r[ci.code] || '').trim();
        const desc = String(r[ci.desc] || '').trim();
        if (!code || !desc) continue;
        if (existing.has(code)) { skipped++; continue; }

        const tempoRaw = ci.tempo >= 0 ? r[ci.tempo] : '00:30:00';
        const tempo = _bmExcelTimeToHMS(tempoRaw) || '00:30:00';
        const desc2 = (typeof sanitizeText === 'function') ? sanitizeText(desc) : desc;

        state.programas.push({
          code,
          descricao: desc2,
          tempo,
          midia: ci.midia >= 0 ? String(r[ci.midia] || '0OMN').trim() : '0OMN',
          type:  ci.type  >= 0 ? String(r[ci.type]  || 'RPRO').trim() : 'RPRO',
        });
        existing.add(code);
        added++;
      }

      if (typeof saveState === 'function') saveState();
      if (typeof renderProgramas === 'function') renderProgramas();
      if (typeof toast === 'function') {
        toast(`✓ ${added} programas importados do XLSX (${skipped} ignorados — já existiam)`, 'success');
      }
    } catch(err) {
      if (typeof toast === 'function') toast('Erro ao ler o XLSX: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAÇÃO DE PROGRAMAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exporta todos os programas do banco como arquivo .xlsx.
 * Colunas: CODE, DESCRIÇÃO, TEMPO, TYPE, MÍDIA.
 */
function exportProgramasXLSX() {
  if (!window.XLSX) { if (typeof toast === 'function') toast('SheetJS não carregado', 'error'); return; }
  if (!state.programas || !state.programas.length) {
    if (typeof toast === 'function') toast('Banco de programas vazio', 'error');
    return;
  }

  // Monta os dados no formato de matriz (cabeçalho + linhas)
  const wsData = [
    ['CODE', 'DESCRIÇÃO', 'TEMPO', 'TYPE', 'MÍDIA'],
    ...state.programas.map(p => [p.code, p.descricao, p.tempo, p.type || 'RPRO', p.midia || '0OMN']),
  ];

  const ws  = window.XLSX.utils.aoa_to_sheet(wsData);
  const wb  = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Programas');

  // Gera o arquivo XLSX como array de bytes e inicia o download
  const buf  = window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  _bmDownload(new Blob([buf], { type: 'application/octet-stream' }), `programas-${_bmTodayStr()}.xlsx`);
  if (typeof toast === 'function') toast(`↓ ${state.programas.length} programas exportados como XLSX`, 'success');
}

/**
 * Exporta todos os programas do banco como arquivo .json.
 */
function exportProgramasJSON() {
  if (!state.programas || !state.programas.length) {
    if (typeof toast === 'function') toast('Banco de programas vazio', 'error');
    return;
  }
  const json = JSON.stringify(state.programas, null, 2);
  _bmDownload(new Blob([json], { type: 'application/json' }), `programas-${_bmTodayStr()}.json`);
  if (typeof toast === 'function') toast(`↓ ${state.programas.length} programas exportados como JSON`, 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCLUSÃO DE PEÇAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exclui uma única peça do banco pelo seu code.
 * Solicita confirmação ao usuário antes de excluir.
 * @param {string} code - Code da peça a ser removida.
 */
function deletePecaByCode(code) {
  const peca = state.pecas.find(p => p.code === code);
  if (!peca) {
    if (typeof toast === 'function') toast(`Peça ${code} não encontrada`, 'error');
    return;
  }
  // Pede confirmação com informações da peça para evitar exclusões acidentais
  const confirmMsg = `Excluir peça?\n\nCODE: ${peca.code}\n${peca.descricao}\n\nEssa ação não pode ser desfeita.`;
  if (!confirm(confirmMsg)) return;

  // Remove a peça do array pelo code
  state.pecas = state.pecas.filter(p => p.code !== code);
  if (typeof saveState === 'function') saveState();
  if (typeof renderPecasSidebar === 'function') renderPecasSidebar();
  if (typeof renderPecasPanel === 'function') renderPecasPanel();
  if (typeof toast === 'function') toast(`🗑 Peça ${code} excluída`, 'success');
}

/**
 * Exclui todas as peças cuja categoria corresponde ao filtro atual de busca,
 * ou todas as peças se nenhuma categoria estiver filtrada.
 * Pede confirmação detalhada antes de proceder.
 */
function deleteAllPecasFiltradas() {
  // Descobre o texto atual do filtro de busca do painel de peças
  const searchEl = document.getElementById('banco-search');
  const typeEl   = document.getElementById('banco-type-filter');
  const search   = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const typeF    = typeEl   ? typeEl.value.trim()                 : '';

  // Aplica o mesmo filtro que renderPecasPanel usa
  const alvo = state.pecas.filter(function(p) {
    const matchSearch = !search ||
      p.code.toLowerCase().includes(search) ||
      p.descricao.toLowerCase().includes(search) ||
      (p.categoria || '').toLowerCase().includes(search);
    const matchType = !typeF || p.type === typeF;
    return matchSearch && matchType;
  });

  if (!alvo.length) {
    if (typeof toast === 'function') toast('Nenhuma peça encontrada para excluir', 'error');
    return;
  }

  const descFiltro = search ? `filtro "${search}"` : (typeF ? `tipo "${typeF}"` : 'TODAS as peças');
  const msg = `Excluir ${alvo.length} peça(s) do banco (${descFiltro})?\n\nEssa ação NÃO PODE ser desfeita.`;
  if (!confirm(msg)) return;

  // Mantém somente as peças que não estão no conjunto a excluir
  const alvoCodes = new Set(alvo.map(p => p.code));
  state.pecas = state.pecas.filter(p => !alvoCodes.has(p.code));
  if (typeof saveState === 'function') saveState();
  if (typeof renderPecasSidebar === 'function') renderPecasSidebar();
  if (typeof renderPecasPanel === 'function') renderPecasPanel();
  if (typeof toast === 'function') toast(`🗑 ${alvo.length} peças excluídas`, 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCLUSÃO DE PROGRAMAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exclui um único programa do banco pelo seu code.
 * Solicita confirmação antes de excluir.
 * @param {string} code - Code do programa a ser removido.
 */
function deletePrograma(code) {
  const prog = state.programas.find(p => p.code === code);
  if (!prog) {
    if (typeof toast === 'function') toast(`Programa ${code} não encontrado`, 'error');
    return;
  }
  const msg = `Excluir programa?\n\nCODE: ${prog.code}\n${prog.descricao}\n\nEssa ação não pode ser desfeita.`;
  if (!confirm(msg)) return;

  state.programas = state.programas.filter(p => p.code !== code);
  if (typeof saveState === 'function') saveState();
  if (typeof renderProgramas === 'function') renderProgramas();
  if (typeof toast === 'function') toast(`🗑 Programa ${code} excluído`, 'success');
}

/**
 * Exclui todos os programas que correspondem ao filtro de busca atual,
 * ou todos os programas se não houver filtro.
 * Pede confirmação antes de proceder.
 */
function deleteAllProgramasFiltrados() {
  const searchEl = document.getElementById('prog-search');
  const search   = searchEl ? searchEl.value.trim().toLowerCase() : '';

  // Aplica o mesmo filtro usado em renderProgramas()
  const alvo = state.programas.filter(function(p) {
    if (!search) return true;
    return p.code.toLowerCase().includes(search) ||
           p.descricao.toLowerCase().includes(search);
  });

  if (!alvo.length) {
    if (typeof toast === 'function') toast('Nenhum programa encontrado para excluir', 'error');
    return;
  }

  const descFiltro = search ? `filtro "${search}"` : 'TODOS os programas';
  const msg = `Excluir ${alvo.length} programa(s) (${descFiltro})?\n\nEssa ação NÃO PODE ser desfeita.`;
  if (!confirm(msg)) return;

  const alvoCodes = new Set(alvo.map(p => p.code));
  state.programas = state.programas.filter(p => !alvoCodes.has(p.code));
  if (typeof saveState === 'function') saveState();
  if (typeof renderProgramas === 'function') renderProgramas();
  if (typeof toast === 'function') toast(`🗑 ${alvo.length} programas excluídos`, 'success');
}

/**
 * Restaura o banco de programas ao conteúdo original (INITIAL_PROGRAMAS do data.js).
 * Solicita confirmação dupla pois a operação é irreversível.
 */
function resetProgramasToDefault() {
  if (!confirm('Restaurar banco de programas ao padrão original?\n\nTodas as inclusões/edições serão perdidas.')) return;
  if (typeof PartsStore !== 'undefined' && PartsStore.programas) {
    PartsStore.programas.resetToSeed();
    if (typeof toast === 'function') toast('Banco de programas restaurado ao padrão', 'success');
  } else {
    // Fallback caso o PartsStore não esteja disponível
    if (typeof INITIAL_PROGRAMAS !== 'undefined') {
      state.programas = JSON.parse(JSON.stringify(INITIAL_PROGRAMAS));
      if (typeof saveState === 'function') saveState();
      if (typeof renderProgramas === 'function') renderProgramas();
      if (typeof toast === 'function') toast('Banco de programas restaurado ao padrão', 'success');
    }
  }
}

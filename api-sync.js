// =====================================================
// API SYNC — Sincronização com servidor (opcional)
// Roteiro Canal Educação — versão local (sem servidor)
// GNU GPL v3 · Canal Educação / MEC · 2026
//
// Este arquivo é um stub para uso local (arquivo://).
// Quando o sistema estiver no servidor da intranet,
// substitua por api-sync.js completo do pacote SERVIDOR.
// =====================================================

const API = (() => {
  const IS_SERVER = window.location.protocol !== 'file:';

  if (!IS_SERVER) {
    // Modo local — todas as operações são no-op
    return {
      isServer: false,
      usuario: () => 'local',
      loadRoteiro:      async () => null,
      saveRoteiro:      async () => {},
      listRoteiros:     async () => [],
      loadPecasDia:     async () => null,
      savePecasDia:     async () => {},
      loadGradeDow:     async () => null,
      saveGradeDow:     async () => {},
      loadBancoPecas:   async () => null,
      saveBancoPecas:   async () => {},
      loadBancoProgramas: async () => null,
      saveBancoProgramas: async () => {},
    };
  }

  // Modo servidor — comunicação com API REST
  let _usuario = localStorage.getItem('roteiroUsuario') || '';
  if (!_usuario) {
    _usuario = prompt('Seu nome (identificação no sistema):') || 'usuario';
    localStorage.setItem('roteiroUsuario', _usuario);
  }

  const h = () => ({ 'Content-Type': 'application/json', 'X-Usuario': _usuario });

  async function get(url) {
    try { const r = await fetch(url, { headers: h() }); return r.ok ? r.json() : null; }
    catch { return null; }
  }
  async function put(url, body) {
    try { await fetch(url, { method:'PUT', headers: h(), body: JSON.stringify(body) }); }
    catch(e) { console.warn('API sync:', e); }
  }

  return {
    isServer: true,
    usuario: () => _usuario,
    loadRoteiro:        (k)    => get(`/api/roteiro/${k}`),
    saveRoteiro:        (k,r)  => put(`/api/roteiro/${k}`, { roteiro: r }),
    listRoteiros:       ()     => get('/api/roteiros'),
    loadPecasDia:       (k)    => get(`/api/pecas-dia/${k}`),
    savePecasDia:       (k,p)  => put(`/api/pecas-dia/${k}`, { pecasDia: p }),
    loadGradeDow:       (dow)  => get(`/api/grade/${dow}`),
    saveGradeDow:       (d,g,o)=> put(`/api/grade/${d}`, { grade:g, order:o }),
    loadBancoPecas:     ()     => get('/api/banco/pecas'),
    saveBancoPecas:     (p)    => put('/api/banco/pecas', { pecas:p }),
    loadBancoProgramas: ()     => get('/api/banco/programas'),
    saveBancoProgramas: (p)    => put('/api/banco/programas', { programas:p }),
  };
})();

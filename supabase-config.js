// =====================================================
// CONFIGURAÇÃO DO SUPABASE — usado por cloud-sync.js
// (Roteiro) e por pecas-programas.js (Cadastro de
// Peças e Programas). Preencha uma vez só, aqui.
// =====================================================

// Cole a "Project URL" (só até .supabase.co, SEM nada depois — nem /rest/v1)
const SUPABASE_URL = 'https://ewfewxrioxvnqfwhwbuj.supabase.co';

// Cole a "anon public key"
const SUPABASE_ANON_KEY = 'sb_publishable_BDDWYibO1f7lGuwL1934LA_JuOx-MT6';

// id fixo da linha compartilhada do banco de peças/programas (não precisa mudar)
const WORKSPACE_ID = 'workspace';

function isSupabaseConfigured() {
  return !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_ANON_KEY.includes('SUA-CHAVE');
}

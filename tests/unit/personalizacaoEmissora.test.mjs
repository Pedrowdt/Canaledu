import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import EmissoraContext from '../../src/core/emissoraContext.js';

const adminJs = readFileSync(new URL('../../src/ui/admin-painel.js', import.meta.url), 'utf8');
const cloudSyncJs = readFileSync(new URL('../../cloud-sync.js', import.meta.url), 'utf8');
const pecasJs = readFileSync(new URL('../../pecas-programas.js', import.meta.url), 'utf8');
const gradeJs = readFileSync(new URL('../../grade-editor.js', import.meta.url), 'utf8');
const sql017 = readFileSync(new URL('../../db/017_personalizacao_visual_emissora.sql', import.meta.url), 'utf8');

describe('Personalização Visual por Emissora (Logo e Cores)', () => {
  beforeEach(() => {
    EmissoraContext.setEmissoraAtivaId(null);
  });

  describe('EmissoraContext', () => {
    it('armazena e recupera cor_primaria e logo_url no cache e resolve emissora ativa', () => {
      const lista = [
        { id: 'uuid-tbc', nome: 'TV Brasil Central', slug: 'tbc', cor_primaria: '#10b981', logo_url: 'https://exemplo.com/tbc.png' },
        { id: 'uuid-ce', nome: 'Canal Educação', slug: 'canaledu', cor_primaria: '#0066cc', logo_url: null },
      ];

      const ativa = EmissoraContext.resolverEmissoraAtiva(lista);
      expect(ativa.id).toBe('uuid-tbc');
      expect(ativa.cor_primaria).toBe('#10b981');
      expect(ativa.logo_url).toBe('https://exemplo.com/tbc.png');

      const emissoraAtiva = EmissoraContext.getEmissoraAtiva();
      expect(emissoraAtiva.nome).toBe('TV Brasil Central');
      expect(emissoraAtiva.cor_primaria).toBe('#10b981');
    });

    it('atualiza emissora existente no cache dinamicamente via atualizarEmissoraNoCache', () => {
      const lista = [
        { id: 'uuid-1', nome: 'TV Brasil Central', cor_primaria: '#0066cc', logo_url: null }
      ];
      EmissoraContext.resolverEmissoraAtiva(lista);

      EmissoraContext.atualizarEmissoraNoCache({
        id: 'uuid-1',
        nome: 'TV Brasil Central Oficial',
        cor_primaria: '#10b981',
        logo_url: 'https://exemplo.com/logo-tbc.png'
      });

      const ativa = EmissoraContext.getEmissoraAtiva();
      expect(ativa.nome).toBe('TV Brasil Central Oficial');
      expect(ativa.cor_primaria).toBe('#10b981');
      expect(ativa.logo_url).toBe('https://exemplo.com/logo-tbc.png');
    });
  });

  describe('Painel Admin — Formulários e Ações de Personalização', () => {
    it('painel inclui aba e formulário de personalização de emissora', () => {
      expect(adminJs).toContain('admin-painel-editar');
      expect(adminJs).toContain('Personalizar Identidade da Emissora');
      expect(adminJs).toContain('admin-editar-cor');
      expect(adminJs).toContain('admin-editar-cor-hex');
      expect(adminJs).toContain('admin-editar-logo');
    });

    it('painel possui preview em tempo real com logo e badge da cor de destaque', () => {
      expect(adminJs).toContain('admin-editar-preview-badge');
      expect(adminJs).toContain('admin-editar-preview-img');
      expect(adminJs).toContain('atualizarPreviewEdicao');
    });

    it('lista de emissoras exibe swatch de cor, miniatura de logo e botão de personalizar', () => {
      expect(adminJs).toContain('admin-editar-emissora-btn');
      expect(adminJs).toContain('🎨 Personalizar');
      expect(adminJs).toContain('cor_primaria');
    });

    it('chama RPC fn_admin_atualizar_emissora com parâmetros corretos', () => {
      expect(adminJs).toContain('fn_admin_atualizar_emissora');
      expect(adminJs).toContain('p_emissora_id: id');
      expect(adminJs).toContain('p_cor: cor');
      expect(adminJs).toContain('p_logo_url: logoUrl');
    });
  });

  describe('Reflexo Visual nas Telas (Roteiro, Peças e Grade)', () => {
    it('cloud-sync.js aplica cor_primaria e logo_url da emissora no cabeçalho do Roteiro', () => {
      expect(cloudSyncJs).toContain('emissora.cor_primaria');
      expect(cloudSyncJs).toContain('emissora.logo_url');
      expect(cloudSyncJs).toContain('--emissora-cor-primaria');
      expect(cloudSyncJs).toContain('window.atualizarBrandingEmissora = atualizarBrandingEmissora');
    });

    it('pecas-programas.js renderiza badge de cor da emissora e suporta logo_url', () => {
      expect(pecasJs).toContain('emissora.cor_primaria');
      expect(pecasJs).toContain('emissora.logo_url');
      expect(pecasJs).toContain('window.atualizarBrandingPecas = atualizarBrandingPecas');
    });

    it('grade-editor.js renderiza badge de cor da emissora e suporta logo_url', () => {
      expect(gradeJs).toContain('emissora.cor_primaria');
      expect(gradeJs).toContain('emissora.logo_url');
      expect(gradeJs).toContain('window.atualizarBrandingGrade = atualizarBranding');
    });
  });

  describe('Migration 017 de Personalização Visual', () => {
    it('contém declaração da migration e suporte a p_logo_url em fn_admin_criar_emissora', () => {
      expect(sql017).toContain('017_personalizacao_visual_emissora.sql');
      expect(sql017).toContain('fn_admin_criar_emissora');
      expect(sql017).toContain('p_logo_url text default null');
      expect(sql017).toContain('cor_primaria');
    });
  });
});

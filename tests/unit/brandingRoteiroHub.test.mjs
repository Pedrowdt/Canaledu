import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const pecasHtml = readFileSync(new URL('../../pecas-programas.html', import.meta.url), 'utf8');
const pecasJs = readFileSync(new URL('../../pecas-programas.js', import.meta.url), 'utf8');
const gradeHtml = readFileSync(new URL('../../grade-editor.html', import.meta.url), 'utf8');
const gradeJs = readFileSync(new URL('../../grade-editor.js', import.meta.url), 'utf8');
const adminJs = readFileSync(new URL('../../src/ui/admin-painel.js', import.meta.url), 'utf8');

describe('Identidade Visual RoteiroHub nos cabeçalhos e topbars', () => {
  it('Hub no index.html exibe o logo oficial e subtítulo de navegação', () => {
    expect(indexHtml).toContain('assets/logo-roteirohub-claro.png');
    expect(indexHtml).toContain('class="hub-logo-img"');
    expect(indexHtml).toContain('Programação &amp; Exibição · Escolha o módulo');
  });

  it('Topbar do Roteiro no index.html inclui o ícone da marca junto ao título', () => {
    expect(indexHtml).toContain('class="topbar-brand"');
    expect(indexHtml).toContain('assets/icone-roteirohub.png');
    expect(indexHtml).toContain('id="app-logo-title"');
  });

  it('Peças e Programas possui marca RoteiroHub e título dinâmico por emissora', () => {
    expect(pecasHtml).toContain('assets/icone-roteirohub.png');
    expect(pecasHtml).toContain('ROTEIRO<span style="color:#2f6fe0">HUB</span>');
    expect(pecasHtml).toContain('id="page-module-title"');
    expect(pecasJs).toContain('function atualizarBrandingPecas(emissora)');
    expect(pecasJs).toContain("document.title = 'Peças e Programas · RoteiroHub'");
  });

  it('Confecção de Grade exibe o ícone RoteiroHub e não faz fallback para emissora legada', () => {
    expect(gradeHtml).toContain('assets/icone-roteirohub.png');
    expect(gradeHtml).toContain('ROTEIRO<span style="color:#2f6fe0">HUB</span>');
    expect(gradeHtml).toContain('id="page-brand-title"');
    expect(gradeJs).not.toContain("'CANAL EDUCAÇÃO'");
    expect(gradeJs).toContain("document.title = 'Confecção de Grade · RoteiroHub'");
  });

  it('Painel de Administração inclui o ícone RoteiroHub em seu cabeçalho', () => {
    expect(adminJs).toContain('assets/icone-roteirohub.png');
    expect(adminJs).toContain('Painel de Administração · RoteiroHub');
  });
});

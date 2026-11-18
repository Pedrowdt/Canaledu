import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Layout Responsivo do Editor de Grade (Barra Superior e 7 Dias)', () => {
  const htmlPath = path.resolve('grade-editor.html');
  const jsPath = path.resolve('grade-editor.js');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');

  it('barra de abas (.day-bar) e ações (.day-actions) são responsivas com flex-wrap sem estourar o viewport', () => {
    expect(html).toMatch(/\.day-bar\s*{[^}]*flex-wrap:\s*wrap/);
    expect(html).toMatch(/\.day-actions\s*{[^}]*flex-wrap:\s*wrap/);
    // Preserva botões e IDs essenciais
    expect(html).toContain('id="btn-importar-grade"');
    expect(html).toContain('id="btn-vincular-faixa"');
    expect(html).toContain('id="filter-faixa-acervo"');
    expect(html).toContain('id="modal-vincular-faixa"');
    expect(html).toContain('id="btn-excecoes-grade"');
    expect(html).toContain('id="badge-excecoes-count"');
    expect(html).toContain('salvarGrade()');
  });

  it('container semanal (.week-columns-container) divide os 7 dias fluidamente sem minmax(210px) rígido', () => {
    // Não pode ter minmax(210px) rígido que força mais de 1500px só para as colunas
    expect(html).not.toMatch(/\.week-columns-container\s*{[^}]*repeat\(7,\s*minmax\(210px/);
    // Deve usar minmax(0, 1fr) ou 1fr para dividir a largura em 7 colunas iguais
    expect(html).toMatch(/\.week-columns-container\s*{[^}]*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
  });

  it('acervo lateral (.sidebar-acervo) possui suporte a modo retrátil (collapsed) e botão de alternância', () => {
    expect(html).toContain('class="sidebar-acervo" id="sidebar-acervo"');
    expect(html).toContain('.sidebar-acervo.collapsed');
    expect(html).toContain('toggleSidebarAcervo()');
    expect(js).toContain('window.toggleSidebarAcervo = function');
    expect(js).toContain('grade_sidebar_collapsed');
  });

  it('matriz semanal consolidada (.matrix-grid) distribui as 7 colunas com minmax(0, 1fr)', () => {
    expect(html).toMatch(/\.matrix-grid\s*{[^}]*grid-template-columns:\s*65px\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
  });
});

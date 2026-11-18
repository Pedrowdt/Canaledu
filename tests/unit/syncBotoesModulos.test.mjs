import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Botões de Sincronização e Ações de Status nos Módulos', () => {
  const root = path.resolve(__dirname, '../..');

  it('Roteiro (index.html): possui botão de sincronização manual com chamada ao CloudSync', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(html).toContain('id="btn-sync-topbar"');
    expect(html).toContain('window.CloudSync.sincronizarManualmente()');
    expect(html).toContain('@keyframes sync-spin');
  });

  it('Cadastro (pecas-programas.html): possui botão de sincronização, ativação em lote e filtro de status', () => {
    const html = fs.readFileSync(path.join(root, 'pecas-programas.html'), 'utf8');
    expect(html).toContain('id="btn-sync-pecas"');
    expect(html).toContain('sincronizarCadastroManualmente()');
    expect(html).toContain('id="btn-batch-ativar"');
    expect(html).toContain("executarAcaoLote('ativar')");
    expect(html).toContain('id="filter-status-ativo"');
    expect(html).toContain('id="f-ativo"');
    expect(html).toContain('@keyframes sync-spin');
  });

  it('Cadastro (pecas-programas.js): exporta sincronizarCadastroManualmente e trata ação ativar em lote', () => {
    const js = fs.readFileSync(path.join(root, 'pecas-programas.js'), 'utf8');
    expect(js).toContain('async function sincronizarCadastroManualmente');
    expect(js).toContain("acao === 'ativar'");
    expect(js).toContain('filtroStatusAtivo');
    expect(js).toContain('inativoBadge');
  });

  it('Grade (grade-editor.html): possui botão de sincronização manual', () => {
    const html = fs.readFileSync(path.join(root, 'grade-editor.html'), 'utf8');
    expect(html).toContain('id="btn-sync-grade"');
    expect(html).toContain('window.sincronizarGradeManualmente');
    expect(html).toContain('@keyframes sync-spin');
  });

  it('Grade (grade-editor.js): define window.sincronizarGradeManualmente', () => {
    const js = fs.readFileSync(path.join(root, 'grade-editor.js'), 'utf8');
    expect(js).toContain('window.sincronizarGradeManualmente = async function');
  });
});

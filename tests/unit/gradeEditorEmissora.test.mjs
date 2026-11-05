import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../../grade-editor.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../grade-editor.html', import.meta.url), 'utf8');

describe('Troca de emissora no editor de grade', () => {
  it('liga a troca do seletor a uma função global acessível pelo HTML', () => {
    expect(js).toContain('window.trocarEmissoraGrade = async function (novaId)');
    expect(js).toMatch(/sel\.onchange\s*=\s*\(e\)\s*=>[\s\S]*window\.trocarEmissoraGrade\(e\.target\.value\)/);
    expect(html).not.toContain('onchange="trocarEmissoraGrade(this.value)"');
  });

  it('recarrega a emissora selecionada e limpa o buffer da grade anterior', () => {
    expect(js).toContain('window.EmissoraContext.setEmissoraAtivaId(novaId)');
    expect(js).toContain('blocksByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };');
    expect(js).toContain('await carregarDadosEmissora();');
  });

  it('não deixa o cache local de blocos prevalecer sobre dados remotos da emissora ativa', () => {
    expect(js).toContain('saved.gradeBlocksByDay = null;');
    expect(js).toContain(".eq('emissora_id', emissoraId)");
  });
});

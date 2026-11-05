import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Scroll Unificado da Grade Semanal Completa', () => {
  const htmlPath = path.resolve('grade-editor.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  it('deve conter container unificado .week-scroll-body englobando as colunas da semana', () => {
    expect(html).toContain('class="week-scroll-body" id="week-scroll-body"');
    expect(html).toContain('.week-scroll-body {');
    expect(html).toMatch(/\.week-scroll-body\s*{[^}]*overflow-y:\s*auto/);
    expect(html).toMatch(/\.week-scroll-body\s*{[^}]*overflow-x:\s*auto/);
  });

  it('não deve restringir colunas de dia com max-height nem criar overflow individual por dia', () => {
    // .week-day-slots não pode ter overflow-y: auto isolado
    expect(html).not.toMatch(/\.week-day-slots\s*{[^}]*overflow-y:\s*auto/);
    // .week-day-col não pode ter max-height restritivo que force scroll isolado
    expect(html).not.toMatch(/\.week-day-col\s*{[^}]*max-height:\s*calc\(100vh/);
  });

  it('deve manter o cabeçalho dos dias (.week-day-header) com position: sticky no topo', () => {
    expect(html).toMatch(/\.week-day-header\s*{[^}]*position:\s*sticky/);
    expect(html).toMatch(/\.week-day-header\s*{[^}]*top:\s*0/);
  });
});

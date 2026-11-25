import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const src = fs.readFileSync(path.join(root, 'src/core/gradeRoteiroSyncCore.js'), 'utf8');
function loadSyncCore() {
  const g = {};
  new Function('window', 'globalThis', src).call(g, g, g);
  return g.GradeRoteiroSyncCore;
}

describe('Regressão: sincronizar com a grade não pode dizer "nenhuma grade" quando ela existe', () => {
  it('cloud-sync preserva gradeBlocksByDay e gradePublicadaBlocksByDay ao regravar o localStorage', () => {
    const js = fs.readFileSync(path.join(root, 'cloud-sync.js'), 'utf8');
    expect(js).toMatch(/merged\.gradeBlocksByDay\s*=\s*localRaw\.gradeBlocksByDay/);
    expect(js).toMatch(/merged\.gradePublicadaBlocksByDay\s*=\s*localRaw\.gradePublicadaBlocksByDay/);
    // As atribuições precisam vir antes da gravação de `merged`.
    expect(js.indexOf('merged.gradeBlocksByDay')).toBeLessThan(js.indexOf('gravarLocal(_chaveApp, JSON.stringify(merged))'));
  });

  it('app.js reconstrói blocos a partir de gradeByDay quando o cache de blocos some', () => {
    const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const ini = js.indexOf('function obterGradeParaDataSelecionada');
    const fim = js.indexOf('function montarAcervoParaSync');
    const corpo = js.slice(ini, fim);
    expect(corpo).toContain('gradeToBlocks');
    expect(corpo).toContain("fonte: 'reconstruida_gradeByDay'");
    expect(corpo).toContain('loadGrade(dia)');
    // Fora da vigência continua sem fallback.
    expect(corpo).toMatch(/dentroDaSemana === false\) return/);
  });

  it('selecionarGradeParaData devolve vazio sem blocos (cenário do bug) e fora_da_vigencia fora do período', () => {
    const Core = loadSyncCore();
    const saved = {
      gradePublicadaInfo: { dataInicio: '2026-11-23', dataFim: '2026-11-29' },
      gradeByDay: { 3: { 'PROGRAMA X': '06:00:00' } }
    };
    const dentro = Core.selecionarGradeParaData('2026-11-25', 3, saved);
    expect(dentro.dentroDaSemana).toBe(true);
    expect(dentro.blocks).toEqual([]);
    const fora = Core.selecionarGradeParaData('2026-12-02', 3, saved);
    expect(fora.fonte).toBe('fora_da_vigencia');
  });
});

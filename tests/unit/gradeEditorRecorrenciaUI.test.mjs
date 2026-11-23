import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../../grade-editor.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../../grade-editor.js', import.meta.url), 'utf8');

describe('controles visuais da recorrência na grade', () => {
  it('carrega o núcleo de recorrência e oferece as configurações no editor semanal', () => {
    expect(html).toContain('src/core/gradeRecorrenciaCore.js');
    expect(html).toContain('modal-config-slot');
    expect(html).toContain('modal-filas-episodios');
    expect(js).toContain('abrirConfigSlot');
    expect(js).toContain('renderRecurrenceBadge(d, idx)');
  });

  it('permite configurar horários fixos, inéditos e reprises vinculadas', () => {
    expect(html).toContain('value="fixo"');
    expect(html).toContain('value="inedito"');
    expect(html).toContain('value="reprise"');
    expect(js).toContain('origemReprise={diaSemana:Number(dia),horario}');
  });

  it('expõe edição de episódios/blocos e auditoria de heranças na matriz semanal', () => {
    expect(html).toContain('slot-ep-titulo');
    expect(html).toContain('container-blocos-episodio');
    expect(html).toContain('slot-bloquear-heranca');
    expect(html).toContain('modal-auditoria-grade');
    expect(js).toContain('lerEpisodioDoFormulario');
    expect(js).toContain('aplicarHerancaNaGradeUI');
    expect(js).toContain('validarConsistenciaReprises');
    expect(js).toContain('recurrenceState.slots[getSlotKey(d, idx)]?.episodio');
  });

  it('mantém filas e exceções separadas por emissora e sincronizadas na grade', () => {
    expect(js).toContain('gradeRecorrencia_${userId}_${emissoraId || \'sem-emissora\'}');
    expect(js).toContain('grade_recorrencia: recurrenceState');
    expect(html).toContain('modal-excecoes-data');
    expect(js).toContain('window.GradeRecorrenciaCore.cadastrarExcecao');
    expect(js).toContain('window.GradeRecorrenciaCore.removerExcecao');
  });
});

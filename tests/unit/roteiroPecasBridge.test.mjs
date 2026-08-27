// Normalização de `validade` na ponte Cadastro -> Roteiro.
// Bug original: o cadastro grava AAAA-MM-DD (input[type=date]) e a ponte
// repassava a string crua para o roteiroApp; isExpired() só entendia
// dd/mm/aa(aa), então a peça vencida nunca era marcada como VENCIDA.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../roteiro-pecas-bridge.js', import.meta.url), 'utf8');
function loadBridge() {
  const g = {};
  new Function('window', 'globalThis', src).call(g, g, g);
  return g.RoteiroPecasBridge;
}

describe('RoteiroPecasBridge — validade sempre normalizada para ISO', () => {
  it('validadeToISO converte AAAA-MM-DD, DD/MM/AAAA e DD/MM/AA para AAAA-MM-DD', () => {
    const bridge = loadBridge();
    expect(bridge.validadeToISO('2026-08-04')).toBe('2026-08-04');
    expect(bridge.validadeToISO('04/08/2026')).toBe('2026-08-04');
    expect(bridge.validadeToISO('04/08/26')).toBe('2026-08-04');
  });

  it('normalizarValidades não altera itens sem validade e preserva os demais campos', () => {
    const bridge = loadBridge();
    const out = bridge.normalizarValidades([
      { code: 'A', descricao: 'x', validade: '04/08/26', tempo: '00:00:05' },
      { code: 'B', descricao: 'y' },
    ]);
    expect(out[0]).toEqual({ code: 'A', descricao: 'x', validade: '2026-08-04', tempo: '00:00:05' });
    expect(out[1]).toEqual({ code: 'B', descricao: 'y' });
  });

  it('combinar() normaliza a validade tanto do cadastro remoto quanto do snapshot local', () => {
    const bridge = loadBridge();
    const remotos = [{ code: '1', descricao: 'r', validade: '2026-08-04' }];
    const locais = [{ code: '2', descricao: 'l', validade: '04/08/26', _localOnly: true }];
    const out = bridge.combinar(remotos, locais, {}, 'pecas');
    const byCode = Object.fromEntries(out.map((i) => [i.code, i]));
    expect(byCode['1'].validade).toBe('2026-08-04');
    expect(byCode['2'].validade).toBe('2026-08-04');
  });
});

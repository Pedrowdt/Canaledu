// A versão do sistema ficou presa em 2.2.0 por quatro releases seguidas
// (2.3.0/2.4.1/2.5.0 nunca existiram nos arquivos de versão, só no
// CHANGELOG) porque a automação que deveria manter tudo sincronizado
// (scripts/sync-version.js, referenciada como rodando via
// `.versionrc.json` -> `postbump`) nunca teve esse arquivo de config
// commitado — ou seja, nunca rodou de verdade. Corrigido com o
// .versionrc.json; este teste é a rede de segurança para não regredir:
// falha assim que os três arquivos voltarem a divergir.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

describe('versão consistente entre package.json, version.js e version.txt', () => {
  const pkgVersion = JSON.parse(read('package.json')).version;

  it('version.js declara a mesma versão do package.json', () => {
    const versionJs = read('version.js');
    const match = versionJs.match(/APP_VERSION\s*=\s*"([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match[1]).toBe(pkgVersion);
  });

  it('version.txt declara a mesma versão do package.json', () => {
    const versionTxt = read('version.txt').trim();
    expect(versionTxt).toBe(pkgVersion);
  });

  it('.versionrc.json existe e conecta o bump de versão a scripts/sync-version.js (evita a regressão de novo)', () => {
    const versionrc = JSON.parse(read('.versionrc.json'));
    expect(versionrc.scripts?.postbump || '').toContain('scripts/sync-version.js');
  });
});

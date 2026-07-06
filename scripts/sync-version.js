// Roda automaticamente depois de cada bump de versão (via .versionrc.json → postbump).
// Copia a versão do package.json para version.js, que é o arquivo que o
// index.html carrega para exibir a versão no rodapé do sistema.
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

const content = `// Gerado automaticamente por "npm run release" — não editar à mão.
window.APP_VERSION = ${JSON.stringify(pkg.version)};
window.APP_RELEASED_AT = ${JSON.stringify(new Date().toISOString())};
`;

writeFileSync(new URL('../version.js', import.meta.url), content);
console.log(`version.js atualizado para v${pkg.version}`);

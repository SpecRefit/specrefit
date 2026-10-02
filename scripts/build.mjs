import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist/web', { recursive: true });
const sample = await Promise.all(['petstore.yaml', 'schemas/pet.yaml'].map(async id => ({ id, text: await readFile(`tests/fixtures/${id}`, 'utf8') })));
await build({ entryPoints: { app: 'apps/web/app.ts', worker: 'apps/web/worker.ts' }, outdir: 'dist/web', bundle: true, platform: 'browser', format: 'esm', target: ['es2022'], legalComments: 'eof', plugins: [{ name: 'sample', setup(b) { b.onResolve({ filter: /sample\.json$/ }, () => ({ path: 'sample', namespace: 'sample' })); b.onLoad({ filter: /.*/, namespace: 'sample' }, () => ({ contents: JSON.stringify(sample), loader: 'json' })); } }] });
for (const file of ['index.html', 'styles.css', 'mark.svg']) await copyFile(`apps/web/${file}`, `dist/web/${file}`);
await copyFile('LICENSE', 'dist/web/LICENSE');
await writeFile('dist/web/THIRD_PARTY_NOTICES.txt', `SpecRefit includes yaml 2.9.1 (ISC).\n\n${await readFile('node_modules/yaml/LICENSE', 'utf8')}`);
console.log('Built shared editor and worker in dist/web.');

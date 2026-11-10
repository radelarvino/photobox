import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.js';

const hashOf = (content) => createHash('sha256').update(content).digest('hex').slice(0, 8);

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'photobox-build-'));
  const source = join(root, 'public');
  await mkdir(join(source, 'css'), { recursive: true });
  await mkdir(join(source, 'js'), { recursive: true });
  await mkdir(join(source, 'assets'), { recursive: true });

  await writeFile(join(source, 'index.html'), `<!doctype html>
<html><head>
<link rel="icon" href="assets/icon.svg">
<link rel="stylesheet" href="css/app.css?v=9">
</head><body>
<a href="#atas">Atas</a>
<script type="module" src="js/main.js?v=4"></script>
</body></html>
`);
  await writeFile(
    join(source, 'css', 'app.css'),
    `@font-face{src:url('../assets/font.woff2') format('woff2');}
body{background:url("../assets/icon.svg");}
.hero{background:url("data:image/png;base64,AAAA");}
`,
  );
  await writeFile(join(source, 'js', 'main.js'), `import { nilai } from './dep.js';\nimport './side.js';\nconsole.log(nilai);\n`);
  await writeFile(join(source, 'js', 'dep.js'), `export const nilai = 42;\n`);
  await writeFile(join(source, 'js', 'side.js'), `console.log('samping');\n`);
  await writeFile(join(source, 'assets', 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  await writeFile(join(source, 'assets', 'font.woff2'), Buffer.from('fake-font-bytes'));
  await writeFile(join(source, 'robots.txt'), 'User-agent: *\nDisallow:\n');

  return { root, source, out: join(root, 'dist') };
}

test('build memberi hash, menulis ulang referensi, dan membuat manifest', async () => {
  const fixture = await makeFixture();
  try {
    const result = await build({ sourceDir: fixture.source, outDir: fixture.out });

    const appHash = hashOf(await readFile(join(fixture.source, 'css', 'app.css')));
    const mainHash = hashOf(await readFile(join(fixture.source, 'js', 'main.js')));
    const depHash = hashOf(await readFile(join(fixture.source, 'js', 'dep.js')));
    const fontHash = hashOf(await readFile(join(fixture.source, 'assets', 'font.woff2')));
    const iconHash = hashOf(await readFile(join(fixture.source, 'assets', 'icon.svg')));

    const html = await readFile(join(fixture.out, 'index.html'), 'utf8');
    assert.match(html, new RegExp(`href="css/app\\.${appHash}\\.css"`));
    assert.match(html, new RegExp(`src="js/main\\.${mainHash}\\.js"`));
    assert.match(html, new RegExp(`href="assets/icon\\.${iconHash}\\.svg"`));
    assert.doesNotMatch(html, /\?v=/);
    assert.match(html, /href="#atas"/);

    const css = await readFile(join(fixture.out, `css/app.${appHash}.css`), 'utf8');
    assert.match(css, new RegExp(`url\\(['"]\\.\\./assets/font\\.${fontHash}\\.woff2['"]\\)`));
    assert.match(css, new RegExp(`url\\(['"]\\.\\./assets/icon\\.${iconHash}\\.svg['"]\\)`));
    assert.match(css, /data:image\/png;base64,AAAA/);

    const main = await readFile(join(fixture.out, `js/main.${mainHash}.js`), 'utf8');
    assert.match(main, new RegExp(`from './dep\\.${depHash}\\.js'`));
    const sideHash = hashOf(await readFile(join(fixture.source, 'js', 'side.js')));
    assert.match(main, new RegExp(`import './side\\.${sideHash}\\.js'`));

    assert.equal(await readFile(join(fixture.out, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow:\n');
    assert.equal(await readFile(join(fixture.out, `assets/font.${fontHash}.woff2`), 'utf8'), 'fake-font-bytes');

    const manifest = JSON.parse(await readFile(join(fixture.out, 'asset-manifest.json'), 'utf8'));
    assert.equal(manifest['css/app.css'], `css/app.${appHash}.css`);
    assert.equal(manifest['js/main.js'], `js/main.${mainHash}.js`);
    assert.equal(manifest['robots.txt'], undefined);
    assert.deepEqual(result.manifest, manifest);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('build deterministik dan menolak folder yang sama', async () => {
  const fixture = await makeFixture();
  try {
    const first = await build({ sourceDir: fixture.source, outDir: fixture.out });
    const firstMain = await readFile(join(fixture.out, first.manifest['js/main.js']), 'utf8');
    const second = await build({ sourceDir: fixture.source, outDir: fixture.out });
    const secondMain = await readFile(join(fixture.out, second.manifest['js/main.js']), 'utf8');
    assert.deepEqual(first.manifest, second.manifest);
    assert.equal(firstMain, secondMain);

    await assert.rejects(
      build({ sourceDir: fixture.source, outDir: fixture.source }),
      /tidak boleh sama/,
    );
    await assert.rejects(
      build({ sourceDir: fixture.source, outDir: join(fixture.source, 'dist') }),
      /di dalam folder sumber/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

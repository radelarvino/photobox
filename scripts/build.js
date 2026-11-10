/**
 * Build aset produksi.
 *
 * Menyalin `public/` ke `dist/`, mengganti nama aset dengan hash konten, lalu
 * menulis ulang referensi di HTML, CSS, dan import ES module. Hasilnya bisa
 * di-cache selamanya (`immutable`) tanpa takut versi lama tertinggal.
 *
 * Jalankan: npm run build
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, posix, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HASHED_EXT = new Set(['.css', '.js', '.woff2', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico']);
const HASH_LENGTH = 8;

const toPosix = (value) => value.split(sep).join('/');

async function walk(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full, base)));
    else if (entry.isFile()) files.push(toPosix(full.slice(base.length + 1)));
  }
  return files.sort();
}

function hashedName(rel, content) {
  const ext = extname(rel);
  const base = posix.basename(rel, ext);
  const hash = createHash('sha256').update(content).digest('hex').slice(0, HASH_LENGTH);
  return posix.join(posix.dirname(rel), `${base}.${hash}${ext}`);
}

function relativeSpec(fromDir, target) {
  const rel = posix.relative(fromDir, target);
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/** Tulis ulang import relatif di berkas JavaScript. */
function rewriteJs(text, file, map) {
  const dir = posix.dirname(file);
  return text.replace(
    /(['"])(\.{1,2}\/[^'"\n]+?\.js)\1/g,
    (match, quote, specifier) => {
      const target = posix.normalize(posix.join(dir, specifier));
      const hashed = map.get(target);
      return hashed ? `${quote}${relativeSpec(dir, hashed)}${quote}` : match;
    },
  );
}

/** Tulis ulang url(...) font/gambar di CSS. */
function rewriteCss(text, file, map) {
  const dir = posix.dirname(file);
  return text.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
    (match, quote, specifier) => {
      const clean = specifier.trim();
      if (/^(?:data:|https?:|\/\/|#)/i.test(clean)) return match;
      const [pathPart] = clean.split(/(?=[?#])/);
      const target = posix.normalize(posix.join(dir, pathPart));
      const hashed = map.get(target);
      if (!hashed) return match;
      return `url(${quote}${relativeSpec(dir, hashed)}${quote})`;
    },
  );
}

/** Tulis ulang href/src aset di HTML. */
function rewriteHtml(text, map) {
  return text.replace(
    /\b(href|src)="([^"]+)"/g,
    (match, attribute, value) => {
      if (/^(?:#|data:|https?:|mailto:|javascript:|\/\/)/i.test(value)) return match;
      const [pathPart] = value.split(/(?=[?#])/);
      const target = posix.normalize(pathPart.replace(/^\.?\//, ''));
      const hashed = map.get(target);
      return hashed ? `${attribute}="${hashed}"` : match;
    },
  );
}

/**
 * @param {{sourceDir: string, outDir: string}} options
 * @returns {Promise<{outDir: string, files: string[], manifest: Record<string, string>}>}
 */
export async function build({ sourceDir = join(ROOT, 'public'), outDir = join(ROOT, 'dist') } = {}) {
  const source = resolve(sourceDir);
  const target = resolve(outDir);
  if (source === target) throw new Error('Folder sumber dan tujuan build tidak boleh sama.');
  if (target.startsWith(`${source}${sep}`)) {
    throw new Error('Folder tujuan build tidak boleh berada di dalam folder sumber.');
  }

  const files = await walk(source);
  const contents = new Map();
  for (const file of files) contents.set(file, await readFile(join(source, file.split('/').join(sep))));

  const manifest = {};
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (!HASHED_EXT.has(ext)) continue;
    manifest[file] = hashedName(file, contents.get(file));
  }

  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  for (const file of files) {
    let data = contents.get(file);
    const ext = extname(file).toLowerCase();
    if (ext === '.js') data = Buffer.from(rewriteJs(data.toString('utf8'), file, new Map(Object.entries(manifest))));
    else if (ext === '.css') data = Buffer.from(rewriteCss(data.toString('utf8'), file, new Map(Object.entries(manifest))));
    else if (ext === '.html') data = Buffer.from(rewriteHtml(data.toString('utf8'), new Map(Object.entries(manifest))));

    const outRel = manifest[file] ?? file;
    const outPath = join(target, outRel.split('/').join(sep));
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, data);
  }

  const sortedManifest = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeFile(
    join(target, 'asset-manifest.json'),
    `${JSON.stringify(sortedManifest, null, 2)}\n`,
    'utf8',
  );

  return {
    outDir: target,
    files: files.map((file) => manifest[file] ?? file),
    manifest: sortedManifest,
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await build();
  const count = Object.keys(result.manifest).length;
  console.log(`[build] ${result.files.length} berkas → ${result.outDir} (${count} ber-hash)`);
}

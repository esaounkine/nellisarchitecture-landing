const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');

const MANIFEST = 'build/images.json';
const UPLOADS = 'wp-content/uploads/';
const VARIANTS = 'wp-content/variants/';
const AVIF = [320, 640, 960, 1600, 2400];
const FALLBACK = [640, 1600, 2400];
const FORMATS = {
  avif: ['avif', { quality: 50, effort: 4 }],
  jpg: ['jpeg', { quality: 78, progressive: true, mozjpeg: true }],
  png: ['png', { compressionLevel: 9 }],
};
const SOURCES = [
  'build/lib/partials', 'build/news-template.html', 'data/filters', 'data/projects.json',
  'data/search.json', 'content/news', 'content/pages',
];
const PAGES = ['index.html', 'projects', 'news', 'studio', 'people', 'privacy', 'contact'];
const DOMAIN = '(?:https://nellisarchitecture\\.com)?/?';
const REF = new RegExp(
  `${DOMAIN}wp-content/uploads/[^"'\\s()<>,\\\\]+?\\.(?:jpe?g|png|webp)(?![\\w.-])`,
  'gi',
);
const UPLOAD = new RegExp(`^${DOMAIN}(wp-content/uploads/[^?#]+)`);
const VARIANT = /-[0-9a-f]{8}-\d+\.(?:avif|jpg|png)$/;

/* A clean relative posix path below base: no ".", "..", "//" or a backslash. */
const inside = (p, base) => !p.includes('\\') && path.posix.normalize(p) === p
  && p.startsWith(base);

/* Steps below the original width, then the original width once (never upscale). */
function ladder(width, steps = AVIF) {
  const below = steps.filter((s) => s < width);
  return width > steps[steps.length - 1] ? below : [...below, width];
}

function variantName(uploadPath, hash, w, ext) {
  const rel = uploadPath.slice(UPLOADS.length);
  const dir = path.posix.dirname(rel);
  const name = path.posix.basename(rel, path.posix.extname(rel));
  const out = `${VARIANTS}${dir === '.' ? '' : `${dir}/`}${name}-${hash}-${w}.${ext}`;
  if (!inside(out, VARIANTS)) throw new Error(`variant outside ${VARIANTS}: ${out}`);
  return out;
}

/* An upload URL or path -> "wp-content/uploads/...", else null. */
function toUploadPath(url) {
  const m = String(url).match(UPLOAD);
  if (!m) return null;
  try {
    const p = decodeURIComponent(m[1]);
    return inside(p, UPLOADS) ? p : null;
  } catch {
    return null;
  }
}

function manifestEntry({
  width, height, alpha, hash, lqip,
}) {
  return {
    width,
    height,
    alpha,
    hash,
    widths: { avif: ladder(width, AVIF), [alpha ? 'png' : 'jpg']: ladder(width, FALLBACK) },
    lqip,
  };
}

const missing = (manifest, used) => used.filter((p) => !manifest[p]);

const variantFiles = (manifest) => Object.entries(manifest).flatMap(([p, e]) => Object
  .entries(e.widths).flatMap(([ext, ws]) => ws.map((w) => variantName(p, e.hash, w, ext))));

/* The files below wp-content/variants/ with a variant name that the manifest does not name. */
function staleVariants(manifest, files) {
  const keep = new Set(variantFiles(manifest));
  return files.filter((f) => inside(f, VARIANTS) && VARIANT.test(f) && !keep.has(f));
}

const hash8 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);

/* Never follows a symbolic link (path.resolve drops a trailing "/", which follows one). */
function walk(file) {
  if (!fs.existsSync(file) || fs.lstatSync(path.resolve(file)).isSymbolicLink()) return [];
  if (!fs.statSync(file).isDirectory()) return [file];
  return fs.readdirSync(file, { withFileTypes: true })
    .filter((d) => !d.isSymbolicLink())
    .flatMap((d) => walk(path.join(file, d.name)));
}

/* Every upload image the site content and the generated pages name, sorted. */
function usedImages(root) {
  const pages = PAGES.flatMap((p) => walk(path.join(root, p)))
    .filter((f) => path.basename(f) === 'index.html');
  const sources = SOURCES.flatMap((p) => walk(path.join(root, p)));
  const used = new Set();
  [...pages, ...sources].forEach((file) => {
    const text = fs.readFileSync(file, 'utf8').replace(/\\\//g, '/');
    (text.match(REF) || []).forEach((ref) => used.add(toUploadPath(ref)));
  });
  used.delete(null);
  return [...used].sort();
}

function readManifest(root) {
  const file = path.join(root, MANIFEST);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

async function encodeImage(sharp, root, uploadPath) {
  const buf = fs.readFileSync(path.join(root, uploadPath));
  const meta = await sharp(buf).metadata();
  const swap = (meta.orientation || 1) >= 5;
  const alpha = Boolean(meta.hasAlpha) && !(await sharp(buf).stats()).isOpaque;
  const small = await sharp(buf).rotate().resize({ width: 16, withoutEnlargement: true })
    .webp({ quality: 40 })
    .toBuffer();
  const entry = manifestEntry({
    width: swap ? meta.height : meta.width,
    height: swap ? meta.width : meta.height,
    alpha,
    hash: hash8(buf),
    lqip: `data:image/webp;base64,${small.toString('base64')}`,
  });
  await Promise.all(Object.entries(entry.widths).flatMap(([ext, ws]) => ws.map((w) => {
    const out = path.join(root, variantName(uploadPath, entry.hash, w, ext));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    return sharp(buf).rotate().resize({ width: w, withoutEnlargement: true })
      .toFormat(...FORMATS[ext])
      .toFile(out);
  })));
  return entry;
}

function installSharp(version) {
  const prefix = fs.mkdtempSync(path.join(os.tmpdir(), 'sharp-'));
  execFileSync('npm', [
    'install', '--no-save', '--no-package-lock', '--prefix', prefix, `sharp@${version}`,
  ], { stdio: 'ignore', timeout: 180000 });
  return createRequire(path.join(prefix, 'node_modules', 'sharp', 'package.json'))('sharp');
}

/* CI only (WORKERS_CI=1): make the variants of uploads without a manifest entry.
   The new entries stay in memory; build/images.json does not change. Never throws:
   a corrupt manifest gives {} in CI (originals), but throws locally so people see it.
   SHORTCUT: at most maxImages images or maxMs per build; the rest fall back to the
   originals until `npm run images` runs locally and the variants are committed. */
async function ensureVariants(root, {
  env = process.env, install = installSharp, encode = encodeImage, log = console.log,
  maxImages = 40, maxMs = 8 * 60 * 1000, now = Date.now,
} = {}) {
  if (env.WORKERS_CI !== '1') return readManifest(root);
  const start = now();
  let manifest = {};
  try {
    manifest = readManifest(root);
    const todo = missing(manifest, usedImages(root))
      .filter((p) => fs.existsSync(path.join(root, p))).slice(0, maxImages);
    if (!todo.length) return manifest;
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const sharp = install(pkg.devDependencies.sharp);
    let made = 0;
    await todo.reduce((chain, p) => chain.then(async () => {
      if (now() - start > maxMs) return;
      manifest[p] = await encode(sharp, root, p);
      made += 1;
    }), Promise.resolve());
    log(`images: made variants for ${made} of ${todo.length} new uploads`);
  } catch (error) {
    log(`images: CI fallback skipped (${error.message})`);
  }
  return manifest;
}

module.exports = {
  MANIFEST,
  VARIANTS,
  ladder,
  variantName,
  toUploadPath,
  manifestEntry,
  missing,
  variantFiles,
  staleVariants,
  hash8,
  walk,
  usedImages,
  readManifest,
  encodeImage,
  ensureVariants,
};

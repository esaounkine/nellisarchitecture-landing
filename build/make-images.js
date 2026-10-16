/*
 * build/make-images.js — writes the responsive image variants and build/images.json.
 *   npm run images
 * Skips an image when its hash and its variant files did not change.
 * Deletes the files in wp-content/variants/ that the manifest does not name.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const {
  MANIFEST, VARIANTS, hash8, usedImages, readManifest, encodeImage, variantFiles, walk,
} = require('./lib/images');

const ROOT = path.join(__dirname, '..');

function writeManifest(manifest) {
  const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
  const text = `${JSON.stringify(sorted, null, 2)}\n`;
  const file = path.join(ROOT, MANIFEST);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return;
  fs.writeFileSync(file, text);
}

async function main() {
  const old = readManifest(ROOT);
  const manifest = {};
  const used = usedImages(ROOT);
  let made = 0;
  await used.reduce((chain, p, i) => chain.then(async () => {
    const file = path.join(ROOT, p);
    if (!fs.existsSync(file)) {
      console.warn(`warning: missing upload ${p}`);
      return;
    }
    const entry = old[p];
    const same = entry && entry.hash === hash8(fs.readFileSync(file))
      && variantFiles({ [p]: entry }).every((f) => fs.existsSync(path.join(ROOT, f)));
    if (same) {
      manifest[p] = entry;
      return;
    }
    try {
      manifest[p] = await encodeImage(sharp, ROOT, p);
      made += 1;
      console.log(`${i + 1}/${used.length} ${p}`);
      writeManifest({ ...old, ...manifest });
    } catch (error) {
      console.warn(`warning: ${p}: ${error.message}`);
    }
  }), Promise.resolve());
  writeManifest(manifest);

  const keep = new Set(variantFiles(manifest));
  const files = walk(path.join(ROOT, VARIANTS))
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
  const stale = files.filter((f) => !keep.has(f));
  stale.forEach((f) => fs.unlinkSync(path.join(ROOT, f)));
  const bytes = [...keep].reduce((sum, f) => sum + fs.statSync(path.join(ROOT, f)).size, 0);
  console.log(`images: ${Object.keys(manifest).length} images, ${made} made, `
    + `${stale.length} stale deleted; `
    + `${keep.size} variant files, ${(bytes / 1024 / 1024).toFixed(1)} MiB`);
}

if (require.main === module) main();

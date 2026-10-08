const fs = require('node:fs');
const path = require('node:path');

const PARTIALS = path.join(__dirname, 'partials');
const PLACEHOLDER = 'data:image/svg+xml;base64,'
  + 'PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==';

function escText(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escAttr(s) {
  return escText(s).replace(/"/g, '&quot;');
}

/* Values go in through a callback, so `$&`, `$1` and `{{X}}` in a value stay literal. */
function fill(tpl, tokens) {
  const used = new Set();
  const out = tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key) => {
    if (!Object.hasOwn(tokens, key)) throw new Error(`fill: no value for ${m}`);
    used.add(key);
    return String(tokens[key]);
  });
  const unused = Object.keys(tokens).filter((key) => !used.has(key));
  if (unused.length) throw new Error(`fill: unused tokens ${unused.join(', ')}`);
  return out;
}

/* Theme lazy-load image. CMS paths are root-absolute; pages at the root link them relative. */
function lazyImg({
  src, alt, width, height,
}) {
  return `<img data-src="${escAttr(src.replace(/^\//, ''))}" alt="${escAttr(alt)}" `
    + `src="${PLACEHOLDER}" `
    + `class="lazyload" style="--smush-placeholder-width: ${escAttr(width)}px; `
    + `--smush-placeholder-aspect-ratio: ${escAttr(width)}/${escAttr(height)};" />`;
}

/* Partial files end with one newline for editors; the page markup does not. */
function loadPartial(name, dir = PARTIALS) {
  return fs.readFileSync(path.join(dir, `${name}.html`), 'utf8').replace(/\n$/, '');
}

module.exports = {
  escText, escAttr, fill, lazyImg, loadPartial,
};

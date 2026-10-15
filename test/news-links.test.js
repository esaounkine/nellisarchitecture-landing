const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const redirects = require('../build/lib/redirects');

const ROOT = path.join(__dirname, '..');
const LINK = /\]\((?:https:\/\/nellisarchitecture\.com)?(\/[^)\s#?]*)/g;

function deadLinks() {
  const exists = redirects.onDisk(ROOT);
  const norm = (p) => p.replace(/\/+$/, '') || '/';
  const froms = new Set([
    ...redirects.parseRules(fs.readFileSync(path.join(ROOT, 'content', 'redirects.json'), 'utf8'))
      .map((r) => norm(r.from)),
    ...redirects.tomlFroms(fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8')).map(norm),
    ...redirects.parseFixed(fs.readFileSync(path.join(ROOT, redirects.FIXED_FILE), 'utf8'))
      .map((r) => norm(r.from)),
  ]);
  const dir = path.join(ROOT, 'content', 'news');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).flatMap((f) => (
    [...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(LINK)]
      .map((m) => decodeURI(m[1]))
      .filter((p) => !exists(p) && !froms.has(norm(p)))
      .map((p) => `${f}: ${p}`)
  ));
}

test('every internal link in news posts opens a page, a file or a redirect', () => {
  assert.deepEqual(deadLinks(), []);
});

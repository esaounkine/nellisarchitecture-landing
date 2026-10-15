const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { tomlFroms } = require('../build/lib/redirects');

const SITE = [
  'admin', 'contact', 'data', 'js', 'news', 'people', 'privacy', 'projects', 'studio', 'wp-content',
  'robots.txt', 'sitemap.xml', 'feed.xml', '_redirects',
  'netlify.toml', // Netlify never serves it, no rule needed
];
const isSite = (entry) => entry.endsWith('.html') || SITE.includes(entry);

const root = path.join(__dirname, '..');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean);
const entries = new Map();
files.forEach((file) => {
  const [first, ...rest] = file.split('/');
  if (!first.startsWith('.')) entries.set(first, entries.get(first) || rest.length > 0);
});
const rule = (entry) => (entries.get(entry) ? `/${entry}/*` : `/${entry}`);

const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const froms = new Set(tomlFroms(toml));

test('every internal root entry has a deny rule in netlify.toml', () => {
  [...entries.keys()].filter((entry) => !isSite(entry)).forEach((entry) => {
    assert.ok(froms.has(rule(entry)), `netlify.toml: missing deny rule from = "${rule(entry)}"`);
  });
});

test('no site entry has a deny rule in netlify.toml', () => {
  [...entries.keys()].filter(isSite).forEach((entry) => {
    assert.ok(!froms.has(rule(entry)), `netlify.toml: site path "${rule(entry)}" is denied`);
  });
});

test('netlify.toml leaves the page folders to Netlify', () => {
  ['studio', 'people', 'privacy'].forEach((page) => {
    assert.ok(![...froms].some((f) => f.startsWith(`/${page}`)), `netlify.toml: rule for /${page}`);
  });
});

test('netlify.toml has no /projects* rule: Netlify serves the hub and the category pages', () => {
  assert.deepEqual([...froms].filter((f) => f.startsWith('/projects')), []);
});

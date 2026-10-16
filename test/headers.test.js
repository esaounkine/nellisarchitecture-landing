const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const parse = (text) => {
  const rules = new Map();
  let current;
  text.split('\n').forEach((line, i) => {
    if (line.trim() === '' || line.startsWith('#')) return;
    if (!/^\s/.test(line)) {
      assert.ok(!rules.has(line), `_headers:${i + 1}: duplicate path ${line}`);
      current = new Map();
      rules.set(line, current);
      return;
    }
    const match = line.match(/^ {2}([A-Za-z-]+): (\S.*)$/);
    assert.ok(match, `_headers:${i + 1}: expected "  Name: value", got "${line}"`);
    assert.ok(current, `_headers:${i + 1}: header before a path`);
    const name = match[1].toLowerCase();
    assert.ok(!current.has(name), `_headers:${i + 1}: duplicate header ${match[1]}`);
    current.set(name, match[2]);
  });
  return rules;
};

test('parse rejects a header line without indent or colon', () => {
  assert.throws(() => parse('/*\n  X-Frame-Options SAMEORIGIN\n'));
  assert.throws(() => parse('  X-Frame-Options: SAMEORIGIN\n'));
  assert.throws(() => parse('/*\n  A: 1\n  a: 2\n'));
});

test('parse skips # comment lines', () => {
  assert.deepEqual([...parse('# c\n/*\n  A: 1\n').keys()], ['/*']);
});

test('_headers sets the security headers on every path', () => {
  const all = parse(read('_headers')).get('/*');
  assert.ok(all, '_headers: missing /* rule');
  assert.equal(all.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(all.get('x-content-type-options'), 'nosniff');
  assert.equal(all.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(all.get('x-robots-tag'), 'noindex', 'noindex stays until the DNS cutover (card 9)');
});

test('_headers caches /wp-content/* for one year, immutable', () => {
  const uploads = parse(read('_headers')).get('/wp-content/*');
  assert.ok(uploads, '_headers: missing /wp-content/* rule');
  const cache = uploads.get('cache-control');
  assert.match(cache, /max-age=31536000/);
  assert.match(cache, /immutable/);
});

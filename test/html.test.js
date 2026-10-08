const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  escText, escAttr, fill, lazyImg, loadPartial,
} = require('../build/lib/html');
const { affiliations } = require('../build/lib/chrome');

test('escText escapes & < > but not quotes; escAttr also escapes "', () => {
  assert.equal(escText('a & <b> "q"'), 'a &amp; &lt;b&gt; "q"');
  assert.equal(escAttr('a & <b> "q"'), 'a &amp; &lt;b&gt; &quot;q&quot;');
  assert.equal(escText(undefined), '');
  assert.equal(escText(0), '0');
});

test('fill keeps $& $1 and {{X}} in values literal', () => {
  assert.equal(fill('<{{A}}|{{B}}>', { A: '$& $1 $$', B: '{{A}}' }), '<$& $1 $$|{{A}}>');
  assert.equal(fill('{{A}}{{A}}', { A: 'x' }), 'xx');
});

test('fill throws on a token without a value and on an unused value', () => {
  assert.throws(() => fill('{{A}} {{B}}', { A: 'x' }), /no value for \{\{B\}\}/);
  assert.throws(() => fill('{{A}}', { A: 'x', C: 'y' }), /unused tokens C/);
});

test('loadPartial strips exactly one trailing newline', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'partials-'));
  fs.writeFileSync(path.join(dir, 'one.html'), 'a\n');
  fs.writeFileSync(path.join(dir, 'two.html'), 'a\n\n');
  fs.writeFileSync(path.join(dir, 'none.html'), 'a');
  assert.equal(loadPartial('one', dir), 'a');
  assert.equal(loadPartial('two', dir), 'a\n');
  assert.equal(loadPartial('none', dir), 'a');
  fs.rmSync(dir, { recursive: true });
});

test('lazyImg links the root-absolute src relative and escapes attributes', () => {
  const html = lazyImg({
    src: '/wp-content/uploads/a.png', alt: 'A "b"', width: 123, height: 54,
  });
  assert.ok(html.startsWith('<img data-src="wp-content/uploads/a.png" alt="A &quot;b&quot;" '));
  assert.ok(html.endsWith('width: 123px; --smush-placeholder-aspect-ratio: 123/54;" />'));
});

test('affiliations indents with the page indent level', () => {
  const img = {
    src: '/a.png', alt: '', width: 1, height: 1,
  };
  const two = affiliations([img, img], '  ').split('\n');
  assert.equal(two.length, 6);
  assert.equal(two[0], `${' '.repeat(14)}<div class="partner">`);
  assert.ok(two[1].startsWith(`${' '.repeat(16)}<img data-src="a.png"`));
  assert.equal(two[2], `${' '.repeat(14)}</div>`);
  const four = affiliations([img], '    ').split('\n');
  assert.equal(four[0], `${' '.repeat(28)}<div class="partner">`);
  assert.equal(affiliations([], '  '), '');
});

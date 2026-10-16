const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  escText, escAttr, fill, titleAttr, lazyImg, loadPartial, isVideo,
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

test('lazyImg keeps the root-absolute src and escapes attributes', () => {
  const html = lazyImg({
    src: '/wp-content/uploads/a.png', alt: 'A "b"', width: 123, height: 54,
  });
  assert.ok(html.startsWith('<img data-src="/wp-content/uploads/a.png" alt="A &quot;b&quot;" '));
  assert.ok(html.endsWith('width: 123px; --smush-placeholder-aspect-ratio: 123/54;" />'));
});

test('titleAttr is empty for no title and escapes a filled title', () => {
  [undefined, null, '', '   ', '\t\n'].forEach((t) => assert.equal(titleAttr(t), '', String(t)));
  assert.equal(titleAttr(' A "b" & <c> '), ' title=" A &quot;b&quot; &amp; &lt;c&gt; "');
});

test('lazyImg puts a filled title after alt and no title attribute when empty', () => {
  const base = {
    src: '/a.png', alt: 'A', width: 1, height: 1,
  };
  assert.ok(lazyImg({ ...base, title: 'T "q" & <x>' })
    .startsWith('<img data-src="/a.png" alt="A" title="T &quot;q&quot; &amp; &lt;x&gt;" src='));
  [undefined, '', '  '].forEach((title) => {
    const html = lazyImg({ ...base, title });
    assert.ok(!html.includes('title='), String(title));
    assert.equal(html, lazyImg(base));
  });
});

test('affiliations passes the image title through', () => {
  const img = {
    src: '/a.png', alt: '', title: 'Logo', width: 1, height: 1,
  };
  assert.ok(affiliations([img], '  ').includes('<img data-src="/a.png" alt="" title="Logo" '));
});

test('affiliations indents with the page indent level', () => {
  const img = {
    src: '/a.png', alt: '', width: 1, height: 1,
  };
  const two = affiliations([img, img], '  ').split('\n');
  assert.equal(two.length, 6);
  assert.equal(two[0], `${' '.repeat(14)}<div class="partner">`);
  assert.ok(two[1].startsWith(`${' '.repeat(16)}<img data-src="/a.png"`));
  assert.equal(two[2], `${' '.repeat(14)}</div>`);
  const four = affiliations([img], '    ').split('\n');
  assert.equal(four[0], `${' '.repeat(28)}<div class="partner">`);
  assert.equal(affiliations([], '  '), '');
});

test('affiliations level defaults to 7 and moves the partner div', () => {
  const img = {
    src: '/a.png', alt: '', width: 1, height: 1,
  };
  assert.equal(affiliations([img], '  ', 7), affiliations([img], '  '));
  const eight = affiliations([img], '  ', 8).split('\n');
  assert.equal(eight[0], `${' '.repeat(16)}<div class="partner">`);
  assert.ok(eight[1].startsWith(`${' '.repeat(18)}<img data-src="/a.png"`));
  assert.equal(eight[2], `${' '.repeat(16)}</div>`);
});

test('isVideo matches video extensions in any case, at the end of the path only', () => {
  assert.equal(isVideo('/a.mp4'), true);
  assert.equal(isVideo('/a.MOV'), true);
  assert.equal(isVideo('/a.jpg'), false);
  assert.equal(isVideo(''), false);
  assert.equal(isVideo('/a.mp4?x'), false);
});

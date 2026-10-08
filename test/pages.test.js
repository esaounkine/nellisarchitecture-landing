const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { bodyLines } = require('../build/lib/pages/privacy');
const { renderPages } = require('../build/lib/pages');

test('bodyLines ends every text line with <br><br>, except the last', () => {
  assert.equal(bodyLines('one\ntwo\nlast'), 'one<br><br>\ntwo<br><br>\nlast');
  assert.equal(bodyLines('only'), 'only');
});

test('bodyLines keeps blank lines blank and ignores outer blank lines', () => {
  assert.equal(bodyLines('\n\na\n\n \nb\n\n'), 'a<br><br>\n\n\nb');
  assert.equal(bodyLines(''), '');
  assert.equal(bodyLines(undefined), '');
});

test('bodyLines escapes text and keeps a space before the break', () => {
  assert.equal(bodyLines('>mail & <b>\nend'), '&gt;mail &amp; &lt;b&gt;<br><br>\nend');
  assert.equal(bodyLines('that \nend'), 'that <br><br>\nend');
  assert.equal(bodyLines('a\r\nb'), 'a<br><br>\nb');
});

test('renderPages puts the News link in each page and renders pravicy as privacy', () => {
  const pages = renderPages(path.join(__dirname, '..'), 'news/x-$&/index.html');
  assert.deepEqual(pages.map((p) => p.file), ['index.html', 'privacy.html', 'pravicy.html']);
  pages.forEach((p) => {
    assert.ok(p.html.includes('href="news/x-$&amp;/index.html"'), p.file);
    assert.ok(!p.html.includes('{{'), p.file);
  });
  assert.equal(pages[2].html, pages[1].html);
});

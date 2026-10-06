const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseFrontMatter, inlineMd, mdToHtml, parseDate, esc, idNum, sitemap,
} = require('../build-news');

test('parseFrontMatter reads plain and quoted values', () => {
  const src = '---\ntitle: "A \\"quoted\\" title"\nslug: my-post\n---\n\nBody text\n';
  const { fm, body } = parseFrontMatter(src);
  assert.equal(fm.title, 'A "quoted" title');
  assert.equal(fm.slug, 'my-post');
  assert.equal(body, 'Body text');
});

test('parseFrontMatter ignores lines that are not keys', () => {
  const { fm } = parseFrontMatter('---\ntitle: T\n  - stray\nBad-Key: x\n---\n');
  assert.deepEqual(fm, { title: 'T' });
});

test('parseFrontMatter throws on a missing front matter block', () => {
  assert.throws(() => parseFrontMatter('no front matter', 'x.md'), /bad front matter: x\.md/);
});

test('inlineMd renders images before links, bold before italics', () => {
  assert.equal(inlineMd('![alt](/a.jpg)'), '<img src="/a.jpg" alt="alt" class="lazyload" />');
  assert.equal(inlineMd('[site](https://x.com)'), '<a href="https://x.com">site</a>');
  assert.equal(inlineMd('**b** and *i*'), '<strong>b</strong> and <em>i</em>');
});

test('mdToHtml renders each block type', () => {
  const md = [
    '## Heading', '#### Small', '---', '- one\n- two', '> quote',
    '![a](/i.jpg)', 'line one\nline two',
  ].join('\n\n');
  assert.equal(mdToHtml(md), [
    '<h2>Heading</h2>',
    '<h4>Small</h4>',
    '<hr />',
    '<ul><li>one</li><li>two</li></ul>',
    '<blockquote>quote</blockquote>',
    '<img src="/i.jpg" alt="a" class="lazyload" />',
    '<p>line one line two</p>',
  ].join('\n'));
});

test('mdToHtml skips empty blocks and treats # (h1) as a paragraph', () => {
  assert.equal(mdToHtml('\n\n\n\n# Title\n\n\n'), '<p># Title</p>');
  assert.equal(mdToHtml(''), '');
});

test('parseDate reads the CMS date format as UTC', () => {
  assert.equal(parseDate('August 14, 2026').toISOString(), '2026-08-14T00:00:00.000Z');
  assert.equal(parseDate('march 5,2025').toISOString(), '2025-03-05T00:00:00.000Z');
});

test('parseDate falls back to epoch for missing or bad dates, January for unknown months', () => {
  assert.equal(parseDate(undefined).getTime(), 0);
  assert.equal(parseDate('2026-08-14').getTime(), 0);
  assert.equal(parseDate('Foo 2, 2026').toISOString(), '2026-01-02T00:00:00.000Z');
});

test('esc escapes HTML attribute characters and tolerates empty input', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  assert.equal(esc(undefined), '');
});

test('idNum returns the numeric id or 0', () => {
  assert.equal(idNum({ id: '42' }), 42);
  assert.equal(idNum({ id: 'mdslug' }), 0);
});

test('sitemap lists static pages and posts with lastmod', () => {
  const xml = sitemap([{ slug: 'p', dateObj: new Date(Date.UTC(2026, 0, 2)) }]);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset /);
  const site = 'https://nellisarchitecture.com';
  assert.ok(xml.includes(`<url><loc>${site}/</loc><priority>1.0</priority></url>`));
  assert.ok(xml.includes(`<loc>${site}/news/p/</loc><lastmod>2026-01-02</lastmod>`));
  assert.ok(xml.endsWith('</urlset>\n'));
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  parseFrontMatter, inlineMd, mdToHtml, parseDate, esc, idNum, sitemap, loadPosts,
  renderPost, readingTime,
} = require('../build-news');
const { INDEX, NOINDEX } = require('../build/lib/seo');

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

const PAGE_LIST = [
  { slug: '', priority: '1.0', noindex: false },
  { slug: 'studio', priority: '0.8', noindex: false },
  { slug: 'privacy', priority: '0.2', noindex: true },
];

test('sitemap lists the pages and posts with lastmod', () => {
  const xml = sitemap([{ slug: 'p', dateObj: new Date(Date.UTC(2026, 0, 2)) }], PAGE_LIST);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset /);
  const site = 'https://nellisarchitecture.com';
  assert.ok(xml.includes(`\n  <url><loc>${site}/</loc><priority>1.0</priority></url>\n`));
  assert.ok(xml.includes(`<url><loc>${site}/studio/</loc><priority>0.8</priority></url>`));
  assert.ok(xml.includes(`<loc>${site}/news/p/</loc><lastmod>2026-01-02</lastmod>`));
  assert.ok(!xml.includes('index.html'));
  assert.ok(!xml.includes('.com//'));
  assert.ok(xml.endsWith('</urlset>\n'));
});

test('sitemap skips noindex pages', () => {
  const xml = sitemap([], PAGE_LIST);
  assert.ok(!xml.includes('/privacy/'));
  assert.equal(xml.split('<url>').length - 1, 2);
});

test('loadPosts refuses a slug that is not lowercase letters, digits and dashes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'posts-'));
  const post = (slug) => `---\ntitle: T\nslug: ${slug}\ndate: 2026-01-02\n---\nBody\n`;
  fs.writeFileSync(path.join(dir, 'ok.md'), post('ok-post-2'));
  assert.equal(loadPosts(dir)[0].slug, 'ok-post-2');
  ['..', '../x', 'a/b', 'Upper', 'two words', 'a--b', '-a', ''].forEach((bad) => {
    fs.writeFileSync(path.join(dir, 'bad.md'), post(bad));
    assert.throws(() => loadPosts(dir), /slug must be lowercase/, bad);
  });
  fs.rmSync(dir, { recursive: true });
});

test('news template links the nav News item and the News crumb to /news/', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'build', 'news-template.html'), 'utf8');
  assert.ok(html.includes('<a href="/news/">News</a>\n              </li>'));
  assert.ok(html.includes('<a href="/">Home</a> <span>/</span> <a href="/news/">News</a>'));
  assert.doesNotMatch(html, /href="index\.html"/);
});

test('news template has no feed link', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'build', 'news-template.html'), 'utf8');
  assert.doesNotMatch(html, /href=["'][^"']*feed\//);
});

const ROOT = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'build', 'news-template.html'), 'utf8');
const meta = (html, prop) => [
  ...html.matchAll(new RegExp(`(?:property|name)="${prop}" content="([^"]*)"`, 'g')),
].map((m) => m[1]);
const SITE = 'https://nellisarchitecture.com';
const UP = `${SITE}/wp-content/uploads`;
const post = (over) => ({
  slug: 's', title: 'T', html: '<p>x</p>', dateObj: new Date(Date.UTC(2025, 11, 22)), ...over,
});

test('renderPost gives each post its own og:image, size and published time', () => {
  const a = renderPost(TEMPLATE, post({
    hero: `${UP}/2025/12/25-questions.jpg`,
  }), '');
  const b = renderPost(TEMPLATE, post({
    hero: `${UP}/2025/09/Bespoke-Design-for-Dubai-Homes.png`,
    dateObj: new Date(Date.UTC(2025, 8, 3)),
  }), '');
  assert.deepEqual(meta(a, 'og:image'), [`${UP}/2025/12/25-questions.jpg`]);
  assert.deepEqual(meta(a, 'og:image:width'), ['1187']);
  assert.deepEqual(meta(a, 'og:image:height'), ['791']);
  assert.deepEqual(meta(a, 'og:image:type'), ['image/jpeg']);
  assert.deepEqual(meta(a, 'article:published_time'), ['2025-12-22T00:00:00.000Z']);
  assert.deepEqual(meta(a, 'article:modified_time'), ['2025-12-22T00:00:00.000Z']);
  assert.deepEqual(meta(b, 'og:image:width'), ['620']);
  assert.deepEqual(meta(b, 'og:image:height'), ['404']);
  assert.deepEqual(meta(b, 'og:image:type'), ['image/png']);
  assert.deepEqual(meta(b, 'article:published_time'), ['2025-09-03T00:00:00.000Z']);
  assert.doesNotMatch(a + b, /GAFSTAoL|2025-11-24T17:25:07/);
});

test('renderPost falls back to minis.png without a hero or with an unreadable one', () => {
  const minis = `${SITE}/wp-content/themes/nellis/assets/img/minis.png`;
  [undefined, `${UP}/missing.jpg`, `${UP}/2025/07/One-Year-Anniversary-Video-For-Website.mp4`,
    'https://example.com/x.jpg'].forEach((hero) => {
    const html = renderPost(TEMPLATE, post({ hero }), '');
    assert.deepEqual(meta(html, 'og:image'), [minis], hero);
    assert.deepEqual(meta(html, 'og:image:width'), ['968']);
    assert.deepEqual(meta(html, 'og:image:height'), ['504']);
    assert.deepEqual(meta(html, 'og:image:type'), ['image/png']);
  });
});

test('every real post renders exactly one og:image that exists on disk', () => {
  loadPosts(path.join(ROOT, 'content', 'news')).forEach((p) => {
    const html = renderPost(TEMPLATE, p, '');
    const urls = meta(html, 'og:image');
    assert.equal(urls.length, 1, p.slug);
    ['og:image:width', 'og:image:height', 'og:image:type']
      .forEach((k) => assert.equal(meta(html, k).length, 1, k));
    assert.ok(fs.existsSync(path.join(ROOT, urls[0].slice(SITE.length))), urls[0]);
  });
});

test('renderPost breadcrumb schema links News to /news/', () => {
  const html = renderPost(TEMPLATE, post({ title: 'P' }), '');
  const ld = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/)[1];
  const json = JSON.parse(ld);
  const crumbs = json['@graph'].find((n) => n['@type'] === 'BreadcrumbList');
  assert.deepEqual(crumbs.itemListElement.map((i) => [i.position, i.name, i.item]), [
    [1, 'Home', `${SITE}/`], [2, 'News', `${SITE}/news/`], [3, 'P', undefined],
  ]);
});

test('readingTime counts plain-text words at 200 per minute, at least 1 minute', () => {
  assert.equal(readingTime(''), '1 minute');
  assert.equal(readingTime('<p>one <a href="https://x.com/a b c">two</a></p>'), '1 minute');
  assert.equal(readingTime(`<p>${'w '.repeat(200)}</p>`), '1 minute');
  assert.equal(readingTime(`<p>${'w '.repeat(201)}</p>`), '2 minutes');
});

test('renderPost writes the reading time and keeps the author', () => {
  const html = renderPost(TEMPLATE, post({ html: `<p>${'w '.repeat(450)}</p>` }), '');
  assert.deepEqual(meta(html, 'twitter:data2'), ['3 minutes']);
  assert.deepEqual(meta(html, 'twitter:data1'), ['Santaclaus']);
  assert.deepEqual(meta(html, 'author'), ['Santaclaus']);
});

test('loadPosts reads noindex as a boolean and refuses other values', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'posts-'));
  const file = path.join(dir, 'p.md');
  const write = (line) => fs.writeFileSync(file, `---\ntitle: T\nslug: p\n${line}\n---\nBody\n`);
  [['noindex: true', true], ['noindex: "true"', true], ['noindex: false', false],
    ['noindex: "false"', false], ['', false], ['noindex:', false]].forEach(([line, want]) => {
    write(line);
    assert.equal(loadPosts(dir)[0].noindex, want, line);
  });
  ['yes', '1', 'True'].forEach((bad) => {
    write(`noindex: ${bad}`);
    const named = (e) => e.message.includes(file) && /noindex/.test(e.message);
    assert.throws(() => loadPosts(dir), named, bad);
  });
  fs.rmSync(dir, { recursive: true });
});

test('renderPost writes noindex robots for a noindex post, index robots by default', () => {
  const hidden = renderPost(TEMPLATE, post({ noindex: true }), '');
  assert.equal(hidden.split(NOINDEX).length - 1, 1);
  assert.ok(!hidden.includes(INDEX));
  assert.ok(!hidden.includes('{{ROBOTS}}'));
  const shown = renderPost(TEMPLATE, post(), '');
  assert.equal(shown.split(INDEX).length - 1, 1);
  assert.ok(!shown.includes(NOINDEX));
});

test('sitemap skips noindex posts and keeps the others', () => {
  const dateObj = new Date(Date.UTC(2026, 0, 2));
  const xml = sitemap([{ slug: 'a', dateObj, noindex: true }, { slug: 'b', dateObj }], []);
  assert.ok(!xml.includes('/news/a/'));
  assert.ok(xml.includes('/news/b/'));
});

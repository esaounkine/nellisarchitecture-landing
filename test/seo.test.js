const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { seoTokens, pageUrl } = require('../build/lib/seo');
const { PAGES, renderPages } = require('../build/lib/pages');
// eslint-disable-next-line import-x/no-useless-path-segments -- Home page module
const index = require('../build/lib/pages/index');

const ROOT = path.join(__dirname, '..');
const DOMAIN = 'https://nellisarchitecture.com';
const read = (name) => JSON.parse(
  fs.readFileSync(path.join(ROOT, 'content', 'pages', `${name}.json`), 'utf8'),
);
const pageOf = (name) => PAGES.find((p) => p.content === name);
const INDEX_ROBOTS = "<meta name='robots' content='index, follow, max-image-preview:large, "
  + "max-snippet:-1, max-video-preview:-1' />";

test('an empty SEO title falls back to the page title, then to the h1', () => {
  const expected = {
    index: 'Nellis Architecture | Award-Winning Architectural Design Firm',
    studio: 'Architecture Studio Dubai',
    people: 'People | Nellis Architecture Studio Team &amp; Experts',
    privacy: 'Privacy policy',
  };
  Object.entries(expected).forEach(([name, title]) => {
    const content = read(name);
    content.seo = { ...content.seo, title: '', og_title: '' };
    const t = seoTokens(content, pageOf(name));
    assert.equal(t.TITLE, title, name);
    assert.equal(t.OG_TITLE, title.replace(/"/g, '&quot;'), name);
  });
  assert.equal(seoTokens({ h1: 'H' }, { slug: 'x' }).TITLE, 'H');
});

test('og:title falls back to the SEO title', () => {
  const t = seoTokens({ h1: 'H', seo: { title: 'S' } }, { slug: 'x' });
  assert.equal(t.OG_TITLE, 'S');
  assert.equal(seoTokens({ seo: { title: 'S', og_title: 'O' } }, { slug: 'x' }).OG_TITLE, 'O');
});

test('canonical and og:url default to the absolute page URL', () => {
  ['studio', 'people', 'privacy'].forEach((slug) => {
    const t = seoTokens({ h1: 'H', seo: { canonical: '' } }, { slug });
    assert.equal(t.CANONICAL, `${DOMAIN}/${slug}/`);
    assert.equal(t.OG_URL, `${DOMAIN}/${slug}/`);
  });
});

test('Home canonical, og:url and URL are exactly the domain with one slash', () => {
  const t = seoTokens(read('index'), pageOf('index'));
  assert.equal(t.CANONICAL, `${DOMAIN}/`);
  assert.equal(t.OG_URL, `${DOMAIN}/`);
  assert.equal(pageUrl(''), `${DOMAIN}/`);
  const [{ html }] = renderPages(ROOT, '/news/n/');
  assert.ok(html.includes(`<link rel="canonical" href="${DOMAIN}/" />`));
  assert.ok(html.includes(`<meta property="og:url" content="${DOMAIN}/" />`));
});

test('a custom canonical replaces the default', () => {
  const url = `${DOMAIN}/news/other/`;
  const t = seoTokens({ h1: 'H', seo: { canonical: url } }, { slug: 'studio' });
  assert.equal(t.CANONICAL, url);
  assert.equal(t.OG_URL, url);
});

test('a canonical on another host throws', () => {
  [
    'http://nellisarchitecture.com/', 'https://example.com/',
    'https://nellisarchitecture.com.evil/', 'https://nellisarchitecture.com', '/studio/',
  ].forEach((canonical) => {
    assert.throws(() => seoTokens({ h1: 'H', seo: { canonical } }, { slug: 'x' }), /canonical/);
  });
});

test('noindex replaces the robots line', () => {
  assert.equal(seoTokens({ h1: 'H', seo: {} }, { slug: 'x' }).ROBOTS, INDEX_ROBOTS);
  const t = seoTokens({ h1: 'H', seo: { noindex: true } }, { slug: 'x' });
  assert.equal(t.ROBOTS, '<meta name="robots" content="noindex">');
  const site = read('site');
  const content = { ...read('index'), seo: { ...read('index').seo, noindex: true } };
  const html = index.render(content, { site, newsHref: '/n/', page: pageOf('index') });
  assert.ok(html.includes('  <meta name="robots" content="noindex">\n'));
  assert.ok(!html.includes("name='robots'"));
});

test('renderPages marks noindex pages for the sitemap', () => {
  renderPages(ROOT, '/n/').forEach((p) => assert.equal(p.noindex, false, p.file));
});

test('SEO values are escaped and $& stays literal', () => {
  const seo = {
    title: 'A "q" <b> & $&', og_title: 'O "q" <b> & $&', description: 'D "q" <b> & $&',
  };
  const t = seoTokens({ seo }, { slug: 'x' });
  assert.equal(t.TITLE, 'A "q" &lt;b&gt; &amp; $&amp;');
  assert.equal(t.OG_TITLE, 'O &quot;q&quot; &lt;b&gt; &amp; $&amp;');
  assert.equal(t.DESCRIPTION, 'D &quot;q&quot; &lt;b&gt; &amp; $&amp;');
  assert.equal(t.OG_DESCRIPTION, t.DESCRIPTION);
  const site = read('site');
  const html = index.render({ h1: 'H', seo }, { site, newsHref: '/n/', page: pageOf('index') });
  assert.ok(html.includes(`<title>${t.TITLE}</title>`));
  assert.ok(html.includes(`<meta property="og:title" content="${t.OG_TITLE}" />`));
  assert.ok(html.includes(`<meta name="description" content="${t.DESCRIPTION}" />`));
  const canonical = seoTokens({ seo: { canonical: `${DOMAIN}/a"b<c>` } }, { slug: 'x' }).CANONICAL;
  assert.equal(canonical, `${DOMAIN}/a&quot;b&lt;c&gt;`);
});

test('og:image in head.html and news-template.html exists on disk', () => {
  ['build/lib/partials/head.html', 'build/news-template.html'].forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const m = html.match(/property="og:image" content="([^"]+)"/);
    assert.ok(m, file);
    assert.ok(m[1].startsWith(DOMAIN), file);
    assert.ok(fs.existsSync(path.join(ROOT, m[1].slice(DOMAIN.length))), m[1]);
  });
});

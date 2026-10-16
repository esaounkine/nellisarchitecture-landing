const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  walk, readManifest, rewriteImages, smallSrc, toUploadPath,
} = require('../build/lib/images');

const ROOT = path.join(__dirname, '..');
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const PAGES = ['index.html', 'studio/index.html', 'people/index.html',
  ...walk(path.join(ROOT, 'projects')).map(rel).filter((f) => f.endsWith('index.html'))];
const NEWS = walk(path.join(ROOT, 'news')).map(rel).filter((f) => f.endsWith('index.html'));
const HAND_KEPT = ['build/lib/partials/index-projects.html',
  ...walk(path.join(ROOT, 'data', 'filters')).map(rel)];
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'pages', 'site.json'), 'utf8'));
const CHROME = new Set(['/wp-content/uploads/2025/02/logo.png',
  ...site.affiliations.map((a) => a.src)]);
const MEDIA = /^\/wp-content\/(uploads|variants)\//;
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];

test('every content image has srcset, sizes, width and height, or is the sized fallback', () => {
  [...PAGES, ...NEWS, ...HAND_KEPT].forEach((file) => {
    (read(file).match(/<img\b[^>]*>/g) || []).forEach((tag) => {
      if (/\blazyload\b/.test(attr(tag, 'class') || '')) {
        const src = attr(tag, 'data-src').replace(/^(\.\.\/)+/, '/');
        assert.ok(CHROME.has(src), `${file}: lazyload content image ${tag}`);
        return;
      }
      const src = attr(tag, 'src') || '';
      if (!MEDIA.test(src)) return;
      assert.ok(attr(tag, 'width') && attr(tag, 'height'), `${file}: no size ${tag}`);
      assert.equal(attr(tag, 'data-overlay-added'), 'true', `${file}: ${tag}`);
      if (src.startsWith('/wp-content/variants/')) {
        assert.ok(attr(tag, 'srcset') && attr(tag, 'sizes'), `${file}: ${tag}`);
        return;
      }
      const { size } = fs.statSync(path.join(ROOT, toUploadPath(src)));
      assert.ok(size <= 1024 * 1024, `${file}: original over 1 MB ${src}`);
    });
  });
});

test('each page has one priority image; a video hero page and the hand-kept files none', () => {
  PAGES.forEach((file) => {
    const html = read(file);
    const video = html.includes('<div class="currentProject-heroImg"><video');
    assert.equal(html.split('fetchpriority="high"').length - 1, video ? 0 : 1, file);
    assert.equal(html.split('loading="eager"').length - 1, video ? 0 : 1, file);
  });
  HAND_KEPT.forEach((file) => assert.ok(!read(file).includes('fetchpriority'), file));
});

test('the project page priority image is the hero, not a grid thumb', () => {
  PAGES.filter((f) => f.split('/').length === 5).forEach((file) => {
    const hero = read(file).split('<div class="currentProject-heroImg varVideo">')[1];
    if (hero) assert.match(hero.split('</div>')[0], /fetchpriority="high"/, file);
  });
});

test('the hand-kept image markup is current: npm run images changes nothing', () => {
  const manifest = readManifest(ROOT);
  HAND_KEPT.forEach((file) => {
    const text = read(file);
    assert.equal(rewriteImages(text, manifest, 'card'), text, `${file}: run npm run images`);
  });
  JSON.parse(read('data/search.json')).forEach((s) => {
    assert.equal(smallSrc(s.minImg, manifest), s.minImg, s.title);
  });
});

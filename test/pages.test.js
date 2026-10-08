const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bodyLines } = require('../build/lib/pages/privacy');
const studio = require('../build/lib/pages/studio');
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

const ROOT = path.join(__dirname, '..');
const count = (s, sub) => s.split(sub).length - 1;

test('renderPages puts the News link in each page and renders pravicy as privacy', () => {
  const pages = renderPages(ROOT, 'news/x-$&/index.html');
  assert.deepEqual(
    pages.map((p) => p.file),
    ['index.html', 'privacy.html', 'pravicy.html', 'studio.html'],
  );
  pages.forEach((p) => {
    assert.ok(p.html.includes('href="news/x-$&amp;/index.html"'), p.file);
    assert.ok(!p.html.includes('{{'), p.file);
  });
  assert.equal(pages[2].html, pages[1].html);
});

const img = (name) => ({
  src: `/wp-content/uploads/pages/${name}.png`, alt: `${name} "alt"`, width: 10, height: 20,
});

function studioFixture() {
  return {
    h1: 'Hidden H1',
    intro: {
      title: 'Intro <T> "q"',
      subtitle: 'Sub & title',
      photo: img('photo'),
      quote: 'Line one\nLine two',
      quote_author: 'Author $&',
      paragraphs: ['Para one', 'Para two'],
      big_image: img('big'),
    },
    services: {
      title: 'Services T',
      button: 'Go',
      items: [{ title: 'Svc A', link: 'index.html#a b' }, { title: 'Svc B', link: 'x"y' }],
    },
    values: {
      title: 'Values T',
      items: [{ title: 'VAL A', text: 'Text a & b' }, { title: 'VAL B', text: 'Text b' }],
    },
    founder: {
      title: 'Founder T',
      quote: '"Quote"',
      photo: img('founder'),
      label: 'Label',
      name: 'Name',
      bio: 'Bio',
      text: 'Text',
    },
  };
}

test('studio render puts each value in its places', () => {
  const siteFile = path.join(ROOT, 'content', 'pages', 'site.json');
  const site = JSON.parse(fs.readFileSync(siteFile, 'utf8'));
  const html = studio.render(studioFixture(), { site, newsHref: 'news/n/index.html' });
  assert.ok(!html.includes('{{'));
  assert.ok(html.includes('<h1 class="visually-hidden">Hidden H1</h1>'));
  assert.ok(html.includes('site-containerStudioPageIn Intro &lt;T&gt; &quot;q&quot;">'));
  assert.ok(html.includes('FirstBlockLink">Intro &lt;T&gt; "q"</a>'));
  assert.ok(html.includes('<h1>Intro &lt;T&gt; "q"</h1>'));
  ['Services T', 'Values T', 'Founder T'].forEach((t) => {
    assert.equal(count(html, `>${t}</a>`), 1, t);
    assert.equal(count(html, `>${t}</h2>`), 1, t);
  });
  assert.equal(count(html, '<h3>VAL A:</h3>'), 2);
  assert.equal(count(html, 'Text a &amp; b'), 2);
  assert.equal(count(html, '        Para one      </p>'), 2);
  assert.equal(count(html, '        Para two      </p>'), 2);
  assert.ok(html.includes('Line one<br>Line two        <br /><br />-Author $&amp;      </div>'));
  assert.ok(html.includes('<span>Sub &amp; title</span>'));
  assert.ok(html.includes('href="index.html#a b"'));
  assert.ok(html.includes('href="x&quot;y"'));
  assert.equal(count(html, '                Go\n'), 2);
  assert.ok(html.includes('data-src="wp-content/uploads/pages/founder.png" '
    + 'alt="founder &quot;alt&quot;" class="photo1 lazyload"'));
  assert.ok(html.includes('--smush-placeholder-width: 10px; '
    + '--smush-placeholder-aspect-ratio: 10/20;" />'));
  assert.ok(html.includes('data-src="wp-content/uploads/pages/big.png"'));
  assert.ok(html.includes('href="news/n/index.html" class="newsPage"'));
  assert.ok(html.includes(`${' '.repeat(16)}<div class="partner">`));
  assert.ok(html.includes('"Quote"      </p>'));
});

test('quoteLines joins lines with <br>, escapes and trims', () => {
  assert.equal(studio.quoteLines('a\r\nb'), 'a<br>b');
  assert.equal(studio.quoteLines('only'), 'only');
  assert.equal(studio.quoteLines('\na\n\nb\n'), 'a<br><br>b');
  assert.equal(studio.quoteLines('<a> & b'), '&lt;a&gt; &amp; b');
  assert.equal(studio.quoteLines(undefined), '');
});

test('values indents the first item and the next items as the theme loop does', () => {
  const items = [{ title: 'A', text: 'x' }, { title: 'B', text: 'y' }];
  const lines = studio.values(items, 20, 22, 12).split('\n');
  assert.deepEqual(lines, [
    `${' '.repeat(20)}<div class="sprintLine__item">`,
    `${' '.repeat(14)}<h3>A:</h3>`,
    `${' '.repeat(14)}<p>`,
    `${' '.repeat(16)}x${' '.repeat(14)}</p>`,
    `${' '.repeat(12)}</div>`,
    `${' '.repeat(22)}<div class="sprintLine__item">`,
    `${' '.repeat(14)}<h3>B:</h3>`,
    `${' '.repeat(14)}<p>`,
    `${' '.repeat(16)}y${' '.repeat(14)}</p>`,
    `${' '.repeat(12)}</div>`,
  ]);
  assert.equal(studio.values([], 20, 22, 12), '');
});

test('services renders one block per item and nothing for an empty list', () => {
  const html = studio.services({ button: 'Go', items: [{ title: 'A', link: 'a' }] });
  assert.ok(html.startsWith(`${' '.repeat(16)}<a href="a" class="SechondBlock__project_container">`
    + '\n            <div'));
  assert.ok(html.endsWith(`${' '.repeat(10)}</a>`));
  assert.equal(studio.services({ button: 'Go', items: [] }), '');
});

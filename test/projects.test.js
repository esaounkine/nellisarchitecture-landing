const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {
  slugify, categoryHref, projectList, loadProjects, hashTarget, shouldRedirect, description,
  earlyScript,
} = require('../build/lib/projects');
const project = require('../build/lib/pages/project');
const { head } = require('../build/lib/chrome');
const { fill, loadPartial } = require('../build/lib/html');
const { renderPages } = require('../build/lib/pages');
const { sitemap, pruneProjects } = require('../build-news');

const ROOT = path.join(__dirname, '..');
const DOMAIN = 'https://nellisarchitecture.com';
const LIST = loadProjects(ROOT);
const byName = (name) => LIST.find((e) => e.name === name);
const projectUrl = (name) => byName(name).url;
const count = (s, sub) => s.split(sub).length - 1;
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'pages', 'site.json'), 'utf8'));
const renderEntry = (entry) => project.render(entry, { site, newsHref: '/news/n/' });

const proj = (over = {}) => ({
  title: 'X',
  project_rigth1: 'Palm Jumeirah',
  project_rigth2: 'Dubai, UAE',
  project_text_1: ['First &amp; text', 'Second'],
  project_text_2: ['Two'],
  project_text_3: [''],
  project_img2: ['/wp-content/uploads/i2.jpg'],
  project_type_set: ['Type:', 'Villa'],
  res2: ['architecture'],
  first_img_video: '/wp-content/uploads/hero.jpg',
  project_last_img: [],
  project_slider1: ['/wp-content/uploads/s1.jpg'],
  project_slider2: ['/wp-content/uploads/s2.jpg'],
  ...over,
});
const entry = (name, over) => projectList({ [name]: [proj(over)] })[0];

test('slugify lowercases and joins words with dashes', () => {
  assert.equal(slugify('W44'), 'w44');
  assert.equal(slugify('WEST LINKS'), 'west-links');
  assert.equal(slugify('Evergreens'), 'evergreens');
  assert.equal(slugify('Evergreens Hotel'), 'evergreens-hotel');
  assert.equal(slugify(' A & B! '), 'a-b');
});

test('projectList throws on a duplicate slug', () => {
  const twins = { 'Evergreens Hotel': [proj()], 'evergreens hotel': [proj()] };
  assert.throws(() => projectList(twins), /duplicate slug "evergreens-hotel"/);
  assert.throws(() => projectList({ '!!': [proj()] }), /duplicate slug ""/);
});

test('projectList throws on an unknown category', () => {
  const gardens = { A: [proj({ res2: ['gardens'] })] };
  assert.throws(() => projectList(gardens), /unknown category "gardens"/);
  assert.throws(() => projectList({ A: [proj({ res2: [] })] }), /unknown category/);
});

test('projectList maps the category aliases and the operator overrides', () => {
  assert.equal(entry('A', { res2: ['Master Development'] }).cat, 'master-planning');
  assert.equal(entry('A', { res2: ['interior design', 'architecture'] }).cat, 'interior-design');
  assert.equal(entry('Skye Residences', { res2: ['architecture'] }).cat, 'master-planning');
  assert.equal(
    entry('Evergreens Hotel', { res2: ['architecture'] }).url,
    '/projects/master-planning/evergreens-hotel/',
  );
});

test('the real data has 32 projects in the agreed categories', () => {
  assert.equal(LIST.length, 32);
  const cats = (cat) => LIST.filter((e) => e.cat === cat).map((e) => e.name).sort();
  assert.deepEqual(
    cats('master-planning'),
    ['Evergreens', 'Evergreens Hotel', 'Orel', 'Skye Residences', 'WEST LINKS'],
  );
  assert.deepEqual(cats('interior-design'), ['Lumeria', 'Solari']);
  assert.equal(cats('architecture').length, 25);
  assert.equal(projectUrl('W44'), '/projects/architecture/w44/');
});

test('categoryHref points at the category page', () => {
  assert.equal(categoryHref('architecture'), '/projects/architecture/');
  assert.equal(categoryHref('master-planning'), '/projects/master-planning/');
  assert.equal(categoryHref('interior-design'), '/projects/interior-design/');
});

test('description strips tags, decodes entities, collapses space and cuts at a word', () => {
  assert.equal(description('A &amp; B</br>\r\n\r\n C &#39;x&#x27; &nbsp;'), "A & B C 'x'");
  assert.equal(description(undefined), '');
  const long = `${'word '.repeat(40)}end`;
  const cut = description(long);
  assert.ok(cut.length <= 155);
  assert.ok(long.startsWith(cut));
  assert.match(cut, /word$/);
  assert.equal(description('aaaa bbbb, cccc', 11), 'aaaa bbbb');
});

test('project page has its own title, description, canonical and one og:image', () => {
  const html = renderEntry(entry('A "Q" <b>', {
    project_text_1: ['Say "hi" &amp; <br>bye'],
  }));
  const name = 'A "Q" &lt;b&gt;';
  const desc = 'Say &quot;hi&quot; &amp; bye';
  assert.ok(html.includes(`<title>${name} | Palm Jumeirah | Nellis Architecture</title>`));
  assert.ok(html.includes(`<meta name="description" content="${desc}" />`));
  assert.ok(html.includes(`<meta property="og:description" content="${desc}" />`));
  const url = `${DOMAIN}/projects/architecture/a-q-b/`;
  assert.ok(html.includes(`<link rel="canonical" href="${url}" />`));
  assert.ok(html.includes(`<meta property="og:url" content="${url}" />`));
  assert.equal(count(html, 'property="og:image'), 1);
  assert.ok(html.includes(
    `<meta property="og:image" content="${DOMAIN}/wp-content/uploads/hero.jpg">`,
  ));
  assert.ok(!html.includes('article:modified_time'));
  assert.ok(html.includes('alt="A &quot;Q&quot; &lt;b&gt;"'));
  assert.ok(html.includes(`font-weight: 200;">${name}</h2>`));
  assert.ok(!html.includes('{{'));
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/)[1]);
  assert.deepEqual(ld['@graph'].map((n) => n['@type']), ['WebPage', 'BreadcrumbList']);
  assert.equal(ld['@graph'][0].url, url);
});

test('title falls back to the region, then to the name only', () => {
  const noArea = proj({ project_rigth1: '' });
  assert.equal(project.title('W44', noArea), 'W44 | Dubai, UAE | Nellis Architecture');
  const noPlace = proj({ project_rigth1: '', project_rigth2: '' });
  assert.equal(project.title('N', noPlace), 'N | Nellis Architecture');
});

test('every project og:image exists on disk', () => {
  LIST.forEach((e) => {
    const src = project.ogImage(e.p).match(/content="([^"]+)"/)[1].slice(DOMAIN.length);
    assert.ok(fs.existsSync(path.join(ROOT, src)), `${e.name}: ${src}`);
  });
});

test('a video hero renders a video and og:image uses the first slide', () => {
  const html = renderEntry(entry('V', { first_img_video: '/wp-content/uploads/v.mp4' }));
  assert.ok(html.includes('<video autoplay muted loop playsinline>'
    + '<source src="/wp-content/uploads/v.mp4"'));
  assert.ok(html.includes(
    `<meta property="og:image" content="${DOMAIN}/wp-content/uploads/s1.jpg">`,
  ));
  assert.equal(project.ogImage(proj({ first_img_video: '/v.mp4', project_slider1: [] })), '');
});

test('empty and missing texts render no block and never "undefined"', () => {
  const tela = renderEntry(byName('Tela'));
  assert.ok(!tela.includes('undefined'));
  assert.equal(count(tela, 'class="currentProject_container projText2"'), 1);
  assert.equal(project.texts([''], 'projText3'), '');
  assert.ok(!project.texts(['a\r\n\r\nb'], 'x').includes('\r'));
  assert.equal(project.texts(undefined, 'projText3'), '');
  const html = renderEntry(entry('E', { project_text_2: [' ', ''], project_slider2: [] }));
  assert.ok(!html.includes('projText2'));
  assert.ok(!html.includes('projText3'));
  assert.equal((html.match(/<div class="swiper[" ]/g) || []).length, 1);
  assert.ok(!html.includes('undefined'));
});

test('slider2 gets curpadslide only when text 3 is empty', () => {
  assert.ok(renderEntry(entry('A')).includes('<div class="swiper curpadslide">'));
  assert.ok(!renderEntry(entry('A', { project_text_3: ['T3'] })).includes('curpadslide'));
});

test('typeSet renders label/value pairs and drops an odd last entry', () => {
  const set = Array.from({ length: 9 }, (v, i) => `v${i}`);
  assert.equal(count(project.typeSet(set), '<div class="item">'), 4);
  assert.ok(!project.typeSet(set).includes('v8'));
  assert.equal(project.typeSet([]), '');
  assert.equal(project.typeSet(undefined), '');
});

test('the page keeps the overlay order of blocks', () => {
  const html = renderEntry(entry('O', {
    project_text_3: ['T3'], project_last_img: ['/wp-content/uploads/last.jpg'],
  }));
  const order = [
    'hero.jpg', 's1.jpg', 'projText1', 'i2.jpg', 'projText2', 's2.jpg', 'projText3', 'last.jpg',
    'item-name',
  ];
  const at = order.map((s) => html.indexOf(s));
  at.forEach((i, n) => assert.ok(i > -1, order[n]));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
});

test('the breadcrumb links Home and the category page', () => {
  const html = renderEntry(byName('Orel'));
  assert.ok(html.includes('<a href="/">Home</a>'));
  assert.ok(html.includes('<span>Projects</span>'));
  assert.ok(html.includes('<a href="/projects/master-planning/">Master Planning</a>'));
  assert.ok(html.includes('"name":"Master Planning",'
    + `"item":"${DOMAIN}/projects/master-planning/"`));
  assert.ok(html.includes('<span aria-current="page">Orel</span>'));
});

const OLD_OG = [
  `  <meta property="og:image" content="${DOMAIN}/wp-content/themes/nellis/assets/img/minis.png">`,
  '  <meta property="og:image:width" content="968">',
  '  <meta property="og:image:height" content="504">',
].join('\n');

test('head without OG_IMAGE renders exactly the old head', () => {
  const values = {
    BEFORE: '',
    IDENTITY: '',
    TITLE: 'T',
    ROBOTS: 'R',
    DESCRIPTION: 'D',
    CANONICAL: 'C',
    OG_TYPE: 'website',
    OG_TITLE: 'OT',
    OG_DESCRIPTION: 'OD',
    OG_URL: 'OU',
    MODIFIED_TIME: 'M',
    SCHEMA: '{}',
  };
  const old = fill(loadPartial('head').replace('{{OG_IMAGE}}', OLD_OG)
    .replace('{{EARLY_SCRIPT}}', ''), values);
  assert.equal(head(values), old);
});

test('the other pages keep the default og:image', () => {
  renderPages(ROOT, '/news/x/').filter((p) => !p.file.startsWith('projects/')).forEach((p) => {
    assert.equal(count(p.html, 'property="og:image"'), 1, p.file);
    assert.ok(p.html.includes(OLD_OG), p.file);
  });
});

test('sitemap lists the project pages with priority 0.7', () => {
  const xml = sitemap([], [], LIST);
  assert.equal(count(xml, `<loc>${DOMAIN}/projects/`), 32);
  assert.ok(xml.includes(
    `<url><loc>${DOMAIN}/projects/architecture/zoya/</loc><priority>0.7</priority></url>`,
  ));
});

test('hashTarget finds the project for an old #proj= link', () => {
  const map = Object.fromEntries(LIST.map((e) => [e.name, e.url]));
  assert.equal(hashTarget('#proj=Zoya', map), '/projects/architecture/zoya/');
  assert.equal(
    hashTarget('#proj=evergreens%20hotel', map),
    '/projects/master-planning/evergreens-hotel/',
  );
  assert.equal(hashTarget('#proj=%20WEST LINKS%20', map), '/projects/master-planning/west-links/');
  assert.equal(hashTarget('#proj=%E0', map), null);
  assert.equal(hashTarget('#proj=Nope', map), null);
  assert.equal(hashTarget('#proj=', map), null);
  assert.equal(hashTarget('#architecture', map), null);
  assert.equal(hashTarget('', map), null);
});

test('shouldRedirect skips Back and Reload', () => {
  assert.equal(shouldRedirect('navigate'), true);
  assert.equal(shouldRedirect(undefined), true);
  assert.equal(shouldRedirect('reload'), false);
  assert.equal(shouldRedirect('back_forward'), false);
});

test('pruneProjects deletes only stale folders in projects/ and keeps categories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-'));
  const mk = (rel) => fs.mkdirSync(path.join(root, rel), { recursive: true });
  [
    'projects/architecture/zoya', 'projects/architecture/old', 'projects/landscape',
    'projects/gone/x', 'news/keep', 'projects-other/x',
  ].forEach(mk);
  fs.writeFileSync(path.join(root, 'projects', 'file.txt'), 'x');
  fs.writeFileSync(path.join(root, 'projects', 'landscape', 'index.html'), 'x');
  fs.writeFileSync(path.join(root, 'projects', 'architecture', 'index.html'), 'x');
  pruneProjects(root, [{ cat: 'architecture', slug: 'zoya' }]);
  const exists = (rel) => fs.existsSync(path.join(root, rel));
  assert.ok(exists('projects/architecture/zoya'));
  assert.ok(!exists('projects/architecture/old'));
  assert.ok(exists('projects/landscape/index.html'));
  assert.ok(exists('projects/architecture/index.html'));
  assert.ok(!exists('projects/gone'));
  assert.ok(exists('projects/file.txt'));
  assert.ok(exists('news/keep'));
  assert.ok(exists('projects-other/x'));
});

function runEarly(hash, navType) {
  const js = earlyScript(LIST).replace(/^\s*<script>|<\/script>\s*$/g, '');
  const went = [];
  vm.runInNewContext(js, {
    location: { hash, replace: (u) => went.push(u) },
    performance: { getEntriesByType: () => [{ type: navType }] },
    window: { performance: true },
  });
  return went;
}

test('the Home early script sends #proj= links to the project page, except on Back/Reload', () => {
  assert.deepEqual(runEarly('#proj=Evergreens%20Hotel', 'navigate'), [
    '/projects/master-planning/evergreens-hotel/',
  ]);
  assert.deepEqual(runEarly('#proj=Zoya', 'reload'), []);
  assert.deepEqual(runEarly('#proj=Zoya', 'back_forward'), []);
  assert.deepEqual(runEarly('#proj=%E0', 'navigate'), []);
  assert.deepEqual(runEarly('#architecture', 'navigate'), []);
});

test('only Home has the early script, before static-backend.js', () => {
  renderPages(ROOT, '/news/x/').forEach((p) => {
    const at = p.html.indexOf('hashTarget(location.hash');
    if (p.file === 'index.html') {
      assert.ok(at > -1 && at < p.html.indexOf('/js/static-backend.js'));
    } else {
      assert.equal(at, -1, p.file);
    }
  });
  assert.ok(!renderEntry(byName('Zoya')).includes('hashTarget'));
});

const LINK = new RegExp('<div class="project__item">\\s*'
  + '<a class="project__link no-prefetch" href="([^"]+)" aria-label="([^"]+)"></a>'
  + '[\\s\\S]*?<span class="project__name">([^<]+)</span>', 'g');
const links = (html) => [...html.matchAll(LINK)];

test('every Home grid item links to its project page', () => {
  const html = fs.readFileSync(path.join(ROOT, 'build/lib/partials/index-projects.html'), 'utf8');
  const found = links(html);
  assert.equal(count(html, '<div class="project__item">'), 32);
  assert.equal(found.length, 32);
  found.forEach(([, href, label, name]) => {
    assert.equal(href, projectUrl(name), name);
    assert.equal(label, name);
  });
});

test('every filter fragment item links to its project page', () => {
  const dir = path.join(ROOT, 'data', 'filters');
  fs.readdirSync(dir).forEach((f) => {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const found = links(html);
    assert.equal(found.length, count(html, '<div class="project__item">'), f);
    found.forEach(([, href, label, name]) => {
      assert.equal(href, projectUrl(name), `${f}: ${name}`);
      assert.equal(label, name);
    });
  });
});

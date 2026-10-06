/*
 * build-news.js — regenerates news pages from content/news/*.md
 * Runs automatically on Netlify after every CMS publish (see netlify.toml).
 * Zero dependencies: plain Node 20+.
 *
 *   node build-news.js
 *
 * What it does:
 *   1. Reads every markdown file in content/news/
 *   2. Renders news/<slug>/index.html from build/news-template.html
 *   3. Rebuilds the NewsList sidebar on every news page (newest first)
 *   4. Points the main-nav "News" link at the newest post
 *   5. Updates data/news.json (used by the in-page news switcher)
 *   6. Regenerates sitemap.xml
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const DOMAIN = 'https://nellisarchitecture.com';
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const ARROW_SVG = '<svg width="15" height="9" viewBox="0 0 15 9" fill="none" '
  + 'xmlns="http://www.w3.org/2000/svg"><path d="M14.3536 4.85355C14.5488 4.65829 14.5488 '
  + '4.34171 14.3536 4.14645L11.1716 0.964466C10.9763 0.769204 10.6597 0.769204 10.4645 '
  + '0.964466C10.2692 1.15973 10.2692 1.47631 10.4645 1.67157L13.2929 4.5L10.4645 '
  + '7.32843C10.2692 7.52369 10.2692 7.84027 10.4645 8.03553C10.2692 8.2308 10.9763 '
  + '8.2308 11.1716 8.03553L14.3536 4.85355Z" fill="currentColor"/></svg>';

/* ---------- tiny front-matter + markdown parser ---------- */
function parseFrontMatter(src, file = '') {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`bad front matter: ${file}`);
  const fm = {};
  m[1].split('\n').forEach((line) => {
    const kv = line.match(/^([a-z_]+):\s*("(?:[^"\\]|\\.)*"|.*)$/);
    if (!kv) return;
    let v = kv[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"');
    fm[kv[1]] = v;
  });
  return { fm, body: m[2].trim() };
}

function inlineMd(s) {
  return s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="lazyload" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function blockToHtml(b) {
  if (/^#{2,4}\s/.test(b)) {
    const level = b.match(/^(#{2,4})/)[1].length;
    return `<h${level}>${inlineMd(b.replace(/^#{2,4}\s*/, ''))}</h${level}>\n`;
  }
  if (b === '---') return '<hr />\n';
  if (/^(- )/m.test(b)) {
    const items = b.split('\n')
      .filter((l) => l.startsWith('- '))
      .map((l) => `<li>${inlineMd(l.slice(2))}</li>`)
      .join('');
    return `<ul>${items}</ul>\n`;
  }
  if (b.startsWith('> ')) return `<blockquote>${inlineMd(b.replace(/^>\s?/gm, ''))}</blockquote>\n`;
  if (/^<img /.test(inlineMd(b))) return `${inlineMd(b)}\n`;
  return `<p>${inlineMd(b.replace(/\n/g, ' '))}</p>\n`;
}

function mdToHtml(md) {
  return md.split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map(blockToHtml)
    .join('')
    .trim();
}

function parseDate(s) {
  const m = (s || '').match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return new Date(0);
  const month = Math.max(MONTHS.indexOf(m[1].toLowerCase()), 0);
  return new Date(Date.UTC(+m[3], month, +m[2]));
}

function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function idNum(p) {
  const n = parseInt(p.id, 10);
  return Number.isNaN(n) ? 0 : n;
}

/* ---------- NewsList markup (matches original theme) ---------- */
function newsList(posts) {
  return posts.map((p) => `                  <div class="NewsListItem"
            style="cursor: pointer;"
            data-id="${p.id}"
            data-slug="${p.slug}"
            data-permalink="../${p.slug}/index.html">
            <div class="NewsListData">${p.date || ''}</div>
            <h3 class="NewsListTitle">
              ${p.title}            </h3>
          </div>`).join('\n');
}

function loadPosts(dir) {
  const posts = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const file = path.join(dir, f);
    const { fm, body } = parseFrontMatter(fs.readFileSync(file, 'utf8'), file);
    if (!fm.id) fm.id = `md${fm.slug}`;
    fm.html = mdToHtml(body);
    fm.dateObj = parseDate(fm.date);
    return fm;
  });
  return posts.sort((a, b) => (b.dateObj - a.dateObj) || (idNum(b) - idNum(a)));
}

function articleSchema(p) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: p.title,
        description: p.description || '',
        datePublished: p.dateObj.toISOString(),
        dateModified: p.dateObj.toISOString(),
        mainEntityOfPage: `${DOMAIN}/news/${p.slug}/`,
        author: { '@type': 'Organization', name: 'Nellis Architecture' },
        publisher: { '@type': 'Organization', name: 'Nellis Architecture' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/`,
          },
          { '@type': 'ListItem', position: 2, name: 'News' },
          { '@type': 'ListItem', position: 3, name: p.title }],
      },
    ],
  });
}

function renderPost(template, p, list) {
  const newsImg = p.hero
    ? `<div class="NewsImg">\n            <img src="${p.hero}" alt="${esc(p.hero_alt || p.title)}" `
      + 'class="lazyload">\n          </div>'
    : '<div class="NewsImg" style="display: none;">\n          </div>';
  const newsBtn = p.link
    ? `<a target="_blank" href="${p.link}" class="NewsBtn">MORE INFO ${ARROW_SVG}</a>`
    : '<a href="../../index.html" class="NewsBtn"></a>';

  return template
    .replaceAll('{{SEO_TITLE}}', esc(p.seo_title || `${p.title} | Nellis Architecture`))
    .replaceAll('{{META_DESC}}', esc(p.description || ''))
    .replace(/\{\{SLUG\}\}/g, p.slug)
    .replaceAll('{{OG_TITLE}}', esc(p.seo_title || p.title))
    .replaceAll('{{OG_DESC}}', esc(p.description || ''))
    .replaceAll('{{MOD_TIME}}', p.dateObj.toISOString())
    .replaceAll('{{SCHEMA}}', articleSchema(p))
    .replaceAll('{{NEWS_IMG}}', newsImg)
    .replaceAll('{{TITLE}}', p.title)
    .replaceAll('{{DATE}}', p.date || '')
    .replaceAll('{{CONTENT}}', `\n${p.html}\n        `)
    .replaceAll('{{NEWS_BTN}}', newsBtn)
    .replaceAll('{{NEWSLIST}}', list);
}

function newsJsonEntry(p) {
  return {
    success: true,
    data: {
      title: p.title,
      content: p.html,
      data: p.date || '',
      img: p.hero || '',
      imgalt: p.hero_alt || p.title,
      link: p.link || '',
      slug: p.slug,
    },
  };
}

function sitemap(posts) {
  const urls = [
    { loc: `${DOMAIN}/`, pr: '1.0' },
    { loc: `${DOMAIN}/studio/`, pr: '0.8' },
    { loc: `${DOMAIN}/people/`, pr: '0.8' },
    { loc: `${DOMAIN}/privacy/`, pr: '0.2' },
    ...posts.map((p) => ({
      loc: `${DOMAIN}/news/${p.slug}/`, pr: '0.6', lastmod: p.dateObj.toISOString().slice(0, 10),
    })),
  ];
  const rows = urls.map((u) => {
    const lastmod = u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : '';
    return `  <url><loc>${u.loc}</loc>${lastmod}<priority>${u.pr}</priority></url>`;
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + `${rows.join('\n')}\n</urlset>\n`;
}

function build() {
  const posts = loadPosts(path.join(ROOT, 'content', 'news'));
  if (!posts.length) {
    console.log('no posts');
    return;
  }
  const list = newsList(posts);

  /* ---------- per-post page ---------- */
  const template = fs.readFileSync(path.join(ROOT, 'build', 'news-template.html'), 'utf8');
  const newsJson = {};
  posts.forEach((p) => {
    const outDir = path.join(ROOT, 'news', p.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), renderPost(template, p, list));
    newsJson[p.id] = newsJsonEntry(p);
  });

  /* ---------- refresh NewsList inside every news page (incl. untouched ones) ---------- */
  const newsRoot = path.join(ROOT, 'news');
  fs.readdirSync(newsRoot)
    .map((d) => path.join(newsRoot, d, 'index.html'))
    .filter((f) => fs.existsSync(f))
    .forEach((f) => {
      const src = fs.readFileSync(f, 'utf8');
      const i = src.indexOf('<div class="NewsList">');
      const j = src.indexOf('<div class="elscroll"></div>', i);
      if (i > -1 && j > i) {
        const head = `${src.slice(0, i)}<div class="NewsList">\n`;
        fs.writeFileSync(f, `${head}${list}\n                ${src.slice(j)}`);
      }
    });

  /* ---------- nav "News" link -> newest post ---------- */
  const newest = posts[0];
  const indexFile = path.join(ROOT, 'index.html');
  const idx = fs.readFileSync(indexFile, 'utf8').replace(
    /(<a[^>]*href=")news\/[^"]*\/index\.html("[^>]*>\s*News\s*<\/a>)/,
    `$1news/${newest.slug}/index.html$2`,
  );
  fs.writeFileSync(indexFile, idx);

  fs.writeFileSync(path.join(ROOT, 'data', 'news.json'), JSON.stringify(newsJson));
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap(posts));

  console.log(`built ${posts.length} news pages; newest: ${newest.slug}`);
}

if (require.main === module) build();

module.exports = {
  parseFrontMatter, inlineMd, mdToHtml, parseDate, esc, idNum, sitemap,
};

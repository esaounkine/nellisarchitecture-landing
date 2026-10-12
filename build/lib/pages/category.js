const fs = require('node:fs');
const path = require('node:path');
const {
  escText, escAttr, fill, loadPartial,
} = require('../html');
const {
  head, top, affiliations, footer,
} = require('../chrome');
const { DOMAIN, pageUrl, seoTokens } = require('../seo');
const { CATEGORIES, inCategory } = require('../projects');

/* Home grid thumbnails: data/search.json minImg, by project title. */
function thumbs(root) {
  const list = JSON.parse(fs.readFileSync(path.join(root, 'data', 'search.json'), 'utf8'));
  return Object.fromEntries(list.map((s) => [s.title, s.minImg]));
}

/* Projects of the category, in data/projects.json order. */
function members(projects, cat) {
  const list = projects.filter((e) => inCategory(e, cat));
  if (!list.length) throw new Error(`projects/${cat}/: no project in this category`);
  return list;
}

/* An empty line (Atelier, W44, Zephyr have no area) gets no <br>. */
function location(p) {
  return [p.project_rigth1, p.project_rigth2]
    .filter((t) => t && t.trim())
    .map(escText)
    .join(` <br>\n${' '.repeat(28)}`);
}

function items(list, thumb) {
  const tpl = loadPartial('category-item');
  return list.map((e) => {
    if (!thumb[e.name]) throw new Error(`data/search.json: ${e.name}: no minImg`);
    return fill(tpl, {
      HREF: escAttr(e.url),
      NAME_ATTR: escAttr(e.name),
      IMG: escAttr(thumb[e.name]),
      NAME: escText(e.name),
      LOCATION: location(e.p),
    });
  }).join('\n');
}

function schema(url, name, desc, label) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': url,
        url,
        name,
        description: desc,
        isPartOf: { '@id': `${DOMAIN}/#website` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        inLanguage: 'en-US',
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/`,
          },
          { '@type': 'ListItem', position: 2, name: label },
        ],
      },
    ],
  }).replace(/</g, '\\u003c');
}

function render(content, {
  site, newsHref, page, root, projects,
}) {
  const { label } = CATEGORIES[page.category];
  const list = members(projects, page.category);
  const thumb = thumbs(root);
  const seo = content.seo || {};
  const headHtml = head({
    BEFORE: '',
    IDENTITY: '',
    OG_IMAGE: `  <meta property="og:image" content="${escAttr(DOMAIN + thumb[list[0].name])}">`,
    OG_TYPE: 'website',
    MODIFIED_TIME: '',
    SCHEMA: schema(pageUrl(page.slug), seo.title || content.h1, seo.description || '', label),
    ...seoTokens(content, page),
  // Shortcut: no dates, so drop the empty modified_time line (as on project pages).
  // Upgrade: a head token for the whole line.
  }).replace('\t<meta property="article:modified_time" content="" />\n', '');
  return [
    headHtml,
    top(content.h1, site),
    fill(loadPartial('page-category'), {
      NEWS_HREF: escAttr(newsHref),
      AFFILIATIONS: affiliations(site.affiliations, '    '),
      LABEL: escText(label),
      H1: escText(content.h1),
      INTRO: escText(content.intro),
      ITEMS: items(list, thumb),
    }),
    footer(),
  ].join('\n');
}

module.exports = {
  render, members, location,
};

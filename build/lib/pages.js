const fs = require('node:fs');
const path = require('node:path');
// eslint-disable-next-line import-x/no-useless-path-segments -- Home page module
const index = require('./pages/index');
const privacy = require('./pages/privacy');
const studio = require('./pages/studio');
const people = require('./pages/people');

/* slug is fixed in code: the page URL is /<slug>/ (Home: /). */
const PAGES = [
  {
    slug: '', content: 'index', module: index, priority: '1.0',
  },
  {
    slug: 'studio', content: 'studio', module: studio, priority: '0.8',
  },
  {
    slug: 'people', content: 'people', module: people, priority: '0.8',
  },
  {
    slug: 'privacy', content: 'privacy', module: privacy, priority: '0.2',
  },
];

const pageFile = (slug) => (slug ? `${slug}/index.html` : 'index.html');

function readContent(root, name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'content', 'pages', `${name}.json`), 'utf8'));
}

/* Each result also carries what the sitemap needs: slug, priority, noindex. */
function renderPages(root, newsHref) {
  const site = readContent(root, 'site');
  return PAGES.map((p) => {
    const content = readContent(root, p.content);
    return {
      file: pageFile(p.slug),
      html: p.module.render(content, { site, newsHref, page: p }),
      slug: p.slug,
      priority: p.priority,
      noindex: Boolean(content.seo && content.seo.noindex),
    };
  });
}

function writePages(root, newsHref) {
  const pages = renderPages(root, newsHref);
  pages.forEach((p) => {
    fs.mkdirSync(path.dirname(path.join(root, p.file)), { recursive: true });
    fs.writeFileSync(path.join(root, p.file), p.html);
  });
  return pages;
}

module.exports = { PAGES, renderPages, writePages };

const fs = require('node:fs');
const path = require('node:path');
// eslint-disable-next-line import-x/no-useless-path-segments -- Home page module
const index = require('./pages/index');
const privacy = require('./pages/privacy');
const studio = require('./pages/studio');
const people = require('./pages/people');
const category = require('./pages/category');
const { CATEGORY_KEYS, loadProjects } = require('./projects');

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
  {
    slug: 'projects', content: 'projects', module: category, priority: '0.7', category: 'all',
  },
  ...CATEGORY_KEYS.map((cat) => ({
    slug: `projects/${cat}`,
    content: `projects-${cat}`,
    module: category,
    priority: '0.7',
    category: cat,
  })),
];

const pageFile = (slug) => (slug ? `${slug}/index.html` : 'index.html');

function readContent(root, name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'content', 'pages', `${name}.json`), 'utf8'));
}

/* Each result also carries what the sitemap needs: slug, priority, noindex.
   projects: loadProjects() result, read once by the build. */
function renderPages(root, newsHref, projects = loadProjects(root)) {
  const site = readContent(root, 'site');
  return PAGES.map((p) => {
    const content = readContent(root, p.content);
    return {
      file: pageFile(p.slug),
      html: p.module.render(content, {
        site, newsHref, page: p, root, projects,
      }),
      slug: p.slug,
      priority: p.priority,
      noindex: Boolean(content.seo && content.seo.noindex),
    };
  });
}

function writePages(root, newsHref, projects) {
  const pages = renderPages(root, newsHref, projects);
  pages.forEach((p) => {
    fs.mkdirSync(path.dirname(path.join(root, p.file)), { recursive: true });
    fs.writeFileSync(path.join(root, p.file), p.html);
  });
  return pages;
}

module.exports = { PAGES, renderPages, writePages };

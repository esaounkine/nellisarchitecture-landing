const fs = require('node:fs');
const path = require('node:path');
// eslint-disable-next-line import-x/no-useless-path-segments -- Home page module
const index = require('./pages/index');
const privacy = require('./pages/privacy');
const studio = require('./pages/studio');
const people = require('./pages/people');

/* slug is fixed in code: the page URL is /<slug>/ (Home: /). */
const PAGES = [
  { slug: '', content: 'index', module: index },
  { slug: 'privacy', content: 'privacy', module: privacy },
  { slug: 'studio', content: 'studio', module: studio },
  { slug: 'people', content: 'people', module: people },
];

const pageFile = (slug) => (slug ? `${slug}/index.html` : 'index.html');

function readContent(root, name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'content', 'pages', `${name}.json`), 'utf8'));
}

function renderPages(root, newsHref) {
  const ctx = { site: readContent(root, 'site'), newsHref };
  return PAGES.map((p) => ({
    file: pageFile(p.slug),
    html: p.module.render(readContent(root, p.content), ctx),
  }));
}

function writePages(root, newsHref) {
  renderPages(root, newsHref).forEach((p) => {
    fs.mkdirSync(path.dirname(path.join(root, p.file)), { recursive: true });
    fs.writeFileSync(path.join(root, p.file), p.html);
  });
}

module.exports = { PAGES, renderPages, writePages };

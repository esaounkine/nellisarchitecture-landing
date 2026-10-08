const fs = require('node:fs');
const path = require('node:path');
// eslint-disable-next-line import-x/no-useless-path-segments -- Home page module
const index = require('./pages/index');
const privacy = require('./pages/privacy');

/* pravicy.html is the old typo URL. It gets the privacy render until yGn1v4co removes it (D7). */
const PAGES = [
  { file: 'index.html', content: 'index', module: index },
  { file: 'privacy.html', content: 'privacy', module: privacy },
  { file: 'pravicy.html', content: 'privacy', module: privacy },
];

function readContent(root, name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'content', 'pages', `${name}.json`), 'utf8'));
}

function renderPages(root, newsHref) {
  const ctx = { site: readContent(root, 'site'), newsHref };
  return PAGES.map((p) => ({
    file: p.file,
    html: p.module.render(readContent(root, p.content), ctx),
  }));
}

function writePages(root, newsHref) {
  renderPages(root, newsHref).forEach((p) => fs.writeFileSync(path.join(root, p.file), p.html));
}

module.exports = { PAGES, renderPages, writePages };

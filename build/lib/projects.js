/* eslint no-unused-vars: ["error", { "caughtErrors": "none" }] -- see hashTarget */
const fs = require('node:fs');
const path = require('node:path');

/* res2[0] in data/projects.json -> URL category. */
const CATEGORY_ALIAS = {
  architecture: 'architecture',
  'interior design': 'interior-design',
  landscape: 'landscape',
  'master planning': 'master-planning',
  'Master Development': 'master-planning',
};

/* Operator decision 2026-10-12 (card bIt7J6zk): these projects belong to master planning. */
const CATEGORY_OVERRIDE = {
  'Skye Residences': 'master-planning',
  'Evergreens Hotel': 'master-planning',
};

const CATEGORIES = {
  architecture: { label: 'Architecture' },
  'interior-design': { label: 'Interior Design' },
  landscape: { label: 'Landscape' },
  'master-planning': { label: 'Master Planning' },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const categoryHref = (cat) => `/projects/${cat}/`;

function category(name, p) {
  const raw = (p.res2 || [])[0];
  const cat = CATEGORY_OVERRIDE[name] || CATEGORY_ALIAS[raw];
  if (!cat) throw new Error(`data/projects.json: ${name}: unknown category "${raw}"`);
  return cat;
}

/* Primary category (after overrides), or a secondary one in res2[1..]. */
function inCategory(entry, cat) {
  if (entry.cat === cat) return true;
  if (CATEGORY_OVERRIDE[entry.name]) return false;
  return (entry.p.res2 || []).slice(1).some((raw) => CATEGORY_ALIAS[raw] === cat);
}

/* data: the projects.json object, name -> [project]. */
function projectList(data) {
  const seen = new Set();
  return Object.entries(data).map(([name, [p]]) => {
    const slug = slugify(name);
    if (!slug || seen.has(slug)) {
      throw new Error(`data/projects.json: ${name}: duplicate slug "${slug}"`);
    }
    seen.add(slug);
    const cat = category(name, p);
    return {
      name, p, slug, cat, url: `/projects/${cat}/${slug}/`,
    };
  });
}

function loadProjects(root) {
  return projectList(JSON.parse(fs.readFileSync(path.join(root, 'data', 'projects.json'), 'utf8')));
}

/* Runs in the browser too (earlyScript): keep it self-contained ES2015.
   Bad encoding (URIError) means no target. */
function hashTarget(hash, map) {
  if (typeof hash !== 'string' || hash.indexOf('#proj=') !== 0) return null;
  let name;
  try {
    name = decodeURIComponent(hash.slice(6)).trim().toLowerCase();
  } catch (err) {
    return null;
  }
  const key = Object.keys(map).find((k) => k.toLowerCase() === name);
  return key ? map[key] : null;
}

/* Back/Reload keep the overlay, so the visitor can return to the Home grid. */
function shouldRedirect(navType) {
  return navType !== 'reload' && navType !== 'back_forward';
}

/* Home only: sends old /#proj=<Name> links to the project page
   before the theme opens the overlay. */
function earlyScript(list) {
  const map = Object.fromEntries(list.map((e) => [e.name, e.url]));
  return [
    '  <script>',
    '    (function () {',
    `      var map = ${JSON.stringify(map).replace(/</g, '\\u003c')};`,
    `      ${hashTarget}`,
    `      ${shouldRedirect}`,
    '      var nav = window.performance && performance.getEntriesByType',
    "        ? performance.getEntriesByType('navigation')[0] : null;",
    '      var url = hashTarget(location.hash, map);',
    '      if (url && shouldRedirect(nav && nav.type)) location.replace(url);',
    '    }());',
    '  </script>',
    '',
  ].join('\n');
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] !== '#') return ENTITIES[e.toLowerCase()] || m;
    const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

/* Plain text from the project HTML, cut at a word boundary. Not escaped. */
function description(html, max = 155) {
  const text = decodeEntities(String(html || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const end = cut.lastIndexOf(' ');
  return (end > 0 ? cut.slice(0, end) : text.slice(0, max)).replace(/[\s,;:]+$/, '');
}

module.exports = {
  CATEGORIES,
  CATEGORY_KEYS,
  slugify,
  categoryHref,
  inCategory,
  projectList,
  loadProjects,
  hashTarget,
  shouldRedirect,
  earlyScript,
  decodeEntities,
  description,
};

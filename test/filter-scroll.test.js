const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PARTIAL = fs.readFileSync(
  path.join(__dirname, '..', 'build', 'lib', 'partials', 'index-projects.html'),
  'utf8',
);

/* The source of `function name() { ... }` from the partial, by brace count. */
function fnSource(name) {
  const start = PARTIAL.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `index-projects.html has no function ${name}`);
  let depth = 0;
  for (let i = PARTIAL.indexOf('{', start); i < PARTIAL.length; i += 1) {
    if (PARTIAL[i] === '{') depth += 1;
    if (PARTIAL[i] === '}') depth -= 1;
    if (depth === 0) return PARTIAL.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

function listeners() {
  const on = {};
  return {
    on,
    addEventListener(type, fn) {
      (on[type] = on[type] || []).push(fn);
    },
    fire(type) {
      (on[type] || []).splice(0).forEach((fn) => fn());
    },
  };
}

/* A project page column: thumbs at the given offsets, `open` is the page's own project. */
function page({ open = '/projects/architecture/miraia/', wide = true, loaded = false } = {}) {
  const items = [
    { href: '/projects/architecture/zoya/', offsetTop: 148 },
    { href: '/projects/architecture/miraia/', offsetTop: 1072 },
  ];
  const links = items.map((it) => ({ getAttribute: () => it.href, parentNode: it }));
  const imgs = items.map(() => ({ complete: loaded, ...listeners() }));
  const Projects = { scrollTop: 0, ...listeners() };
  const document = {
    querySelector: (s) => (s === '.center .container .project__item' ? items[0] : null),
    querySelectorAll: (s) => ({
      '.center .container .project__link': links,
      '.center .container img': imgs,
    })[s] || [],
  };
  const ctx = {
    Projects, document, location: { pathname: open }, matchMedia: () => ({ matches: wide }),
  };
  const src = `${fnSource('currentOffset')}\n${fnSource('showCurrent')}`;
  vm.runInNewContext(`${src}\nthis.showCurrent = showCurrent;`, ctx);
  return { ...ctx, items, imgs };
}

test('a filter swap scrolls the column to the open project', () => {
  const p = page();
  p.showCurrent();
  assert.equal(p.Projects.scrollTop, 1072 - 148);
});

test('the column follows the thumbs as their images load', () => {
  const p = page();
  p.showCurrent();
  p.items[1].offsetTop = 2000;
  p.imgs[0].fire('load');
  assert.equal(p.Projects.scrollTop, 2000 - 148);
});

test('the column stops following after the visitor scrolls', () => {
  ['wheel', 'touchstart'].forEach((type) => {
    const p = page();
    p.showCurrent();
    p.Projects.fire(type);
    p.items[1].offsetTop = 2000;
    p.imgs[0].fire('load');
    assert.equal(p.Projects.scrollTop, 1072 - 148, type);
  });
});

test('loaded images get no listener', () => {
  const p = page({ loaded: true });
  p.showCurrent();
  assert.deepEqual(p.imgs.map((img) => Object.keys(img.on).length), [0, 0]);
});

test('no open project (Home) or a narrow screen: the column starts at the top', () => {
  [{ open: '/' }, { wide: false }].forEach((opts) => {
    const p = page(opts);
    p.Projects.scrollTop = 500;
    p.showCurrent();
    assert.equal(p.Projects.scrollTop, 0);
  });
});

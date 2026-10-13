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

/* The project page marks: from `const gridLinks` to the end of markCurrent. */
function marksSource() {
  return PARTIAL.slice(PARTIAL.indexOf('const gridLinks'), PARTIAL.indexOf('function markCurrent('))
    + fnSource('markCurrent');
}

function thumb(href, own) {
  const attrs = { class: 'project__link no-prefetch', href, 'aria-label': href };
  if (own) attrs['aria-current'] = 'page';
  const link = {
    attrs,
    getAttribute: (n) => (n in attrs ? attrs[n] : null),
    setAttribute: (n, v) => {
      attrs[n] = String(v);
    },
    removeAttribute: (n) => {
      delete attrs[n];
    },
    getAttributeNames: () => Object.keys(attrs),
    get attributes() {
      return Object.entries(attrs).map(([name, value]) => ({ name, value }));
    },
  };
  const pl = { className: own ? 'projectPL PLoppened' : 'projectPL' };
  const item = {
    link,
    pl,
    className: own ? 'project__item' : 'project__item zeroOpac',
    querySelector: (s) => ({ '.project__link': link, '.projectPL': pl })[s],
  };
  link.parentNode = item;
  return item;
}

test('a project switch marks only the new open project', () => {
  const zephyr = '/projects/architecture/zephyr/';
  const w44 = '/projects/architecture/w44/';
  const zoya = '/projects/architecture/zoya/';
  const items = [thumb(zoya, false), thumb(zephyr, true), thumb(w44, false)];
  const on = {};
  const location = { pathname: zephyr };
  const document = {
    addEventListener: (type, fn) => {
      on[type] = fn;
    },
    querySelectorAll: (s) => ({
      '.center .container .project__link': items.map((it) => it.link),
      '.center .container .project__item': items,
    })[s] || [],
  };
  vm.runInNewContext(`${marksSource()}\nthis.markCurrent = markCurrent;`, { document, location });
  location.pathname = w44;
  assert.equal(typeof on['nellis:projectswitch'], 'function', 'markCurrent listens for a switch');
  on['nellis:projectswitch']();
  assert.deepEqual(
    items.map((it) => it.className),
    ['project__item zeroOpac', 'project__item zeroOpac', 'project__item'],
  );
  const pls = items.map((it) => it.pl.className);
  assert.deepEqual(pls, ['projectPL', 'projectPL', 'projectPL PLoppened']);
  const marks = items.map((it) => it.link.attrs['aria-current']);
  assert.deepEqual(marks, [undefined, undefined, 'page']);
  assert.deepEqual(items.map((it) => it.link.attrs.href), [zoya, zephyr, w44]);
  assert.equal(items[2].link.attrs['aria-label'], w44, 'the link keeps its own label');
});

/* loadFilter with a stub XHR: `reply()` delivers the filtered list. */
function filter() {
  const log = [];
  const first = { getAttribute: () => '/projects/master-planning/evergreens/' };
  const container = {
    set innerHTML(v) {
      log.push(['swap']);
    },
  };
  const Projects = {
    set scrollTop(v) {
      log.push(['scrollTop', v]);
    },
  };
  const document = {
    querySelector: (s) => ({
      '.center .container': container,
      '.center .container a.project__link': first,
      '.allproject': {},
    })[s] || null,
    querySelectorAll: () => [],
    dispatchEvent: (ev) => log.push(['event', ev.type, { ...ev.detail }]),
  };
  let xhr;
  function XMLHttpRequest() {
    xhr = this;
    Object.assign(this, { open() {}, setRequestHeader() {}, send() {} });
  }
  XMLHttpRequest.DONE = 4;
  function CustomEvent(type, init) {
    Object.assign(this, { type, detail: init.detail });
  }
  const ctx = {
    Projects,
    document,
    XMLHttpRequest,
    CustomEvent,
    currentUrl: 'master planning',
    currentSub: 1,
    setTimeout: () => {},
    saveFilter: () => {},
    markCurrent: () => log.push(['markCurrent']),
    showCurrent: () => log.push(['showCurrent']),
    fitScroll: () => log.push(['fitScroll']),
  };
  vm.runInNewContext(`${fnSource('loadFilter')}\nthis.loadFilter = loadFilter;`, ctx);
  const reply = () => {
    Object.assign(xhr, { readyState: 4, status: 200, responseText: '' });
    xhr.onreadystatechange();
  };
  return { ...ctx, log, reply };
}

test('a menu click puts the column at the top and picks the first project', () => {
  const f = filter();
  f.loadFilter(true);
  f.reply();
  assert.deepEqual(f.log, [
    ['swap'], ['fitScroll'], ['markCurrent'], ['scrollTop', 0],
    ['event', 'nellis:filterpick', { href: '/projects/master-planning/evergreens/' }],
  ]);
});

test('an empty list picks no project', () => {
  const f = filter();
  const { querySelector } = f.document;
  f.document.querySelector = (s) => (s.endsWith('a.project__link') ? null : querySelector(s));
  f.loadFilter(true);
  f.reply();
  assert.deepEqual(f.log.at(-1), ['event', 'nellis:filterpick', { href: null }]);
});

test('the saved filter on load keeps the open project in view and picks nothing', () => {
  const f = filter();
  f.loadFilter();
  f.reply();
  assert.deepEqual(f.log, [['swap'], ['fitScroll'], ['markCurrent'], ['showCurrent']]);
});

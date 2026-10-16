const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'static-backend.js'), 'utf8');

function load(gridHtml, { thumbSizes = null, file = null } = {}) {
  const listeners = {};
  const grid = {
    innerHTML: gridHtml,
    querySelector: (sel) => (gridHtml.includes(sel.slice(1)) ? {} : null),
  };
  const fetched = [];
  const window = {
    XMLHttpRequest() {},
    fetch: (url) => {
      fetched.push(url);
      return Promise.resolve({ ok: true, text: () => Promise.resolve(file || `file:${url}`) });
    },
  };
  const document = {
    addEventListener: (ev, fn) => {
      listeners[ev] = fn;
    },
    querySelector: (sel) => {
      if (sel === '.center .container') return grid;
      const thumb = thumbSizes && { getAttribute: () => thumbSizes };
      return sel === '.centerMini .project__item img[sizes]' ? thumb : null;
    },
  };
  vm.runInNewContext(SRC, { window, document, URLSearchParams });
  listeners.DOMContentLoaded();
  const ask = (currentUrl) => new Promise((resolve) => {
    const xhr = new window.XMLHttpRequest();
    xhr.open('POST', '/wp-admin/admin-ajax.php');
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) resolve(xhr.responseText);
    };
    const url = encodeURIComponent(currentUrl);
    xhr.send(`action=get_filtered_projects&currentUrl=${url}&residentalCommercialIF=1`);
  });
  return { ask, fetched };
}

test('the All filter returns the Home grid, not the empty WordPress answer', async () => {
  const { ask, fetched } = load('<div class="project__item">Zoya</div>');
  assert.equal(await ask('All'), '<div class="project__item">Zoya</div>');
  assert.equal(await ask(''), '<div class="project__item">Zoya</div>');
  assert.deepEqual(fetched, []);
});

test('other filters still load their fragment file', async () => {
  const { ask } = load('<div class="project__item">Zoya</div>');
  assert.equal(await ask('master planning'), 'file:/data/filters/master_planning_1.html');
});

test('the All filter falls back to the file on a page with no grid', async () => {
  const { ask } = load('<p>no projects</p>');
  assert.equal(await ask('All'), 'file:/data/filters/all_1.html');
});

const FRAGMENT = '<picture><source type="image/avif" srcset="a.avif 320w" sizes="CARD">'
  + '<img src="a.jpg" sizes="CARD" alt=""></picture>';

test('a filter fragment keeps its card sizes on Home', async () => {
  const { ask } = load('<div class="project__item">Zoya</div>', { file: FRAGMENT });
  assert.equal(await ask('master planning'), FRAGMENT);
});

test('a filter fragment gets the thumb sizes of the project page column', async () => {
  const { ask } = load('<div class="project__item">Zoya</div>', {
    thumbSizes: '(max-width: 980px) 100vw, "x" & 155px', file: FRAGMENT,
  });
  const thumb = '(max-width: 980px) 100vw, &quot;x&quot; &amp; 155px';
  assert.equal(await ask('master planning'), FRAGMENT.replace(/CARD/g, thumb));
});

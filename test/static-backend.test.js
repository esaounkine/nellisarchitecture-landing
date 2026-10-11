const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'static-backend.js'), 'utf8');

function load(gridHtml) {
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
      return Promise.resolve({ ok: true, text: () => Promise.resolve(`file:${url}`) });
    },
  };
  const document = {
    addEventListener: (ev, fn) => {
      listeners[ev] = fn;
    },
    querySelector: (sel) => (sel === '.center .container' ? grid : null),
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

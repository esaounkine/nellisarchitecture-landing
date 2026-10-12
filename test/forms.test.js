const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const pagesIn = (dir) => fs.readdirSync(path.join(ROOT, dir), { recursive: true })
  .filter((f) => path.basename(f) === 'index.html')
  .map((f) => path.join(dir, f));
const PAGES = ['index.html', 'studio/index.html', 'people/index.html', 'privacy/index.html',
  'contact/index.html', ...pagesIn('news'), ...pagesIn('projects')];
const SOURCES = ['build/lib/partials/footer.html', 'build/news-template.html'];
const count = (s, sub) => s.split(sub).length - 1;
const forms = (html) => html.match(/<form[^>]*data-netlify="true"[\s\S]*?<\/form>/g) || [];

test('no page or source posts a form to WordPress', () => {
  [...SOURCES, ...PAGES].forEach((file) => {
    const html = read(file);
    assert.ok(!html.includes('callback_form'), file);
    assert.ok(!html.includes('id="nonce"'), file);
  });
});

test('the modal form scripts post to Netlify Forms with the form name', () => {
  SOURCES.forEach((file) => {
    const html = read(file);
    assert.equal(count(html, "formData.append('form-name', form.getAttribute('name'));"), 2, file);
    assert.equal(count(html, "fetch('/', { method: 'POST', body: formData })"), 2, file);
  });
});

test('every Netlify form has a honeypot field; the brief form sends files', () => {
  PAGES.forEach((file) => {
    const found = forms(read(file));
    assert.ok(found.length >= 2, file);
    found.forEach((form) => {
      assert.ok(form.includes('netlify-honeypot="bot-field"'), file);
      assert.ok(form.includes('<input name="bot-field">'), file);
      if (form.includes('name="brief"')) {
        assert.ok(form.includes('enctype="multipart/form-data"'), file);
      }
    });
  });
});

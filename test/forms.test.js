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

test('the brief form sends each attachment in its own field', () => {
  const inputs = [1, 2, 3, 4, 5].map((i) => `<input type="file" name="file${i}">`).join('');
  const hidden = `<div hidden>${inputs}</div>`;
  PAGES.forEach((file) => {
    const brief = forms(read(file)).find((f) => f.includes('name="brief"'));
    assert.ok(brief.replace(/\s+/g, '').includes(hidden.replace(/\s+/g, '')), file);
  });
  SOURCES.forEach((file) => {
    const html = read(file);
    assert.ok(html.includes("['files[]', 'file1', 'file2', 'file3', 'file4', 'file5']"), file);
    assert.ok(html.includes('formData.delete(name);'), file);
    assert.ok(html.includes("formData.append('file' + (i + 1), file);"), file);
    assert.ok(html.includes('.slice(0, 5)'), file);
    assert.ok(html.includes("alert('Files are too large (8 MB total).');"), file);
  });
});

test('the theme keeps the file input in step with its file list', () => {
  const js = read('wp-content/themes/nellis/assets/JS/modal.js');
  assert.equal(count(js, 'syncInput();'), 2);
  assert.ok(js.includes("fileInput.form.addEventListener('reset'"));
});

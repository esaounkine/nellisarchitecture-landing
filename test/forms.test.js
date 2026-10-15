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
const forms = (html) => html.match(/<form[\s\S]*?<\/form>/g) || [];

test('no page or source posts a form to WordPress', () => {
  [...SOURCES, ...PAGES].forEach((file) => {
    const html = read(file);
    assert.ok(!html.includes('callback_form'), file);
    assert.ok(!html.includes('id="nonce"'), file);
  });
});

test('every page loads js/forms.js once and has no inline form script', () => {
  [...SOURCES, ...PAGES].forEach((file) => {
    const html = read(file);
    assert.equal(count(html, '<script src="/js/forms.js" defer></script>'), 1, file);
    assert.ok(!html.includes("fetch('/'"), file);
    assert.ok(!html.includes("getElementById('yourFormId"), file);
  });
});

test('every form posts to the Worker with its form name and a honeypot field', () => {
  PAGES.forEach((file) => {
    const found = forms(read(file));
    assert.ok(found.length >= 2, file);
    found.forEach((form) => {
      const kind = form.match(/ name="(contact|brief)"/)[1];
      assert.ok(form.includes(` name="${kind}" action="/api/message" method="post">`), file);
      assert.ok(form.includes(`<input type="hidden" name="form" value="${kind}">`), file);
      assert.ok(form.includes('<input name="bot-field">'), file);
      assert.ok(form.includes('name="massage"'), file);
      assert.ok(!/data-netlify|netlify-honeypot|enctype|name="file\d"/.test(form), file);
    });
  });
});

test('js/forms.js posts to /api/message as fetch and keeps the alert texts', () => {
  const js = read('js/forms.js');
  assert.ok(js.includes("const ENDPOINT = '/api/message';"));
  assert.ok(js.includes("'X-Requested-With': 'fetch'"));
  assert.ok(js.includes("'Thank you. Your message has been sent.'"));
  assert.ok(js.includes("contact: 'Error.', brief: 'Error when submitting the form.'"));
  assert.ok(js.includes("data.delete('files[]')"));
});

test('js/forms.js loads Turnstile on demand with one sitekey constant', () => {
  const js = read('js/forms.js');
  const api = "'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'";
  assert.ok(js.includes(`const TURNSTILE_API = ${api};`));
  assert.equal(count(js, 'const SITEKEY = '), 1);
  assert.ok(js.includes("const TEST_SITEKEY = '1x00000000000000000000AA';"));
  assert.ok(js.includes("appearance: 'interaction-only'"));
  assert.ok(js.includes("execution: 'execute'"));
  assert.ok(js.includes("'timeout-callback': () => settle('reject')"));
  assert.ok(js.includes("data.set('cf-turnstile-response', value);"));
});

test('the theme keeps the file input in step with its file list', () => {
  const js = read('wp-content/themes/nellis/assets/JS/modal.js');
  assert.equal(count(js, 'syncInput();'), 2);
  assert.ok(js.includes("fileInput.form.addEventListener('reset'"));
});

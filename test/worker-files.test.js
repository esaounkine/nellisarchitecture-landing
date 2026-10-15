const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const load = () => import('../worker/files.js');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const manifest = (list) => JSON.stringify(list);
const pdf = { name: 'cv.pdf', size: 10 };

test('parseFiles: no manifest is no files', async () => {
  const { parseFiles } = await load();
  assert.deepEqual(parseFiles(null), []);
  assert.deepEqual(parseFiles(''), []);
  assert.deepEqual(parseFiles('[]'), []);
});

test('parseFiles: 5 files of 5,000,000 bytes pass, extra keys are dropped', async () => {
  const { parseFiles } = await load();
  const names = ['a.gif', 'b.JPG', 'c.jpeg', 'd.docx', 'e.pdf'];
  const list = names.map((name) => ({ name, size: 5000000, x: 1 }));
  assert.deepEqual(parseFiles(manifest(list)), list.map(({ name, size }) => ({ name, size })));
});

test('parseFiles: 6 files, 5,000,001 bytes, .html, bad JSON and bad shapes fail', async () => {
  const { parseFiles } = await load();
  [
    manifest(Array(6).fill(pdf)),
    manifest([{ name: 'a.pdf', size: 5000001 }]),
    manifest([{ name: 'a.html', size: 1 }]),
    manifest([{ name: 'a.pdf.exe', size: 1 }]),
    manifest([{ name: 'a\r\n.pdf', size: 1 }]),
    manifest([{ name: '', size: 1 }]),
    manifest([{ name: `${'a'.repeat(197)}.pdf`, size: 1 }]),
    manifest([{ name: 'a.pdf', size: 1.5 }]),
    manifest([{ name: 'a.pdf', size: -1 }]),
    manifest([{ name: 'a.pdf', size: '1' }]),
    manifest([null]),
    manifest(pdf),
    '{',
  ].forEach((text) => assert.equal(parseFiles(text), null, text.slice(0, 60)));
});

test('sign and verifySig: round trip passes, tampered data or signature fails', async () => {
  const { sign, verifySig } = await load();
  const sig = await sign('secret', 'get|k');
  assert.match(sig, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(await verifySig('secret', 'get|k', sig), true);
  assert.equal(await verifySig('secret', 'get|x', sig), false);
  assert.equal(await verifySig('other', 'get|k', sig), false);
  const flip = `${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`;
  assert.equal(await verifySig('secret', 'get|k', flip), false);
  assert.equal(await verifySig('secret', 'get|k', null), false);
  assert.equal(await verifySig('secret', 'get|k', 'not base64!'), false);
  assert.equal(await verifySig('secret', 'get|k', ''), false);
});

test('isKey accepts only a lower-case UUID', async () => {
  const { isKey } = await load();
  assert.equal(isKey(crypto.randomUUID()), true);
  assert.equal(isKey('pending/x.json'), false);
  assert.equal(isKey('../a'), false);
  assert.equal(isKey(crypto.randomUUID().toUpperCase()), false);
});

test('disposition: ASCII fallback and UTF-8 name, no CR, LF or quotes', async () => {
  const { disposition } = await load();
  assert.equal(disposition('cv.pdf'), 'attachment; filename="cv.pdf"; filename*=UTF-8\'\'cv.pdf');
  assert.equal(
    disposition('Résumé "x"\r\n(1).pdf'),
    'attachment; filename="R_sum_ x(1).pdf"; filename*=UTF-8\'\'R%C3%A9sum%C3%A9%20x%281%29.pdf',
  );
});

test('js/forms.js, the Worker and the file input use the same file limits', async () => {
  const { MAX_FILES, MAX_FILE_BYTES, EXTENSIONS } = await load();
  const js = read('js/forms.js');
  assert.ok(js.includes(`const MAX_FILES = ${MAX_FILES};`));
  assert.ok(js.includes(`const MAX_FILE_BYTES = ${MAX_FILE_BYTES};`));
  assert.ok(js.includes(`const EXTENSIONS = [${EXTENSIONS.map((e) => `'${e}'`).join(', ')}];`));
  assert.ok(js.includes("const TOO_LARGE = 'too large (max 5 MB)';"));
  assert.ok(js.includes("data.set('files', JSON.stringify(manifest));"));
  ['build/lib/partials/top.html', 'build/news-template.html', 'index.html'].forEach((file) => {
    const html = read(file);
    assert.ok(html.includes(`accept="${EXTENSIONS.join(',')}"`), file);
    assert.ok(html.includes('Add a file (no more than 5 MB)'), file);
  });
});

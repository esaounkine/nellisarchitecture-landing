const {
  test, mock, beforeEach, afterEach,
} = require('node:test');
const assert = require('node:assert/strict');

const load = async () => (await import('../worker/index.js')).default;
const files = () => import('../worker/files.js');
const ORIGIN = 'https://x.dev';
const SECRET = 'link-secret';
const BRIEF = {
  form: 'brief',
  name: 'Ann',
  email: 'ann@example.com',
  phone: '1',
  massage: 'Hi',
  'cf-turnstile-response': 'tok',
};

beforeEach(() => mock.method(globalThis, 'fetch', async () => Response.json({
  success: true, hostname: 'x.dev',
})));
afterEach(() => mock.restoreAll());

const fakeFiles = () => {
  const store = new Map();
  const object = (key) => {
    const { data, opts = {} } = store.get(key);
    return {
      size: data.length,
      customMetadata: opts.customMetadata,
      httpMetadata: opts.httpMetadata,
      body: data,
      json: async () => JSON.parse(data),
    };
  };
  return {
    store,
    put: mock.fn(async (key, value, opts) => {
      const data = typeof value === 'string' ? value : await new Response(value).text();
      store.set(key, { data, opts });
    }),
    get: async (key) => (store.has(key) ? object(key) : null),
    head: async (key) => (store.has(key) ? object(key) : null),
    delete: async (key) => store.delete(key),
  };
};

const fakeEnv = () => ({
  MAIL_FROM: 'noreply@nellisarchitecture.com',
  TURNSTILE_SECRET: 'real-secret',
  LINK_SECRET: SECRET,
  EMAIL: { send: mock.fn(async () => {}) },
  FILES: fakeFiles(),
  ASSETS: { fetch: mock.fn(async () => new Response('asset', { status: 404 })) },
});

const message = (list, fields = BRIEF) => {
  const body = new URLSearchParams({ ...fields, files: JSON.stringify(list) }).toString();
  return new Request(`${ORIGIN}/api/message`, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': String(body.length),
      'X-Requested-With': 'fetch',
    },
  });
};

const put = (url, body, length = String(body.length)) => new Request(url, {
  method: 'PUT',
  body,
  headers: length === null ? {} : { 'Content-Length': length },
});

const sendUrl = ({ id, exp, sendSig }) => (
  `${ORIGIN}/api/message/${id}/send?exp=${exp}&sig=${sendSig}`);
const post = (url) => new Request(url, { method: 'POST' });

const fetchIn = (env) => async (req) => (await load()).fetch(req, env);

const start = async (worker, env, list) => {
  const res = await worker.fetch(message(list), env);
  assert.equal(res.status, 200);
  return res.json();
};

test('a brief with files keeps it pending and sends no email yet', async () => {
  const worker = await load();
  const env = fakeEnv();
  const data = await start(worker, env, [{ name: 'cv.pdf', size: 3 }]);
  assert.equal(env.EMAIL.send.mock.callCount(), 0);
  assert.equal(data.uploads.length, 1);
  assert.equal(data.uploads[0].name, 'cv.pdf');
  const upload = /^https:\/\/x\.dev\/api\/upload\/[0-9a-f-]{36}\?name=cv\.pdf&size=3&exp=\d+&sig=/;
  assert.match(data.uploads[0].url, upload);
  const now = Math.floor(Date.now() / 1000);
  assert.ok(data.exp > now + 1790 && data.exp <= now + 1800);
  const pending = JSON.parse(env.FILES.store.get(`pending/${data.id}.json`).data);
  assert.equal(pending.fields.message, 'Hi');
  assert.equal(pending.files[0].name, 'cv.pdf');
});

test('a brief with no files sends at once', async () => {
  const worker = await load();
  const env = fakeEnv();
  const res = await worker.fetch(message([]), env);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(env.EMAIL.send.mock.callCount(), 1);
  assert.equal(env.FILES.store.size, 0);
});

test('400 for 6 files, 5,000,001 bytes, .html or files on the contact form', async () => {
  const worker = await load();
  const env = fakeEnv();
  const cases = [
    message(Array(6).fill({ name: 'a.pdf', size: 1 })),
    message([{ name: 'a.pdf', size: 5000001 }]),
    message([{ name: 'a.html', size: 1 }]),
    message([{ name: 'a.pdf', size: 1 }], { ...BRIEF, form: 'contact' }),
  ];
  const answers = await Promise.all(cases.map((req) => worker.fetch(req, env)));
  await Promise.all(answers.map(async (res) => {
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'invalid field', field: 'files' });
  }));
  assert.equal(env.EMAIL.send.mock.callCount(), 0);
  assert.equal(env.FILES.store.size, 0);
});

test('files with no FILES binding or LINK_SECRET answer 503', async () => {
  const worker = await load();
  const env = fakeEnv();
  delete env.LINK_SECRET;
  const res = await worker.fetch(message([{ name: 'a.pdf', size: 1 }]), env);
  assert.equal(res.status, 503);
});

test('upload, then send: one email with a link per file, pending deleted', async () => {
  const worker = await load();
  const env = fakeEnv();
  const data = await start(worker, env, [{ name: 'cv.pdf', size: 3 }, { name: 'p.png', size: 2 }]);
  const up = await Promise.all([
    worker.fetch(put(data.uploads[0].url, 'abc'), env),
    worker.fetch(put(data.uploads[1].url, 'xy'), env),
  ]);
  assert.deepEqual(up.map((r) => r.status), [201, 201]);
  const [, , opts] = env.FILES.put.mock.calls[1].arguments;
  assert.deepEqual(opts.httpMetadata, { contentType: 'application/octet-stream' });
  const res = await worker.fetch(post(sendUrl(data)), env);
  assert.equal(res.status, 200);
  assert.equal(env.EMAIL.send.mock.callCount(), 1);
  const { text, to } = env.EMAIL.send.mock.calls[0].arguments[0];
  assert.equal(to, 'people@nellisarchitecture.com');
  const link = /^(cv\.pdf|p\.png): https:\/\/x\.dev\/api\/file\/[0-9a-f-]{36}\?sig=\S+$/gm;
  const links = text.match(link);
  assert.equal(links.length, 2);
  assert.ok(!env.FILES.store.has(`pending/${data.id}.json`));
  assert.equal((await fetchIn(env)(post(sendUrl(data)))).status, 404);
});

test('send with a missing or a short file answers 409 with the names, no email', async () => {
  const worker = await load();
  const env = fakeEnv();
  const data = await start(worker, env, [{ name: 'a.pdf', size: 3 }, { name: 'b.pdf', size: 3 }]);
  const key = new URL(data.uploads[1].url).pathname.split('/').pop();
  env.FILES.store.set(key, { data: 'ab' });
  const res = await worker.fetch(post(sendUrl(data)), env);
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), { error: 'files missing', files: ['a.pdf', 'b.pdf'] });
  assert.equal(env.EMAIL.send.mock.callCount(), 0);
  assert.ok(env.FILES.store.has(`pending/${data.id}.json`));
});

test('send with a bad signature or a changed exp answers 403', async () => {
  const worker = await load();
  const env = fakeEnv();
  const data = await start(worker, env, [{ name: 'a.pdf', size: 1 }]);
  assert.equal((await fetchIn(env)(post(sendUrl({ ...data, sendSig: 'AAAA' })))).status, 403);
  assert.equal((await fetchIn(env)(post(sendUrl({ ...data, exp: data.exp + 1 })))).status, 403);
  assert.equal(env.EMAIL.send.mock.callCount(), 0);
});

test('upload: no Content-Length 411, over 5 MB 413, size mismatch 400', async () => {
  const worker = await load();
  const env = fakeEnv();
  const [{ url }] = (await start(worker, env, [{ name: 'a.pdf', size: 3 }])).uploads;
  assert.equal((await fetchIn(env)(put(url, null, null))).status, 411);
  assert.equal((await fetchIn(env)(put(url, 'abc', '5000001'))).status, 413);
  assert.equal((await fetchIn(env)(put(url, 'ab'))).status, 400);
  assert.equal(env.FILES.store.size, 1);
});

test('upload: a tampered name or size, a bad key or GET answers 403 or 405', async () => {
  const worker = await load();
  const env = fakeEnv();
  const [{ url }] = (await start(worker, env, [{ name: 'a.pdf', size: 3 }])).uploads;
  const swap = (from, to) => url.replace(from, to);
  assert.equal((await fetchIn(env)(put(swap('name=a.pdf', 'name=b.pdf'), 'abc'))).status, 403);
  assert.equal((await fetchIn(env)(put(swap('size=3', 'size=4'), 'abcd'))).status, 403);
  const other = swap(/upload\/[^?]+/, `upload/${crypto.randomUUID()}`);
  assert.equal((await fetchIn(env)(put(other, 'abc'))).status, 403);
  const pending = swap(/upload\/[^?]+/, 'upload/pending');
  assert.equal((await fetchIn(env)(put(pending, 'abc'))).status, 403);
  const get = await worker.fetch(new Request(url), env);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('Allow'), 'PUT');
  assert.equal(env.FILES.store.size, 1);
});

test('upload: an expired link answers 403', async () => {
  const worker = await load();
  const { sign } = await files();
  const env = fakeEnv();
  const key = crypto.randomUUID();
  const exp = Math.floor(Date.now() / 1000) - 1;
  const sig = await sign(SECRET, `up|${key}|a.pdf|3|${exp}`);
  const url = `${ORIGIN}/api/upload/${key}?name=a.pdf&size=3&exp=${exp}&sig=${sig}`;
  const res = await worker.fetch(put(url, 'abc'), env);
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: 'link expired' });
});

test('download: the file with safe headers; gone 404; bad signature 403; bad key 404', async () => {
  const worker = await load();
  const { fileLink } = await files();
  const env = fakeEnv();
  const key = crypto.randomUUID();
  env.FILES.store.set(key, { data: 'abc', opts: { customMetadata: { name: 'Résumé.pdf' } } });
  const link = await fileLink(ORIGIN, SECRET, key);
  const res = await worker.fetch(new Request(link), env);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'abc');
  assert.deepEqual(Object.fromEntries(res.headers), {
    'content-type': 'application/octet-stream',
    'content-disposition':
      'attachment; filename="R_sum_.pdf"; filename*=UTF-8\'\'R%C3%A9sum%C3%A9.pdf',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox",
    'cache-control': 'private, no-store',
    'referrer-policy': 'no-referrer',
    'x-robots-tag': 'noindex',
  });
  assert.equal((await fetchIn(env)(new Request(`${link}x`))).status, 403);
  assert.equal((await fetchIn(env)(new Request(`${ORIGIN}/api/file/pending?sig=x`))).status, 404);
  env.FILES.store.delete(key);
  const gone = await worker.fetch(new Request(link), env);
  assert.equal(gone.status, 404);
  assert.ok((await gone.text()).includes('This file is no longer available.'));
});

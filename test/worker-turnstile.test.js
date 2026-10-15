const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../worker/turnstile.js');
const SECRET = 'real-secret';
const TEST_SECRET = '1x0000000000000000000000000000000AA';
const HOST = 'landing.nellisarchitecture.workers.dev';
const answer = (data, status = 200) => mock.fn(
  async () => new Response(JSON.stringify(data), { status }),
);

test('a good token for this host passes; the call sends secret, token and remoteip', async () => {
  const { verify, SITEVERIFY } = await load();
  const fetchFn = answer({ success: true, hostname: HOST });
  assert.deepEqual(await verify('tok', '1.2.3.4', HOST, SECRET, fetchFn), { ok: true });
  const [url, init] = fetchFn.mock.calls[0].arguments;
  assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(url, SITEVERIFY);
  assert.equal(init.method, 'POST');
  assert.equal(init.body.toString(), 'secret=real-secret&response=tok&remoteip=1.2.3.4');
});

test('no remoteip when the IP is missing', async () => {
  const { verify } = await load();
  const fetchFn = answer({ success: true, hostname: HOST });
  await verify('tok', null, HOST, SECRET, fetchFn);
  const { body } = fetchFn.mock.calls[0].arguments[1];
  assert.equal(body.toString(), 'secret=real-secret&response=tok');
});

test('success false answers 403', async () => {
  const { verify } = await load();
  const fetchFn = answer({ success: false, 'error-codes': ['invalid-input-response'] });
  assert.deepEqual(await verify('tok', '', HOST, SECRET, fetchFn), { ok: false, status: 403 });
});

test('a token for another host answers 403', async () => {
  const { verify } = await load();
  const fetchFn = answer({ success: true, hostname: 'evil.example' });
  assert.deepEqual(await verify('tok', '', HOST, SECRET, fetchFn), { ok: false, status: 403 });
});

test('a test secret skips the hostname check', async () => {
  const { verify } = await load();
  const fetchFn = answer({ success: true, hostname: 'example.com' });
  assert.deepEqual(await verify('tok', '', HOST, TEST_SECRET, fetchFn), { ok: true });
  const fail = answer({ success: false });
  const failSecret = '2x0000000000000000000000000000000AA';
  assert.deepEqual(await verify('tok', '', HOST, failSecret, fail), { ok: false, status: 403 });
});

test('an empty, missing, non-text or too long token answers 400 with no call', async () => {
  const { verify } = await load();
  const fetchFn = answer({ success: true, hostname: HOST });
  const tokens = ['', null, undefined, new Blob(['x']), 'a'.repeat(2049)];
  await Promise.all(tokens.map(async (t) => {
    assert.deepEqual(await verify(t, '', HOST, SECRET, fetchFn), { ok: false, status: 400 });
  }));
  assert.equal(fetchFn.mock.callCount(), 0);
  assert.deepEqual(await verify('a'.repeat(2048), '', HOST, SECRET, fetchFn), { ok: true });
});

test('a network error or a non-2xx answer gives 503', async (t) => {
  const { verify } = await load();
  t.mock.method(console, 'error', () => {});
  const broken = mock.fn(async () => {
    throw new TypeError('fetch failed');
  });
  assert.deepEqual(await verify('tok', '', HOST, SECRET, broken), { ok: false, status: 503 });
  const down = answer({ success: true, hostname: HOST }, 500);
  assert.deepEqual(await verify('tok', '', HOST, SECRET, down), { ok: false, status: 503 });
});

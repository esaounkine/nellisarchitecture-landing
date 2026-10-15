const {
  test, mock, beforeEach, afterEach,
} = require('node:test');
const assert = require('node:assert/strict');

const load = async () => (await import('../worker/index.js')).default;
const oauth = () => import('../worker/oauth.js');
const ORIGIN = 'https://x.dev';
const COOKIE = '__Host-cms_oauth_state';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const FLAGS = 'Path=/; Secure; HttpOnly; SameSite=Lax';

const reply = (data, init) => mock.method(
  globalThis,
  'fetch',
  async () => Response.json(data, init),
);

beforeEach(() => reply({ access_token: 'gho_tok', token_type: 'bearer', scope: 'repo' }));
afterEach(() => mock.restoreAll());

const fakeEnv = () => ({
  GITHUB_CLIENT_ID: 'cid',
  GITHUB_CLIENT_SECRET: 'csecret',
  ASSETS: { fetch: mock.fn(async () => new Response('asset', { status: 404 })) },
});

const get = (path, headers = {}) => new Request(`${ORIGIN}${path}`, { headers });
const callback = (query, state = 'abc') => get(
  `/api/callback?${query}`,
  state === null ? {} : { Cookie: `other=1; ${COOKIE}=${state}` },
);
const script = (body) => body.slice(body.indexOf('<script>') + 8, body.lastIndexOf('</script>'));

test('/api/auth redirects to GitHub with scope repo and the state of the cookie', async () => {
  const worker = await load();
  const req = get('/api/auth?provider=github&site_id=x&scope=public_repo');
  const res = await worker.fetch(req, fakeEnv());
  assert.equal(res.status, 302);
  const url = new URL(res.headers.get('Location'));
  assert.equal(`${url.origin}${url.pathname}`, 'https://github.com/login/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'), 'cid');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://x.dev/api/callback');
  assert.equal(url.searchParams.get('scope'), 'repo');
  const state = url.searchParams.get('state');
  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(res.headers.get('Set-Cookie'), `${COOKIE}=${state}; ${FLAGS}; Max-Age=600`);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
});

test('/api/auth gives a new state each time', async () => {
  const worker = await load();
  const a = await worker.fetch(get('/api/auth?provider=github'), fakeEnv());
  const b = await worker.fetch(get('/api/auth?provider=github'), fakeEnv());
  assert.notEqual(a.headers.get('Set-Cookie'), b.headers.get('Set-Cookie'));
});

test('/api/auth with provider gitlab or no provider answers 400', async () => {
  const worker = await load();
  assert.equal((await worker.fetch(get('/api/auth?provider=gitlab'), fakeEnv())).status, 400);
  assert.equal((await worker.fetch(get('/api/auth'), fakeEnv())).status, 400);
});

test('no GitHub secrets answer 503 on both routes', async () => {
  const worker = await load();
  const cases = [{}, { GITHUB_CLIENT_ID: 'cid' }, { GITHUB_CLIENT_SECRET: 'cs' }];
  await Promise.all(cases.map(async (env) => {
    const auth = await worker.fetch(get('/api/auth?provider=github'), env);
    const back = await worker.fetch(callback('code=c&state=abc'), env);
    assert.equal(auth.status, 503);
    assert.equal(back.status, 503);
    assert.deepEqual(await auth.json(), { error: 'oauth not configured' });
  }));
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('POST answers 405 with Allow: GET on both routes', async () => {
  const worker = await load();
  await Promise.all(['/api/auth?provider=github', '/api/callback'].map(async (path) => {
    const req = new Request(`${ORIGIN}${path}`, { method: 'POST' });
    const res = await worker.fetch(req, fakeEnv());
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('Allow'), 'GET');
  }));
});

test('a callback with a bad state or no cookie answers 400 and calls no fetch', async () => {
  const worker = await load();
  const cases = [
    callback('code=c'),
    callback('code=c&state='),
    callback('code=c&state=zzz'),
    callback('code=c&state=abc', null),
    callback('code=c&state=', ''),
  ];
  await Promise.all(cases.map(async (req) => {
    const res = await worker.fetch(req, fakeEnv());
    assert.equal(res.status, 400);
    const body = await res.text();
    assert.ok(body.includes('authorization:github:error:'));
    assert.ok(body.includes('bad state'));
    assert.equal(res.headers.get('Set-Cookie'), `${COOKIE}=; ${FLAGS}; Max-Age=0`);
  }));
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('a callback with ?error=access_denied answers 400 with an error page', async () => {
  const worker = await load();
  const res = await worker.fetch(callback('error=access_denied&state=abc'), fakeEnv());
  assert.equal(res.status, 400);
  const body = await res.text();
  assert.ok(body.includes('authorization:github:error:'));
  assert.ok(body.includes('access_denied'));
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('a good callback exchanges the code once and posts the token to the same origin', async () => {
  const worker = await load();
  const res = await worker.fetch(callback('code=c0de&state=abc'), fakeEnv());
  assert.equal(res.status, 200);
  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const [url, init] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(url, TOKEN_URL);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Accept, 'application/json');
  assert.deepEqual(JSON.parse(init.body), {
    client_id: 'cid',
    client_secret: 'csecret',
    code: 'c0de',
    redirect_uri: 'https://x.dev/api/callback',
  });
  assert.equal(res.headers.get('Set-Cookie'), `${COOKIE}=; ${FLAGS}; Max-Age=0`);
  assert.match(res.headers.get('Content-Type'), /^text\/html; charset=utf-8/);
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
  const body = await res.text();
  const data = JSON.stringify({ token: 'gho_tok', provider: 'github' });
  const message = `authorization:github:success:${data}`;
  assert.ok(body.includes(JSON.stringify(message)));
  assert.ok(body.includes('postMessage(message, location.origin)'));
  assert.ok(!body.includes("'*'"));
  assert.ok(!body.includes('"*"'));
});

test('token exchange errors answer 502, log no secret and post no token', async (t) => {
  const worker = await load();
  const log = t.mock.method(console, 'error', () => {});
  const cases = [
    () => reply({ error: 'bad_verification_code' }),
    () => reply({ access_token: 'x' }, { status: 500 }),
    () => mock.method(globalThis, 'fetch', async () => {
      throw new Error('down');
    }),
    () => reply({ token_type: 'bearer' }),
    () => mock.method(globalThis, 'fetch', async () => new Response('not json')),
  ];
  await cases.reduce((chain, setup) => chain.then(async () => {
    setup();
    const res = await worker.fetch(callback('code=c0de&state=abc'), fakeEnv());
    assert.equal(res.status, 502);
    const body = await res.text();
    assert.ok(body.includes('authorization:github:error:'));
    assert.ok(!body.includes('success'));
  }), Promise.resolve());
  assert.equal(log.mock.callCount(), cases.length);
  const logged = JSON.stringify(log.mock.calls.map((c) => c.arguments));
  ['csecret', 'c0de'].forEach((word) => assert.ok(!logged.includes(word)));
});

test('a </script> in the token or the message is escaped', async () => {
  const worker = await load();
  reply({ access_token: 'a</script><script>alert(1)//' });
  const ok = await (await worker.fetch(callback('code=c&state=abc'), fakeEnv())).text();
  assert.ok(!script(ok).includes('</script>'));
  assert.ok(ok.includes('\\u003c/script>'));
  const req = callback('error=</script>x&state=abc');
  const bad = await (await worker.fetch(req, fakeEnv())).text();
  assert.ok(!script(bad).includes('</'));
});

test('the popup releases the token only after a same-origin echo', async () => {
  const { popup } = await oauth();
  const code = script(await popup(200, 'm').text());
  assert.ok(code.includes('if (e.origin !== location.origin || e.source !== opener) return;'));
  assert.ok(code.includes("if (e.data !== 'authorizing:github') return;"));
  const guard = code.indexOf("e.data !== 'authorizing:github'");
  const release = code.indexOf('opener.postMessage(message, location.origin)');
  assert.ok(guard > 0 && release > guard);
  assert.ok(code.indexOf("window.removeEventListener('message', receive)") < release);
  assert.equal(code.split('postMessage(').length - 1, 2);
});

test('readCookie finds the value among other cookies', async () => {
  const { readCookie } = await oauth();
  assert.equal(readCookie(`a=1; ${COOKIE}=s1; b=2`, COOKIE), 's1');
  assert.equal(readCookie('a=1', COOKIE), null);
  assert.equal(readCookie(null, COOKIE), null);
  assert.equal(readCookie(`x${COOKIE}=s1`, COOKIE), null);
});

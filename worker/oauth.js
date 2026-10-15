import { json, HEADERS } from './http.js';
import { toBase64url } from './files.js';

/* Decap CMS login with a GitHub OAuth App. Decap opens /api/auth in a popup. */
const PROVIDER = 'github';
const SCOPE = 'repo';
const COOKIE = '__Host-cms_oauth_state';
const STATE_TTL = 600;
const TOKEN_URL = 'https://github.com/login/oauth/access_token';

const cookie = (value, maxAge) => (
  `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);

export const authorizeUrl = (clientId, redirectUri, state) => {
  const query = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, scope: SCOPE, state,
  });
  return `https://github.com/login/oauth/authorize?${query}`;
};

export const readCookie = (header, name) => {
  const pair = (header || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : null;
};

/* The popup sends the result to the CMS window only after the CMS answers from the same origin. */
export const popup = (status, message) => new Response(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Nellis Architecture</title></head>
<body><p>You can close this window.</p>
<script>
(function () {
  'use strict';
  var message = ${JSON.stringify(message).replace(/</g, '\\u003c')};
  var opener = window.opener;
  if (!opener) return;
  function receive(e) {
    if (e.origin !== location.origin || e.source !== opener) return;
    if (e.data !== 'authorizing:${PROVIDER}') return;
    window.removeEventListener('message', receive);
    opener.postMessage(message, location.origin);
  }
  window.addEventListener('message', receive);
  opener.postMessage('authorizing:${PROVIDER}', location.origin);
}());
</script>
</body>
</html>
`, {
  status,
  headers: {
    ...HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': cookie('', 0),
  },
});

const fail = (status, text) => popup(
  status,
  `authorization:${PROVIDER}:error:${JSON.stringify({ message: text })}`,
);

const check = (request, env) => {
  if (request.method !== 'GET') {
    const res = json(405, { error: 'method not allowed' });
    res.headers.set('Allow', 'GET');
    return res;
  }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return json(503, { error: 'oauth not configured' });
  }
  return null;
};

const callbackUrl = (request) => `${new URL(request.url).origin}/api/callback`;

export const handleAuth = async (request, env) => {
  const stop = check(request, env);
  if (stop) return stop;
  const provider = new URL(request.url).searchParams.get('provider');
  if (provider !== PROVIDER) return json(400, { error: 'bad provider' });
  const state = toBase64url(crypto.getRandomValues(new Uint8Array(32)));
  return new Response(null, {
    status: 302,
    headers: {
      ...HEADERS,
      Location: authorizeUrl(env.GITHUB_CLIENT_ID, callbackUrl(request), state),
      'Set-Cookie': cookie(state, STATE_TTL),
    },
  });
};

const exchange = async (request, env, code) => {
  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl(request),
      }),
    });
  } catch {
    return { error: 'fetch failed' };
  }
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const data = await res.json().catch(() => null);
  if (!data) return { error: 'bad JSON' };
  if (data.error) return { error: String(data.error) };
  if (!data.access_token) return { error: 'no access_token' };
  return { token: data.access_token };
};

export const handleCallback = async (request, env) => {
  const stop = check(request, env);
  if (stop) return stop;
  const query = new URL(request.url).searchParams;
  if (query.get('error')) return fail(400, query.get('error'));
  const state = query.get('state');
  if (!state || state !== readCookie(request.headers.get('Cookie'), COOKIE)) {
    return fail(400, 'bad state');
  }
  const { token, error } = await exchange(request, env, query.get('code'));
  if (error) {
    console.error('oauth token exchange failed:', error);
    return fail(502, 'token exchange failed');
  }
  const data = JSON.stringify({ token, provider: PROVIDER });
  return popup(200, `authorization:${PROVIDER}:success:${data}`);
};

export const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN = 2048;
// A test secret passes a test token from any host, so skip the hostname check.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TEST_SECRET = /^\dx0+AA$/;

/* Returns { ok: true } or { ok: false, status } with the HTTP status for the form answer. */
export const verify = async (token, ip, host, secret, fetchFn = fetch) => {
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN) {
    return { ok: false, status: 400 };
  }
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  let data;
  try {
    const res = await fetchFn(SITEVERIFY, { method: 'POST', body });
    if (!res.ok) throw new Error(`siteverify HTTP ${res.status}`);
    data = await res.json();
  } catch (error) {
    console.error('turnstile check failed', error);
    return { ok: false, status: 503 };
  }
  if (!data.success) return { ok: false, status: 403 };
  if (!TEST_SECRET.test(secret) && data.hostname !== host) return { ok: false, status: 403 };
  return { ok: true };
};

import { parse, validate } from './form.js';
import { send } from './email.js';
import { verify } from './turnstile.js';
import { json, html } from './http.js';

const MAX_BYTES = 32768;
const SENT = 'Thank you. Your message has been sent.';

const isNative = (request) => (request.headers.get('Accept') || '').includes('text/html')
  && !request.headers.get('X-Requested-With');

const answer = (request, status, data) => {
  if (!isNative(request)) return json(status, data);
  return html(status, status === 200 ? SENT : 'Error.');
};

export const handleMessage = async (request, env) => {
  if (request.method !== 'POST') {
    const res = answer(request, 405, { error: 'method not allowed' });
    res.headers.set('Allow', 'POST');
    return res;
  }
  const length = request.headers.get('Content-Length');
  if (length === null) return answer(request, 411, { error: 'length required' });
  if (Number(length) > MAX_BYTES) return answer(request, 413, { error: 'too large' });

  const formData = await request.formData().catch(() => null);
  if (!formData) return answer(request, 400, { error: 'bad form data' });
  const raw = parse(formData);
  const result = validate(raw);
  if (result.drop) return answer(request, 200, { ok: true });
  if (result.field) return answer(request, 400, { error: 'invalid field', field: result.field });

  if (!env.TURNSTILE_SECRET) return answer(request, 503, { error: 'turnstile not configured' });
  const ip = request.headers.get('CF-Connecting-IP');
  const host = new URL(request.url).hostname;
  const check = await verify(raw.token, ip, host, env.TURNSTILE_SECRET);
  if (!check.ok) return answer(request, check.status, { error: 'turnstile check failed' });

  if (!env.EMAIL) return answer(request, 503, { error: 'email not configured' });
  try {
    await send(env, result.fields);
  } catch (error) {
    console.error('email send failed', error);
    return answer(request, 502, { error: 'email not sent' });
  }
  return answer(request, 200, { ok: true });
};

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === '/api/message') return handleMessage(request, env);
    return env.ASSETS.fetch(request);
  },
};

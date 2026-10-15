import { send } from './email.js';
import { json, html } from './http.js';
import {
  MAX_FILE_BYTES, LINK_TTL, isKey, sign, verifySig, now, fileLink, uploadLink, disposition,
} from './files.js';

const GONE = 'This file is no longer available.';
const pendingKey = (id) => `pending/${id}.json`;

const notAllowed = (allow, res = json(405, { error: 'method not allowed' })) => {
  res.headers.set('Allow', allow);
  return res;
};

/* The message has files: keep it in pending/, answer with one signed upload link per file. */
export const startUpload = async (request, env, fields, files) => {
  if (!env.FILES || !env.LINK_SECRET) return json(503, { error: 'files not configured' });
  const { origin } = new URL(request.url);
  const id = crypto.randomUUID();
  const exp = now() + LINK_TTL;
  const keyed = files.map((file) => ({ ...file, key: crypto.randomUUID() }));
  await env.FILES.put(pendingKey(id), JSON.stringify({ fields, files: keyed }));
  const uploads = await Promise.all(keyed.map(async (file) => ({
    name: file.name, url: await uploadLink(origin, env.LINK_SECRET, file, exp),
  })));
  const sendSig = await sign(env.LINK_SECRET, `send|${id}|${exp}`);
  return json(200, {
    id, sendSig, exp, uploads,
  });
};

const checkLink = async (env, data, query) => {
  if (!(await verifySig(env.LINK_SECRET, data, query.get('sig')))) return 'bad signature';
  if (!(Number(query.get('exp')) > now())) return 'link expired';
  return null;
};

export const handleUpload = async (request, env, key) => {
  if (request.method !== 'PUT') return notAllowed('PUT');
  if (!env.FILES || !env.LINK_SECRET) return json(503, { error: 'files not configured' });
  const query = new URL(request.url).searchParams;
  const size = query.get('size');
  const data = `up|${key}|${query.get('name')}|${size}|${query.get('exp')}`;
  const bad = isKey(key) ? await checkLink(env, data, query) : 'bad key';
  if (bad) return json(403, { error: bad });
  const length = request.headers.get('Content-Length');
  if (length === null) return json(411, { error: 'length required' });
  if (Number(length) > MAX_FILE_BYTES) return json(413, { error: 'too large' });
  if (Number(length) !== Number(size)) return json(400, { error: 'size mismatch' });
  await env.FILES.put(key, request.body, {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: { name: query.get('name') },
  });
  return json(201, { ok: true });
};

export const handleSend = async (request, env, id) => {
  if (request.method !== 'POST') return notAllowed('POST');
  if (!env.FILES || !env.LINK_SECRET) return json(503, { error: 'files not configured' });
  if (!env.EMAIL) return json(503, { error: 'email not configured' });
  const query = new URL(request.url).searchParams;
  const bad = isKey(id) ? await checkLink(env, `send|${id}|${query.get('exp')}`, query) : 'bad id';
  if (bad) return json(403, { error: bad });
  const pending = await env.FILES.get(pendingKey(id));
  if (!pending) return json(404, { error: 'not found' });
  const { fields, files } = await pending.json();
  const heads = await Promise.all(files.map((file) => env.FILES.head(file.key)));
  const missing = files.filter((file, i) => !heads[i] || heads[i].size !== file.size);
  if (missing.length) {
    return json(409, { error: 'files missing', files: missing.map((file) => file.name) });
  }
  const { origin } = new URL(request.url);
  const links = await Promise.all(files.map(async (file) => ({
    name: file.name, url: await fileLink(origin, env.LINK_SECRET, file.key),
  })));
  try {
    await send(env, fields, links);
  } catch (error) {
    console.error('email send failed', error);
    return json(502, { error: 'email not sent' });
  }
  await env.FILES.delete(pendingKey(id));
  return json(200, { ok: true });
};

export const handleFile = async (request, env, key) => {
  if (request.method !== 'GET') return notAllowed('GET', html(405, 'Error.'));
  if (!env.FILES || !env.LINK_SECRET) return html(503, 'Error.');
  if (!isKey(key)) return html(404, GONE);
  const sig = new URL(request.url).searchParams.get('sig');
  if (!(await verifySig(env.LINK_SECRET, `get|${key}`, sig))) return html(403, 'Error.');
  const object = await env.FILES.get(key);
  if (!object) return html(404, GONE);
  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': disposition(object.customMetadata?.name || key),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
    },
  });
};

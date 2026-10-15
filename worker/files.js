// js/forms.js has the same limits (test/worker-files.test.js checks them).
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 5000000;
export const EXTENSIONS = ['.gif', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.pdf'];
export const LINK_TTL = 1800;
const MAX_NAME = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isKey = (value) => UUID.test(value);

const okFile = (file) => file && typeof file.name === 'string'
  && file.name.length > 0 && file.name.length <= MAX_NAME && !/[\r\n]/.test(file.name)
  && EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  && Number.isInteger(file.size) && file.size >= 0 && file.size <= MAX_FILE_BYTES;

/* manifest: the JSON text of [{ name, size }], or null. Returns the files or null when bad. */
export const parseFiles = (manifest) => {
  if (manifest === null || manifest === '') return [];
  let list;
  try {
    list = JSON.parse(manifest);
  } catch {
    return null;
  }
  if (!Array.isArray(list) || list.length > MAX_FILES || !list.every(okFile)) return null;
  return list.map(({ name, size }) => ({ name, size }));
};

const encoder = new TextEncoder();
const hmacKey = (secret, use) => crypto.subtle.importKey(
  'raw',
  encoder.encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  [use],
);

export const toBase64url = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64url = (text) => {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
};

export const sign = async (secret, data) => toBase64url(
  await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), encoder.encode(data)),
);

/* crypto.subtle.verify compares in constant time. */
export const verifySig = async (secret, data, sig) => {
  const bytes = fromBase64url(sig);
  if (!bytes) return false;
  return crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), bytes, encoder.encode(data));
};

export const now = () => Math.floor(Date.now() / 1000);

export const fileLink = async (origin, secret, key) => {
  const sig = await sign(secret, `get|${key}`);
  return `${origin}/api/file/${key}?sig=${sig}`;
};

export const uploadLink = async (origin, secret, { key, name, size }, exp) => {
  const sig = await sign(secret, `up|${key}|${name}|${size}|${exp}`);
  const query = new URLSearchParams({
    name, size: String(size), exp: String(exp), sig,
  });
  return `${origin}/api/upload/${key}?${query}`;
};

const encode5987 = (text) => encodeURIComponent(text)
  .replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export const disposition = (name) => {
  const clean = String(name).replace(/[\r\n"\\]/g, '');
  const ascii = clean.replace(/[^\x20-\x7e]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encode5987(clean)}`;
};

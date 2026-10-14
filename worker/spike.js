const HEADERS = {
  'Content-Type': 'application/json',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const CHUNK = 32 * 1024;

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function wrap(b64) {
  const lines = [];
  for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
  return lines.join('\r\n');
}

async function brief(request) {
  const form = await request.formData();
  const fields = [];
  const files = [];
  for (const [name, value] of form.entries()) {
    if (typeof value === 'string') fields.push(`${name}: ${value}`);
    else files.push(value);
  }

  const boundary = `spike-${crypto.randomUUID()}`;
  const parts = [
    'From: spike@nellisarchitecture.com',
    'To: spike@nellisarchitecture.com',
    'Subject: Brief (spike)',
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    fields.join('\r\n'),
  ];

  let fileBytes = 0;
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    fileBytes += buffer.byteLength;
    parts.push(
      `--${boundary}`,
      `Content-Type: ${file.type || 'application/octet-stream'}; name="${file.name}"`,
      `Content-Disposition: attachment; filename="${file.name}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap(toBase64(buffer)),
    );
  }
  parts.push(`--${boundary}--`, '');
  const mime = parts.join('\r\n');

  const body = { method: 'chunked-fromCharCode-btoa', fileBytes, mimeLength: mime.length };
  return new Response(JSON.stringify(body), { headers: HEADERS });
}

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (request.method === 'POST' && pathname === '/spike/brief') return brief(request);
    return new Response('Not found', { status: 404 });
  },
};

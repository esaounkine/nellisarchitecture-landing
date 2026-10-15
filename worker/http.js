const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export const json = (status, data) => new Response(JSON.stringify(data), {
  status,
  headers: { ...HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
});

export const html = (status, text) => new Response(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nellis Architecture</title></head>
<body><p>${text}</p><p><a href="/contact/">Back</a></p></body>
</html>
`, {
  status,
  headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const MAX_BYTES = 25 * 1024 * 1024;

const root = path.join(__dirname, '..');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean);

test('every tracked file is below 25 MiB (Cloudflare Workers static-assets per-file limit)', () => {
  const tooBig = files
    .filter((file) => fs.existsSync(path.join(root, file)))
    .map((file) => ({ path: file, size: fs.statSync(path.join(root, file)).size }))
    .filter(({ size }) => size >= MAX_BYTES);
  assert.deepEqual(tooBig, []);
});

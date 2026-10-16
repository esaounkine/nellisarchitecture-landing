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

test('every CMS upload field in admin/config.yml has the upload size limit', () => {
  const config = fs.readFileSync(path.join(root, 'admin/config.yml'), 'utf8');
  const limits = config.match(/max_file_size: (\d+)/g) || [];
  assert.deepEqual(limits, [`max_file_size: ${MAX_BYTES - 1}`]);
  const unlimited = config.split('\n')
    .filter((line) => /widget:\s*"?(image|file|markdown)"?/.test(line))
    .filter((line) => !line.includes('media_library'));
  assert.deepEqual(unlimited, []);
});

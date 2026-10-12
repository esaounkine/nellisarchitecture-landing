const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { imageSize } = require('../build/lib/image-size');

const UP = path.join(__dirname, '..', 'wp-content', 'uploads');

test('imageSize reads a progressive JPEG', () => {
  assert.deepEqual(
    imageSize(path.join(UP, '2025/12/25-questions.jpg')),
    { width: 1187, height: 791, type: 'image/jpeg' },
  );
});

test('imageSize reads a PNG', () => {
  assert.deepEqual(
    imageSize(path.join(UP, '2025/09/Bespoke-Design-for-Dubai-Homes.png')),
    { width: 620, height: 404, type: 'image/png' },
  );
});

test('imageSize returns null for a missing, corrupt or other file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imgsize-'));
  const bad = path.join(dir, 'bad.jpg');
  fs.writeFileSync(bad, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]));
  assert.equal(imageSize(bad), null);
  fs.writeFileSync(bad, Buffer.from([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]));
  assert.equal(imageSize(bad), null);
  fs.writeFileSync(bad, 'not an image');
  assert.equal(imageSize(bad), null);
  assert.equal(imageSize(path.join(dir, 'missing.png')), null);
  assert.equal(imageSize(path.join(UP, '2025/09/quiet.webp')), null);
  fs.rmSync(dir, { recursive: true });
});

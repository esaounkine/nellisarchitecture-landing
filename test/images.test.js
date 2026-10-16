const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const images = require('../build/lib/images');

const root = path.join(__dirname, '..');
const manifestFile = path.join(root, images.MANIFEST);
const A = 'wp-content/uploads/a.jpg';
const B = 'wp-content/uploads/b.jpg';

test('ladder stops at the original width once and never upscales', () => {
  assert.deepEqual(images.ladder(4000), [320, 640, 960, 1600, 2400]);
  assert.deepEqual(images.ladder(2400), [320, 640, 960, 1600, 2400]);
  assert.deepEqual(images.ladder(1000), [320, 640, 960, 1000]);
  assert.deepEqual(images.ladder(960), [320, 640, 960]);
  assert.deepEqual(images.ladder(180), [180]);
  assert.deepEqual(images.ladder(1000, [640, 1600, 2400]), [640, 1000]);
  assert.deepEqual(images.ladder(500, [640, 1600, 2400]), [500]);
  assert.deepEqual(images.ladder(3000, [640, 1600, 2400]), [640, 1600, 2400]);
});

test('variantName keeps the folders below wp-content/uploads/', () => {
  assert.equal(
    images.variantName('wp-content/uploads/2025/07/Zoya1-scaled.jpg', 'abcdef12', 640, 'avif'),
    'wp-content/variants/2025/07/Zoya1-scaled-abcdef12-640.avif',
  );
  assert.equal(
    images.variantName('wp-content/uploads/a.b.png', '00000000', 32, 'png'),
    'wp-content/variants/a.b-00000000-32.png',
  );
});

test('toUploadPath reads root, relative, absolute and encoded upload URLs', () => {
  const want = 'wp-content/uploads/2025/07/Zoya1-scaled.jpg';
  assert.equal(images.toUploadPath('/wp-content/uploads/2025/07/Zoya1-scaled.jpg'), want);
  assert.equal(images.toUploadPath('wp-content/uploads/2025/07/Zoya1-scaled.jpg'), want);
  assert.equal(images.toUploadPath(`https://nellisarchitecture.com/${want}`), want);
  assert.equal(images.toUploadPath(`/${want}?v=2#x`), want);
  assert.equal(
    images.toUploadPath('/wp-content/uploads/2025/05/cropped-%D1%84-1-32x32.png'),
    'wp-content/uploads/2025/05/cropped-ф-1-32x32.png',
  );
  assert.equal(images.toUploadPath('/wp-content/uploads/a%E0%A4%A.jpg'), null);
  assert.equal(images.toUploadPath('https://example.com/wp-content/uploads/a.jpg'), null);
  assert.equal(images.toUploadPath('/wp-content/themes/a.jpg'), null);
  assert.equal(images.toUploadPath('/images/a.jpg'), null);
});

test('manifestEntry: AVIF and JPEG widths, PNG for alpha', () => {
  const base = {
    width: 1000, height: 500, hash: 'abcdef12', lqip: 'data:image/webp;base64,AA',
  };
  assert.deepEqual(images.manifestEntry({ ...base, alpha: false }), {
    width: 1000,
    height: 500,
    alpha: false,
    hash: 'abcdef12',
    widths: { avif: [320, 640, 960, 1000], jpg: [640, 1000] },
    lqip: 'data:image/webp;base64,AA',
  });
  assert.deepEqual(
    images.manifestEntry({ ...base, alpha: true }).widths,
    { avif: [320, 640, 960, 1000], png: [640, 1000] },
  );
});

test('missing lists the used uploads without a manifest entry', () => {
  const manifest = { [A]: {} };
  assert.deepEqual(images.missing(manifest, [A, 'wp-content/uploads/b.png']), [
    'wp-content/uploads/b.png',
  ]);
  assert.deepEqual(images.missing({}, []), []);
});

test('usedImages finds upload refs in sources, skips videos, SVG and GIF', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'images-'));
  try {
    fs.mkdirSync(path.join(dir, 'content', 'news'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'data'));
    fs.writeFileSync(path.join(dir, 'content', 'news', 'a.md'), [
      'hero: /wp-content/uploads/2025/01/a.jpg',
      '![x](https://nellisarchitecture.com/wp-content/uploads/2025/01/b%20c.PNG)',
      '/wp-content/uploads/2025/01/v.mp4 /wp-content/uploads/2025/01/s.svg',
      '/wp-content/uploads/g.gif',
    ].join('\n'));
    const search = '{"m":"\\/wp-content\\/uploads\\/d.webp"}';
    fs.writeFileSync(path.join(dir, 'data', 'search.json'), search);
    fs.mkdirSync(path.join(dir, 'news', 'x'), { recursive: true });
    const page = '<img srcset="/wp-content/uploads/e.jpeg 1x, /wp-content/uploads/f.jpg 2x">';
    fs.writeFileSync(path.join(dir, 'news', 'x', 'index.html'), page);
    assert.deepEqual(images.usedImages(dir), [
      'wp-content/uploads/2025/01/a.jpg',
      'wp-content/uploads/2025/01/b c.PNG',
      'wp-content/uploads/d.webp',
      'wp-content/uploads/e.jpeg',
      'wp-content/uploads/f.jpg',
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function ciRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'images-ci-'));
  fs.mkdirSync(path.join(dir, 'content', 'news'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'build'));
  fs.mkdirSync(path.join(dir, 'wp-content', 'uploads'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"devDependencies":{"sharp":"1.2.3"}}');
  fs.writeFileSync(path.join(dir, 'content', 'news', 'a.md'), `/${A} /${B}`);
  fs.writeFileSync(path.join(dir, 'wp-content', 'uploads', 'a.jpg'), 'a');
  fs.writeFileSync(path.join(dir, 'wp-content', 'uploads', 'b.jpg'), 'b');
  return dir;
}

const noInstall = () => assert.fail('must not install');

test('ensureVariants is a no-op without WORKERS_CI', async () => {
  const dir = ciRoot();
  try {
    const manifest = await images.ensureVariants(dir, { env: {}, install: noInstall });
    assert.deepEqual(manifest, {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureVariants is a no-op in CI when nothing is missing', async () => {
  const dir = ciRoot();
  try {
    const written = { [A]: { hash: 'x' }, [B]: { hash: 'y' } };
    fs.writeFileSync(path.join(dir, images.MANIFEST), JSON.stringify(written));
    const env = { WORKERS_CI: '1' };
    const manifest = await images.ensureVariants(dir, { env, install: noInstall });
    assert.deepEqual(manifest, written);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureVariants in CI makes the missing variants in memory, with the cap', async () => {
  const dir = ciRoot();
  try {
    fs.writeFileSync(path.join(dir, images.MANIFEST), '{}');
    const calls = [];
    const logs = [];
    const manifest = await images.ensureVariants(dir, {
      env: { WORKERS_CI: '1' },
      install: (version) => {
        calls.push(version);
        return 'sharp';
      },
      encode: async (lib, r, p) => ({ sharp: lib, p }),
      log: (line) => logs.push(line),
      maxImages: 1,
    });
    assert.deepEqual(calls, ['1.2.3']);
    assert.deepEqual(manifest, { [A]: { sharp: 'sharp', p: A } });
    assert.equal(fs.readFileSync(path.join(dir, images.MANIFEST), 'utf8'), '{}');
    assert.equal(logs.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureVariants never throws: an install failure logs one line', async () => {
  const dir = ciRoot();
  try {
    const logs = [];
    const manifest = await images.ensureVariants(dir, {
      env: { WORKERS_CI: '1' },
      install: () => {
        throw new Error('no network');
      },
      log: (line) => logs.push(line),
    });
    assert.deepEqual(manifest, {});
    assert.deepEqual(logs, ['images: CI fallback skipped (no network)']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureVariants stops after maxMs', async () => {
  const dir = ciRoot();
  try {
    let t = 0;
    const manifest = await images.ensureVariants(dir, {
      env: { WORKERS_CI: '1' },
      install: () => 'sharp',
      encode: async () => {
        t += 10;
        return {};
      },
      log: () => {},
      maxMs: 5,
      now: () => t,
    });
    assert.deepEqual(Object.keys(manifest), [A]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('every variant that build/images.json names exists on disk', (t) => {
  if (!fs.existsSync(manifestFile)) {
    t.skip('build/images.json does not exist yet: run npm run images');
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const absent = images.variantFiles(manifest).filter((f) => !fs.existsSync(path.join(root, f)));
  assert.deepEqual(absent, []);
});

test('report the used uploads without a manifest entry (warning only)', () => {
  const manifest = images.readManifest(root);
  const absent = images.missing(manifest, images.usedImages(root))
    .filter((p) => fs.existsSync(path.join(root, p)));
  if (absent.length) {
    console.warn(`warning: ${absent.length} uploads have no variants; run npm run images:\n`
      + `${absent.join('\n')}`);
  }
});

test('encodeImage writes the ladder: JPEG for opaque, PNG for alpha, rotated size', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'images-enc-'));
  try {
    const up = path.join(dir, 'wp-content', 'uploads', '2025');
    fs.mkdirSync(up, { recursive: true });
    const red = { r: 255, g: 0, b: 0 };
    await sharp({
      create: {
        width: 700, height: 300, channels: 3, background: red,
      },
    })
      .withMetadata({ orientation: 6 }).jpeg().toFile(path.join(up, 'a.jpg'));
    await sharp({
      create: {
        width: 400, height: 200, channels: 4, background: { ...red, alpha: 0.5 },
      },
    })
      .png().toFile(path.join(up, 'b.png'));
    const a = await images.encodeImage(sharp, dir, 'wp-content/uploads/2025/a.jpg');
    const b = await images.encodeImage(sharp, dir, 'wp-content/uploads/2025/b.png');
    assert.deepEqual([a.width, a.height, a.alpha], [300, 700, false]);
    assert.deepEqual(a.widths, { avif: [300], jpg: [300] });
    assert.deepEqual([b.alpha, b.widths], [true, { avif: [320, 400], png: [400] }]);
    assert.match(a.lqip, /^data:image\/webp;base64,/);
    const files = images.variantFiles({
      'wp-content/uploads/2025/a.jpg': a, 'wp-content/uploads/2025/b.png': b,
    });
    assert.equal(files.length, 5);
    const meta = await sharp(path.join(dir, files[0])).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['heif', 300, 700]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

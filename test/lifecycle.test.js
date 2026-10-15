const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { rules, readDays, command } = require('../infra/lifecycle');
const pkg = require('../package.json');

const ROOT = path.join(__dirname, '..');

const tmpRoot = (forms) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-'));
  fs.mkdirSync(path.join(root, 'content', 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'content', 'pages', 'site.json'), JSON.stringify({ forms }));
  return root;
};

test('rules(90): files 90 days, pending 1 day, abort multipart 7 days', () => {
  const byId = Object.fromEntries(rules(90).rules.map((r) => [r.id, r]));
  const ids = ['pending-submissions', 'delete-form-files', 'abort-multipart'];
  assert.deepEqual(Object.keys(byId), ids);
  assert.equal(byId['delete-form-files'].conditions.prefix, '');
  const files = byId['delete-form-files'].deleteObjectsTransition.condition;
  assert.deepEqual(files, { type: 'Age', maxAge: 7776000 });
  assert.equal(byId['pending-submissions'].conditions.prefix, 'pending/');
  assert.equal(byId['pending-submissions'].deleteObjectsTransition.condition.maxAge, 86400);
  assert.equal(byId['abort-multipart'].abortMultipartUploadsTransition.condition.maxAge, 7 * 86400);
  Object.values(byId).forEach((r) => assert.equal(r.enabled, true));
});

test('readDays: the repo value is 90', () => {
  assert.equal(readDays(ROOT), 90);
});

test('readDays: a missing value gives 90', () => {
  assert.equal(readDays(tmpRoot({})), 90);
  assert.equal(readDays(tmpRoot(undefined)), 90);
});

test('readDays: 1 and 365 pass', () => {
  assert.equal(readDays(tmpRoot({ file_days: 1 })), 1);
  assert.equal(readDays(tmpRoot({ file_days: 365 })), 365);
});

test('readDays: a bad value throws a clear message', () => {
  [0, 366, 1.5, '90', null, -1].forEach((days) => {
    const message = /forms\.file_days: .* is not a whole number from 1 to 365/;
    assert.throws(() => readDays(tmpRoot({ file_days: days })), message, String(days));
  });
});

test('command: the pinned wrangler version and the bucket from wrangler.jsonc', () => {
  const wrangler = JSON.parse(fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8'));
  assert.deepEqual(command(ROOT), [
    '--yes', `wrangler@${pkg.devDependencies.wrangler}`, 'r2', 'bucket', 'lifecycle', 'set',
    wrangler.r2_buckets[0].bucket_name,
    '--file', path.join(ROOT, '.wrangler', 'r2-lifecycle.json'), '--force',
  ]);
  assert.equal(wrangler.r2_buckets[0].bucket_name, 'landing-forms');
});

test('the deploy script sets the lifecycle first, then deploys', () => {
  const wrangler = `npx --yes wrangler@${pkg.devDependencies.wrangler} deploy`;
  assert.equal(pkg.scripts.deploy, `node infra/lifecycle.js && ${wrangler}`);
});

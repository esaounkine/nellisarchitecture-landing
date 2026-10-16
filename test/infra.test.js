const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  DESIRED, workerName, bucketName, bucketPlan, linkSecretPlan, oauthSecretPlan, pickProduction,
  extraTriggers,
  varsPlan, widgetPlan,
} = require('../infra/cloudflare');
const pkg = require('../package.json');

const prod = { trigger_uuid: 'p', branch_includes: ['master'] };
const preview = { trigger_uuid: 'v', branch_includes: ['*'] };

test('pickProduction: matches the branch', () => {
  assert.equal(pickProduction([preview, prod], 'master'), prod);
});

test('pickProduction: one trigger with another branch is the production trigger', () => {
  const only = { trigger_uuid: 'm', branch_includes: ['spike/cloudflare'] };
  assert.equal(pickProduction([only], 'master'), only);
});

test('pickProduction: two or more triggers and no match throws', () => {
  const other = { trigger_uuid: 'o', branch_includes: ['spike/cloudflare'] };
  assert.throws(() => pickProduction([preview, other], 'master'), /none for branch/);
});

test('pickProduction: no trigger throws', () => {
  assert.throws(() => pickProduction([], 'master'), /0 triggers/);
});

test('extraTriggers: all triggers except production', () => {
  assert.deepEqual(extraTriggers([preview, prod], prod), [preview]);
  assert.deepEqual(extraTriggers([prod], prod), []);
});

test('varsPlan: sets missing and changed variables, removes extra ones', () => {
  const live = {
    A: { value: 'old', is_secret: false },
    S: { value: null, is_secret: true },
    X: { value: '1', is_secret: false },
  };
  assert.deepEqual(varsPlan(live, { A: 'new', B: '1', S: 's' }), {
    set: {
      A: { value: 'new', is_secret: false },
      B: { value: '1', is_secret: false },
      S: { value: 's', is_secret: false },
    },
    remove: ['X'],
  });
});

test('varsPlan: an array answer stops the run', () => {
  assert.throws(() => varsPlan([{ name: 'A' }], { A: '1' }), /expected a map/);
});

test('varsPlan: nothing to do when equal', () => {
  const live = { A: { value: '1', is_secret: false, created_on: 'x' } };
  assert.deepEqual(varsPlan(live, { A: '1' }), { set: {}, remove: [] });
});

test('DESIRED production builds master only', () => {
  assert.deepEqual(DESIRED.production.branch_includes, ['master']);
});

test('DESIRED commands are package.json scripts', () => {
  const script = (cmd) => cmd.match(/^npm run (\S+)$/)[1];
  assert.ok(pkg.scripts[script(DESIRED.production.build_command)]);
  assert.ok(pkg.scripts[script(DESIRED.production.deploy_command)]);
});

test('workerName reads the name from wrangler.jsonc', () => {
  assert.equal(workerName(path.join(__dirname, '..')), 'landing');
});

const want = { name: 'landing', domains: ['a.dev', 'b.com'], mode: 'managed' };

test('widgetPlan: no widget with the name creates one', () => {
  assert.equal(widgetPlan([], want), 'create');
  assert.equal(widgetPlan([{ ...want, name: 'other' }], want), 'create');
});

test('widgetPlan: same domains in any order and same mode is none', () => {
  assert.equal(widgetPlan([{ ...want, domains: ['b.com', 'a.dev'], sitekey: 'k' }], want), 'none');
});

test('widgetPlan: other domains or another mode updates', () => {
  assert.equal(widgetPlan([{ ...want, domains: ['a.dev'] }], want), 'update');
  assert.equal(widgetPlan([{ ...want, domains: ['a.dev', 'b.com', 'c.org'] }], want), 'update');
  assert.equal(widgetPlan([{ ...want, domains: ['a.dev', 'x.com'] }], want), 'update');
  assert.equal(widgetPlan([{ ...want, mode: 'invisible' }], want), 'update');
});

test('DESIRED.turnstile allows the workers.dev host and the production domain', () => {
  assert.deepEqual(DESIRED.turnstile, {
    name: 'landing',
    domains: ['landing.nellisarchitecture.workers.dev', 'nellisarchitecture.com'],
    mode: 'managed',
  });
});

test('bucketName reads the R2 bucket from wrangler.jsonc', () => {
  assert.equal(bucketName(path.join(__dirname, '..')), 'landing-forms');
});

test('bucketPlan: creates the bucket only when it is missing', () => {
  assert.equal(bucketPlan([], 'landing-forms'), 'create');
  assert.equal(bucketPlan([{ name: 'other' }], 'landing-forms'), 'create');
  assert.equal(bucketPlan([{ name: 'other' }, { name: 'landing-forms' }], 'landing-forms'), 'none');
});

test('linkSecretPlan: sets LINK_SECRET only when missing, never overwrites it', () => {
  assert.equal(linkSecretPlan([]), 'create');
  assert.equal(linkSecretPlan([{ name: 'TURNSTILE_SECRET', type: 'secret_text' }]), 'create');
  assert.equal(linkSecretPlan([{ name: 'LINK_SECRET', type: 'secret_text' }]), 'none');
});

test('oauthSecretPlan: both values in env set both secrets every run', () => {
  const env = { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' };
  assert.equal(oauthSecretPlan([], env), 'set');
  assert.equal(oauthSecretPlan(['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'], env), 'set');
});

test('oauthSecretPlan: no values keep the secrets of the Worker', () => {
  const names = ['LINK_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];
  assert.equal(oauthSecretPlan(names, {}), 'keep');
});

test('oauthSecretPlan: no values and a missing secret is missing', () => {
  assert.equal(oauthSecretPlan([], {}), 'missing');
  assert.equal(oauthSecretPlan(['GITHUB_CLIENT_ID'], {}), 'missing');
  assert.equal(oauthSecretPlan(['GITHUB_CLIENT_SECRET'], { GITHUB_CLIENT_ID: '' }), 'missing');
});

test('oauthSecretPlan: only one value throws', () => {
  assert.throws(() => oauthSecretPlan([], { GITHUB_CLIENT_ID: 'id' }), /GITHUB_CLIENT_SECRET/);
  const names = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];
  assert.throws(() => oauthSecretPlan(names, { GITHUB_CLIENT_SECRET: 's' }), /or neither/);
});

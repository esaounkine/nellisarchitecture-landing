const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  DESIRED, workerName, pickProduction, extraTriggers, varsPlan,
} = require('../infra/cloudflare');
const pkg = require('../package.json');

const prod = { trigger_uuid: 'p', branch_includes: ['spike/cloudflare'] };
const preview = { trigger_uuid: 'v', branch_includes: ['*'] };

test('pickProduction: matches the branch', () => {
  assert.equal(pickProduction([preview, prod], 'spike/cloudflare'), prod);
});

test('pickProduction: one trigger with another branch is the production trigger', () => {
  const only = { trigger_uuid: 'm', branch_includes: ['master'] };
  assert.equal(pickProduction([only], 'spike/cloudflare'), only);
});

test('pickProduction: two or more triggers and no match throws', () => {
  const other = { trigger_uuid: 'o', branch_includes: ['master'] };
  assert.throws(() => pickProduction([preview, other], 'spike/cloudflare'), /none for branch/);
});

test('pickProduction: no trigger throws', () => {
  assert.throws(() => pickProduction([], 'spike/cloudflare'), /0 triggers/);
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

test('DESIRED commands are package.json scripts', () => {
  const script = (cmd) => cmd.match(/^npm run (\S+)$/)[1];
  assert.ok(pkg.scripts[script(DESIRED.production.build_command)]);
  assert.ok(pkg.scripts[script(DESIRED.production.deploy_command)]);
});

test('workerName reads the name from wrangler.jsonc', () => {
  assert.equal(workerName(path.join(__dirname, '..')), 'landing');
});

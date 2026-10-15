const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DAY = 86400;
const DEFAULT_DAYS = 90;

const age = (days) => ({ condition: { type: 'Age', maxAge: days * DAY } });

/* Lifecycle "set" replaces all rules, so this list is the full bucket lifecycle. */
const rules = (days) => ({
  rules: [
    {
      id: 'pending-submissions',
      enabled: true,
      conditions: { prefix: 'pending/' },
      deleteObjectsTransition: age(1),
    },
    {
      id: 'delete-form-files',
      enabled: true,
      conditions: { prefix: '' },
      deleteObjectsTransition: age(days),
    },
    {
      id: 'abort-multipart',
      enabled: true,
      conditions: { prefix: '' },
      abortMultipartUploadsTransition: age(7),
    },
  ],
});

const readJson = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

const readDays = (root = ROOT) => {
  const { forms = {} } = readJson(root, 'content/pages/site.json');
  const days = forms.file_days;
  if (days === undefined) return DEFAULT_DAYS;
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    const shown = JSON.stringify(days);
    throw new Error(`content/pages/site.json forms.file_days: ${shown} is not a whole number `
      + 'from 1 to 365.');
  }
  return days;
};

const lifecycleFile = (root) => path.join(root, '.wrangler', 'r2-lifecycle.json');

// wrangler.jsonc has no comments, so JSON.parse reads it (as in infra/cloudflare.js).
const command = (root = ROOT) => {
  const version = readJson(root, 'package.json').devDependencies.wrangler;
  const bucket = readJson(root, 'wrangler.jsonc').r2_buckets[0].bucket_name;
  return ['--yes', `wrangler@${version}`, 'r2', 'bucket', 'lifecycle', 'set', bucket,
    '--file', lifecycleFile(root), '--force'];
};

const main = () => {
  const days = readDays();
  const file = lifecycleFile(ROOT);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(rules(days), null, 2)}\n`);
  console.log(`R2 lifecycle: delete form files after ${days} days`);
  const run = spawnSync('npx', command(), { stdio: 'inherit' });
  if (run.status !== 0) process.exitCode = 1;
};

module.exports = {
  rules, readDays, command, DEFAULT_DAYS,
};

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

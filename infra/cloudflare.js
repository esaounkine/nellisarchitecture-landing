const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://api.cloudflare.com/client/v4';
const DOCS = 'docs/workflow/development.md → Hosting — Cloudflare Workers → Setup as code';

const DESIRED = {
  production: {
    branch_includes: ['spike/cloudflare'],
    branch_excludes: [],
    build_command: 'npm run build',
    deploy_command: 'npm run deploy',
    root_directory: '/',
    build_caching_enabled: true,
  },
  variables: { SKIP_DEPENDENCY_INSTALL: '1' },
  turnstile: {
    name: 'landing',
    domains: ['landing.nellisarchitecture.workers.dev', 'nellisarchitecture.com'],
    mode: 'managed',
  },
};

// wrangler.jsonc has no comments, so JSON.parse reads it. Upgrade: strip comments if one is added.
const workerName = (root = ROOT) => JSON.parse(
  fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'),
).name;

const pickProduction = (list, branch) => {
  const match = list.find((t) => (t.branch_includes || []).includes(branch));
  if (match) return match;
  if (list.length === 1) return list[0];
  throw new Error(`${list.length} triggers, none for branch "${branch}". Check the dashboard.`);
};

const extraTriggers = (list, prod) => list.filter((t) => t.trigger_uuid !== prod.trigger_uuid);

// live: the API result, a map { KEY: { value, is_secret, created_on } }. Secret values are null.
const varsPlan = (live, desired) => {
  if (Array.isArray(live)) throw new Error('environment_variables: expected a map, got an array');
  const set = {};
  Object.entries(desired).forEach(([key, value]) => {
    const now = live[key];
    if (!now || now.value !== value || now.is_secret) set[key] = { value, is_secret: false };
  });
  const remove = Object.keys(live).filter((key) => !(key in desired));
  return { set, remove };
};

const widgetPlan = (list, desired) => {
  const live = list.find((w) => w.name === desired.name);
  if (!live) return 'create';
  const same = live.mode === desired.mode
    && live.domains.length === desired.domains.length
    && desired.domains.every((d) => live.domains.includes(d));
  return same ? 'none' : 'update';
};

const api = async (urlPath, { method = 'GET', body } = {}) => {
  // eslint-disable-next-line n/no-unsupported-features/node-builtins -- runs on Node 24 (.nvmrc)
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const errors = JSON.stringify(json.errors || []);
    throw new Error(`${method} ${urlPath}: HTTP ${res.status} ${errors}`);
  }
  return json.result;
};

const main = async () => {
  const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: acct } = process.env;
  if (!token || !acct) {
    throw new Error(`Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. See ${DOCS}.`);
  }
  const name = workerName();
  const scripts = await api(`/accounts/${acct}/workers/scripts`);
  const script = scripts.find((s) => s.id === name);
  if (!script) throw new Error(`Worker "${name}" not found. Do the bootstrap first: ${DOCS}.`);
  const list = await api(`/accounts/${acct}/builds/workers/${script.tag}/triggers`);
  const prod = pickProduction(list, DESIRED.production.branch_includes[0]);
  const uuid = prod.trigger_uuid;

  const body = DESIRED.production;
  await api(`/accounts/${acct}/builds/triggers/${uuid}`, { method: 'PATCH', body });
  console.log(`trigger ${uuid}: set ${JSON.stringify(body)}`);

  await extraTriggers(list, prod).reduce((chain, t) => chain.then(async () => {
    await api(`/accounts/${acct}/builds/triggers/${t.trigger_uuid}`, { method: 'DELETE' });
    console.log(`trigger ${t.trigger_uuid}: deleted`);
  }), Promise.resolve());

  const varsPath = `/accounts/${acct}/builds/triggers/${uuid}/environment_variables`;
  const live = await api(varsPath) || {};
  const { set, remove } = varsPlan(live, DESIRED.variables);
  if (Object.keys(set).length) {
    await api(varsPath, { method: 'PATCH', body: set });
    console.log(`variables: set ${Object.keys(set).join(', ')}`);
  }
  await remove.reduce((chain, key) => chain.then(async () => {
    await api(`${varsPath}/${encodeURIComponent(key)}`, { method: 'DELETE' });
    const note = live[key].is_secret ? ' (secret, value is lost)' : '';
    console.log(`variables: deleted ${key}${note}`);
  }), Promise.resolve());
  console.log('Cloudflare build settings are up to date.');

  const want = DESIRED.turnstile;
  const widgetsPath = `/accounts/${acct}/challenges/widgets`;
  const widgets = await api(widgetsPath);
  const plan = widgetPlan(widgets, want);
  const current = widgets.find((w) => w.name === want.name);
  const widgetPath = current && `${widgetsPath}/${current.sitekey}`;
  const widget = await {
    create: () => api(widgetsPath, { method: 'POST', body: want }),
    update: () => api(widgetPath, { method: 'PUT', body: want }),
    none: () => api(widgetPath),
  }[plan]();
  console.log(`turnstile: ${plan}; sitekey ${widget.sitekey} (SITEKEY in js/forms.js)`);
  if (!widget.secret) {
    console.log('turnstile: the API answer has no secret.');
    console.log('Set it by hand: npx wrangler secret put TURNSTILE_SECRET');
    return;
  }
  await api(`/accounts/${acct}/workers/scripts/${name}/secrets`, {
    method: 'PUT',
    body: { name: 'TURNSTILE_SECRET', text: widget.secret, type: 'secret_text' },
  });
  console.log(`Worker ${name}: secret TURNSTILE_SECRET set`);
};

module.exports = {
  DESIRED, workerName, pickProduction, extraTriggers, varsPlan, widgetPlan, api,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

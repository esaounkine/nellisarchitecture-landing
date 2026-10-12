const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { robots } = require('../build/lib/robots');

const SITEMAP = 'Sitemap: https://nellisarchitecture.com/sitemap.xml';

test('robots adds one Sitemap line after the CMS rules', () => {
  const rules = 'User-agent: *\nDisallow: /admin/';
  assert.equal(robots(rules), `User-agent: *\nDisallow: /admin/\n\n${SITEMAP}\n`);
});

test('robots drops a Sitemap line typed in the CMS, in any case', () => {
  const typed = 'sitemap: https://x.com/sitemap_index.xml\nSITEMAP:/a.xml';
  const out = robots(`User-agent: *\r\n${typed}\nAllow: /`);
  assert.equal(out, `User-agent: *\nAllow: /\n\n${SITEMAP}\n`);
  assert.equal(out.match(/sitemap:/gi).length, 1);
});

test('robots with empty rules still has the Sitemap line', () => {
  assert.equal(robots(''), `${SITEMAP}\n`);
  assert.equal(robots(undefined), `${SITEMAP}\n`);
});

test('robots.txt on disk is the build output of content/robots.json', () => {
  const root = path.join(__dirname, '..');
  const { rules } = JSON.parse(fs.readFileSync(path.join(root, 'content', 'robots.json'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(root, 'robots.txt'), 'utf8'), robots(rules));
});

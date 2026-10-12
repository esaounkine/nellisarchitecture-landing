const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rss } = require('../build/lib/feed');

const post = (n, extra = {}) => ({
  title: `Post ${n}`,
  slug: `post-${n}`,
  description: `About ${n}`,
  dateObj: new Date(Date.UTC(2025, 0, n)),
  ...extra,
});
const items = (xml) => [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].map((m) => m[0]);

test('rss lists the 10 newest posts, newest first', () => {
  const posts = [5, 12, 1, 9, 3, 11, 7, 2, 10, 4, 8, 6].map((n) => post(n));
  const xml = rss(posts);
  const titles = items(xml).map((i) => i.match(/<title>(.*)<\/title>/)[1]);
  assert.deepEqual(titles, [12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((n) => `Post ${n}`));
});

test('rss items use absolute links, a permalink guid and RFC 822 dates', () => {
  const [item] = items(rss([post(7)]));
  assert.match(item, /<link>https:\/\/nellisarchitecture\.com\/news\/post-7\/<\/link>/);
  assert.match(item, /<guid isPermaLink="true">https:\/\/nellisarchitecture\.com\/news\/post-7\/</);
  assert.match(item, /<pubDate>Tue, 07 Jan 2025 00:00:00 GMT<\/pubDate>/);
  assert.match(item, /<description>About 7<\/description>/);
});

test('rss escapes & and < in titles and descriptions', () => {
  const [item] = items(rss([post(1, { title: 'A & B <C>', description: 'x < y & z' })]));
  assert.match(item, /<title>A &amp; B &lt;C&gt;<\/title>/);
  assert.match(item, /<description>x &lt; y &amp; z<\/description>/);
});

test('rss channel: self link, home link, lastBuildDate = newest post date', () => {
  const xml = rss([post(2), post(5)]);
  assert.match(xml, /<atom:link href="https:\/\/nellisarchitecture\.com\/feed\/" rel="self"/);
  assert.match(xml, /<link>https:\/\/nellisarchitecture\.com\/<\/link>/);
  assert.match(xml, /<lastBuildDate>Sun, 05 Jan 2025 00:00:00 GMT<\/lastBuildDate>/);
});

test('rss is deterministic and handles no posts', () => {
  const posts = [post(1), post(2)];
  assert.equal(rss(posts), rss(posts));
  assert.equal(items(rss([])).length, 0);
});

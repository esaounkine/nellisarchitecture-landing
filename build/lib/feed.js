const { escText } = require('./html');
const { DOMAIN } = require('./seo');

const LIMIT = 10;

/* lastBuildDate is the newest post date, not the build time: the build stays idempotent. */
function rss(posts) {
  const newest = [...posts].sort((a, b) => b.dateObj - a.dateObj).slice(0, LIMIT);
  const items = newest.map((p) => {
    const url = `${DOMAIN}/news/${p.slug}/`;
    return '  <item>\n'
      + `    <title>${escText(p.title)}</title>\n`
      + `    <link>${url}</link>\n`
      + `    <guid isPermaLink="true">${url}</guid>\n`
      + `    <pubDate>${p.dateObj.toUTCString()}</pubDate>\n`
      + `    <description>${escText(p.description)}</description>\n`
      + '  </item>\n';
  });
  const built = newest.length ? newest[0].dateObj.toUTCString() : new Date(0).toUTCString();
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
    + '<channel>\n'
    + '  <title>Nellis Architecture</title>\n'
    + `  <atom:link href="${DOMAIN}/feed/" rel="self" type="application/rss+xml" />\n`
    + `  <link>${DOMAIN}/</link>\n`
    + '  <description></description>\n'
    + `  <lastBuildDate>${built}</lastBuildDate>\n`
    + '  <language>en-US</language>\n'
    + `${items.join('')}</channel>\n</rss>\n`;
}

module.exports = { rss, LIMIT };

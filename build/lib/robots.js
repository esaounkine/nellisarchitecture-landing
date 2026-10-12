const { DOMAIN } = require('./seo');

/* CMS rules plus one Sitemap line; a Sitemap line typed in the CMS is dropped. */
function robots(rules) {
  const body = String(rules || '').split(/\r?\n/)
    .filter((l) => !/^\s*sitemap\s*:/i.test(l))
    .join('\n')
    .trim();
  return `${body ? `${body}\n\n` : ''}Sitemap: ${DOMAIN}/sitemap.xml\n`;
}

module.exports = { robots };

const {
  escText, escAttr, fill, lazyImg, loadPartial,
} = require('../html');
const {
  head, top, affiliations, footer,
} = require('../chrome');

/* Head and SEO values stay here until card yGn1v4co moves them to the CMS (D3). Raw HTML. */
/* eslint-disable @stylistic/max-len -- raw WordPress head values, kept byte for byte */
const HEAD = {
  BEFORE: '',
  IDENTITY: '',
  TITLE: 'Nellis Architecture Studio',
  DESCRIPTION: 'Discover Nellis Architecture Studio in Dubai. Experts in luxury villa design, master planning, interiors, and landscape architecture for high-end residential and investment projects.',
  CANONICAL: 'studio.html',
  OG_TYPE: 'article',
  OG_TITLE: 'Architecture Studio Dubai | Luxury Villa Design &amp; Interiors',
  OG_DESCRIPTION: 'Discover Nellis Architecture Studio in Dubai. Experts in luxury villa design, master planning, interiors, and landscape architecture for high-end residential and investment projects.',
  OG_URL: 'https://nellisarchitecture.com/studio/',
  MODIFIED_TIME: '2026-04-24T06:23:40+00:00',
  SCHEMA: '{"@context":"https:\\/\\/schema.org","@graph":[{"@type":"WebPage","@id":"https:\\/\\/nellisarchitecture.com\\/studio\\/","url":"https:\\/\\/nellisarchitecture.com\\/studio\\/","name":"Architecture Studio Dubai | Luxury Villa Design & Interiors","isPartOf":{"@id":"https:\\/\\/nellisarchitecture.com\\/#website"},"datePublished":"2025-02-15T21:05:18+00:00","dateModified":"2026-04-24T06:23:40+00:00","description":"Discover Nellis Architecture Studio in Dubai. Experts in luxury villa design, master planning, interiors, and landscape architecture for high-end residential and investment projects.","breadcrumb":{"@id":"https:\\/\\/nellisarchitecture.com\\/studio\\/#breadcrumb"},"inLanguage":"en-US","potentialAction":[{"@type":"ReadAction","target":["https:\\/\\/nellisarchitecture.com\\/studio\\/"]}]},{"@type":"BreadcrumbList","@id":"https:\\/\\/nellisarchitecture.com\\/studio\\/#breadcrumb","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https:\\/\\/nellisarchitecture.com\\/"},{"@type":"ListItem","position":2,"name":"Architecture Studio Dubai"}]},{"@type":"WebSite","@id":"https:\\/\\/nellisarchitecture.com\\/#website","url":"https:\\/\\/nellisarchitecture.com\\/","name":"Nellis Architecture","description":"","potentialAction":[{"@type":"SearchAction","target":{"@type":"EntryPoint","urlTemplate":"https:\\/\\/nellisarchitecture.com\\/?s={search_term_string}"},"query-input":{"@type":"PropertyValueSpecification","valueRequired":true,"valueName":"search_term_string"}}],"inLanguage":"en-US"}]}',
};
/* eslint-enable @stylistic/max-len */

/* Quote text: each line break becomes <br>. */
function quoteLines(text) {
  return String(text || '').trim().split(/\r?\n/)
    .map(escText)
    .join('<br>');
}

function services({ button, items }) {
  const tpl = loadPartial('studio-service');
  return items.map((s) => fill(tpl, {
    LINK: escAttr(s.link),
    TITLE: escText(s.title),
    BUTTON: escText(button),
  })).join('\n');
}

/* Marquee item. The theme loop gives the first item and the next items different indents. */
function values(items, first, next, indent) {
  const pad = (n) => ' '.repeat(n);
  return items.map((v, i) => `${pad(i ? next : first)}<div class="sprintLine__item">\n`
    + `${pad(indent + 2)}<h3>${escText(v.title)}:</h3>\n`
    + `${pad(indent + 2)}<p>\n`
    + `${pad(indent + 4)}${escText(v.text)}${pad(indent + 2)}</p>\n`
    + `${pad(indent)}</div>`).join('\n');
}

function render(content, { site, newsHref }) {
  const { intro, founder } = content;
  return [
    head(HEAD),
    top(content.h1, site),
    fill(loadPartial('page-studio'), {
      NEWS_HREF: escAttr(newsHref),
      AFFILIATIONS: affiliations(site.affiliations, '  ', 8),
      INTRO_TITLE_ATTR: escAttr(intro.title),
      INTRO_TITLE: escText(intro.title),
      INTRO_SUBTITLE: escText(intro.subtitle),
      INTRO_PHOTO: lazyImg(intro.photo),
      INTRO_QUOTE: quoteLines(intro.quote),
      INTRO_QUOTE_AUTHOR: escText(intro.quote_author),
      PARAGRAPH_1: escText(intro.paragraphs[0]),
      PARAGRAPH_2: escText(intro.paragraphs[1]),
      BIG_IMAGE: lazyImg(intro.big_image),
      SERVICES_TITLE: escText(content.services.title),
      SERVICES: services(content.services),
      VALUES_TITLE: escText(content.values.title),
      VALUES_1: values(content.values.items, 20, 22, 12),
      VALUES_2: values(content.values.items, 18, 16, 10),
      FOUNDER_TITLE: escText(founder.title),
      FOUNDER_QUOTE: escText(founder.quote),
      FOUNDER_PHOTO_SRC: escAttr(founder.photo.src.replace(/^\//, '')),
      FOUNDER_PHOTO_ALT: escAttr(founder.photo.alt),
      FOUNDER_PHOTO_WIDTH: escAttr(founder.photo.width),
      FOUNDER_PHOTO_HEIGHT: escAttr(founder.photo.height),
      FOUNDER_LABEL: escText(founder.label),
      FOUNDER_NAME: escText(founder.name),
      FOUNDER_BIO: escText(founder.bio),
      FOUNDER_TEXT: escText(founder.text),
    }),
    footer(),
  ].join('\n');
}

module.exports = {
  render, quoteLines, services, values,
};

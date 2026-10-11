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
  TITLE: 'Architecture Team Dubai',
  DESCRIPTION: 'Meet the passionate team at Nellis Architecture. Our architects, designers, and creative experts bring innovation and artistry to every project.',
  CANONICAL: 'https://nellisarchitecture.com/people/',
  OG_TYPE: 'article',
  OG_TITLE: 'The People | Nellis Architecture Studio Team &amp; Experts Our Team',
  OG_DESCRIPTION: 'Meet the passionate team at Nellis Architecture. Our architects, designers, and creative experts bring innovation and artistry to every project.',
  OG_URL: 'https://nellisarchitecture.com/people/',
  MODIFIED_TIME: '2026-04-24T06:09:07+00:00',
  SCHEMA: '{"@context":"https:\\/\\/schema.org","@graph":[{"@type":"WebPage","@id":"https:\\/\\/nellisarchitecture.com\\/people\\/","url":"https:\\/\\/nellisarchitecture.com\\/people\\/","name":"The People | Nellis Architecture Studio Team & Experts Our Team","isPartOf":{"@id":"https:\\/\\/nellisarchitecture.com\\/#website"},"datePublished":"2025-02-16T23:39:25+00:00","dateModified":"2026-04-24T06:09:07+00:00","description":"Meet the passionate team at Nellis Architecture. Our architects, designers, and creative experts bring innovation and artistry to every project.","breadcrumb":{"@id":"https:\\/\\/nellisarchitecture.com\\/people\\/#breadcrumb"},"inLanguage":"en-US","potentialAction":[{"@type":"ReadAction","target":["https:\\/\\/nellisarchitecture.com\\/people\\/"]}]},{"@type":"BreadcrumbList","@id":"https:\\/\\/nellisarchitecture.com\\/people\\/#breadcrumb","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https:\\/\\/nellisarchitecture.com\\/"},{"@type":"ListItem","position":2,"name":"People | Nellis Architecture Studio Team & Experts"}]},{"@type":"WebSite","@id":"https:\\/\\/nellisarchitecture.com\\/#website","url":"https:\\/\\/nellisarchitecture.com\\/","name":"Nellis Architecture","description":"","potentialAction":[{"@type":"SearchAction","target":{"@type":"EntryPoint","urlTemplate":"https:\\/\\/nellisarchitecture.com\\/?s={search_term_string}"},"query-input":{"@type":"PropertyValueSpecification","valueRequired":true,"valueName":"search_term_string"}}],"inLanguage":"en-US"}]}',
};
/* eslint-enable @stylistic/max-len */

function intro(paragraphs) {
  return paragraphs.map((p) => `        <p>\n          ${escText(p)}        </p>`).join('\n');
}

/* Bio keeps its raw line breaks, as on the old site. */
function people(items) {
  const tpl = loadPartial('people-item');
  return items.map((p) => fill(tpl, {
    PHOTO: lazyImg(p.photo),
    NAME: escText(p.name),
    ROLE: escText(p.role),
    BIO: escText(p.bio),
  })).join('\n\n\n      \n');
}

function render(content, { site, newsHref }) {
  return [
    head(HEAD),
    top(content.h1, site),
    fill(loadPartial('page-people'), {
      NEWS_HREF: escAttr(newsHref),
      AFFILIATIONS: affiliations(site.affiliations, '  '),
      TITLE: escText(content.intro.title),
      INTRO: intro(content.intro.paragraphs),
      IMAGE: lazyImg(content.intro.image),
      PEOPLE: people(content.people),
    }),
    footer(),
  ].join('\n');
}

module.exports = { render, intro, people };

const { escAttr, fill, loadPartial } = require('../html');
const {
  head, top, affiliations, footer,
} = require('../chrome');

/* Head and SEO values stay here until card yGn1v4co moves them to the CMS (D3). Raw HTML. */
/* eslint-disable @stylistic/max-len -- raw WordPress head values, kept byte for byte */
const HEAD = {
  BEFORE: '',
  IDENTITY: [
    '  <!-- Netlify Identity: handles /#invite_token and /#recovery_token links, then sends editors to the CMS -->',
    '  <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>',
    '  <script>',
    '    if (window.netlifyIdentity) {',
    '      window.netlifyIdentity.on("init", function (user) {',
    '        if (!user) {',
    '          window.netlifyIdentity.on("login", function () {',
    '            document.location.href = "/admin/";',
    '          });',
    '        }',
    '      });',
    '    }',
    '  </script>',
    '',
  ].join('\n'),
  TITLE: 'Nellis Architecture | Award-Winning Architectural Design Firm',
  DESCRIPTION: 'Nellis Architecture is one of the best architecture firms in Dubai, delivering award-winning residential, commercial, and bespoke architectural design solutions.',
  CANONICAL: 'index.html',
  OG_TYPE: 'website',
  OG_TITLE: 'Nellis Architecture | Award-Winning Architectural Design Firm',
  OG_DESCRIPTION: 'Nellis Architecture is one of the best architecture firms in Dubai, delivering award-winning residential, commercial, and bespoke architectural design solutions.',
  OG_URL: 'https://nellisarchitecture.com/',
  MODIFIED_TIME: '2026-04-23T11:09:57+00:00',
  SCHEMA: '{"@context":"https:\\/\\/schema.org","@graph":[{"@type":"WebPage","@id":"https:\\/\\/nellisarchitecture.com\\/","url":"https:\\/\\/nellisarchitecture.com\\/","name":"Nellis Architecture | Award-Winning Architectural Design Firm","isPartOf":{"@id":"https:\\/\\/nellisarchitecture.com\\/#website"},"datePublished":"2025-02-15T22:04:15+00:00","dateModified":"2026-04-23T11:09:57+00:00","description":"Nellis Architecture is one of the best architecture firms in Dubai, delivering award-winning residential, commercial, and bespoke architectural design solutions.","breadcrumb":{"@id":"https:\\/\\/nellisarchitecture.com\\/#breadcrumb"},"inLanguage":"en-US","potentialAction":[{"@type":"ReadAction","target":["https:\\/\\/nellisarchitecture.com\\/"]}]},{"@type":"BreadcrumbList","@id":"https:\\/\\/nellisarchitecture.com\\/#breadcrumb","itemListElement":[{"@type":"ListItem","position":1,"name":"Home"}]},{"@type":"WebSite","@id":"https:\\/\\/nellisarchitecture.com\\/#website","url":"https:\\/\\/nellisarchitecture.com\\/","name":"Nellis Architecture","description":"","potentialAction":[{"@type":"SearchAction","target":{"@type":"EntryPoint","urlTemplate":"https:\\/\\/nellisarchitecture.com\\/?s={search_term_string}"},"query-input":{"@type":"PropertyValueSpecification","valueRequired":true,"valueName":"search_term_string"}}],"inLanguage":"en-US"}]}',
};
/* eslint-enable @stylistic/max-len */

function render(content, { site, newsHref }) {
  return [
    head(HEAD),
    top(content.h1, site),
    fill(loadPartial('page-index'), {
      NEWS_HREF: escAttr(newsHref),
      AFFILIATIONS: affiliations(site.affiliations, '  '),
      PROJECTS: loadPartial('index-projects'),
    }),
    footer(),
  ].join('\n');
}

module.exports = { render };

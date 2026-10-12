const {
  escText, escAttr, fill, lazyImg, loadPartial,
} = require('./html');

const OG_IMAGE = [
  // eslint-disable-next-line @stylistic/max-len -- raw WordPress head value, kept byte for byte
  '  <meta property="og:image" content="https://nellisarchitecture.com/wp-content/themes/nellis/assets/img/minis.png">',
  '  <meta property="og:image:width" content="968">',
  '  <meta property="og:image:height" content="504">',
].join('\n');

function head(values) {
  return fill(loadPartial('head'), { OG_IMAGE, ...values });
}

function formTokens(prefix, form) {
  return {
    [`${prefix}_TITLE`]: escText(form.title),
    [`${prefix}_DESCRIPTION`]: escText(form.description),
    [`${prefix}_BUTTON`]: escText(form.button),
    [`${prefix}_EMAIL_HREF`]: escAttr(form.email),
    [`${prefix}_EMAIL`]: escText(form.email),
  };
}

function top(h1, site) {
  return fill(loadPartial('top'), {
    H1: escText(h1),
    ...formTokens('CONTACT', site.forms.contact),
    ...formTokens('SKILLS', site.forms.skills),
  });
}

/* indent: one indent level of the host page (index uses 2 spaces, privacy 4).
   level: nesting depth of the partner div (Studio nests one level deeper). */
function affiliations(items, indent, level = 7) {
  const pad = (n) => indent.repeat(n);
  return items.map((img) => `${pad(level)}<div class="partner">\n`
    + `${pad(level + 1)}${lazyImg(img)}\n`
    + `${pad(level)}</div>`).join('\n');
}

function footer() {
  return loadPartial('footer');
}

module.exports = {
  head, top, affiliations, footer,
};

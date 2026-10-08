const {
  escText, escAttr, fill, lazyImg, loadPartial,
} = require('./html');

function head(values) {
  return fill(loadPartial('head'), values);
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

/* indent: one indent level of the host page (index uses 2 spaces, privacy 4). */
function affiliations(items, indent) {
  const pad = (n) => indent.repeat(n);
  return items.map((img) => `${pad(7)}<div class="partner">\n`
    + `${pad(8)}${lazyImg(img)}\n`
    + `${pad(7)}</div>`).join('\n');
}

function footer() {
  return loadPartial('footer');
}

module.exports = {
  head, top, affiliations, footer,
};

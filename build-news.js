#!/usr/bin/env node
/*
 * build-news.js — regenerates news pages from content/news/*.md
 * Runs automatically on Netlify after every CMS publish (see netlify.toml).
 * Zero dependencies: plain Node 18+.
 *
 *   node build-news.js
 *
 * What it does:
 *   1. Reads every markdown file in content/news/
 *   2. Renders news/<slug>/index.html from build/news-template.html
 *   3. Rebuilds the NewsList sidebar on every news page (newest first)
 *   4. Points the main-nav "News" link at the newest post
 *   5. Updates data/news.json (used by the in-page news switcher)
 *   6. Regenerates sitemap.xml
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DOMAIN = "https://nellisarchitecture.com";
const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };

/* ---------- tiny front-matter + markdown parser ---------- */
function parseMd(file) {
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error("bad front matter: " + file);
  const fm = {};
  m[1].split("\n").forEach((line) => {
    const kv = line.match(/^([a-z_]+):\s*("(?:[^"\\]|\\.)*"|.*)$/);
    if (!kv) return;
    let v = kv[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"');
    fm[kv[1]] = v;
  });
  return { fm, body: m[2].trim() };
}

function inlineMd(s) {
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="lazyload" />');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return s;
}

function mdToHtml(md) {
  const blocks = md.split(/\n{2,}/);
  let html = "";
  for (let b of blocks) {
    b = b.trim();
    if (!b) continue;
    if (/^#{2,4}\s/.test(b)) {
      const level = b.match(/^(#{2,4})/)[1].length;
      html += `<h${level}>${inlineMd(b.replace(/^#{2,4}\s*/, ""))}</h${level}>\n`;
    } else if (b === "---") {
      html += "<hr />\n";
    } else if (/^(- )/m.test(b)) {
      const items = b.split("\n").filter((l) => l.startsWith("- ")).map((l) => `<li>${inlineMd(l.slice(2))}</li>`).join("");
      html += `<ul>${items}</ul>\n`;
    } else if (b.startsWith("> ")) {
      html += `<blockquote>${inlineMd(b.replace(/^>\s?/gm, ""))}</blockquote>\n`;
    } else if (/^<img /.test(inlineMd(b))) {
      html += inlineMd(b) + "\n";
    } else {
      html += `<p>${inlineMd(b.replace(/\n/g, " "))}</p>\n`;
    }
  }
  return html.trim();
}

function parseDate(s) {
  const m = (s || "").match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return new Date(0);
  return new Date(Date.UTC(+m[3], MONTHS[m[1].toLowerCase()] || 0, +m[2]));
}
function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- load posts ---------- */
const dir = path.join(ROOT, "content", "news");
const posts = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => {
  const { fm, body } = parseMd(path.join(dir, f));
  if (!fm.id) fm.id = "md" + fm.slug;
  fm.html = mdToHtml(body);
  fm.dateObj = parseDate(fm.date);
  return fm;
});
function idNum(p) { const n = parseInt(p.id, 10); return isNaN(n) ? 0 : n; }
posts.sort((a, b) => (b.dateObj - a.dateObj) || (idNum(b) - idNum(a)));
if (!posts.length) { console.log("no posts"); process.exit(0); }

/* ---------- NewsList markup (matches original theme) ---------- */
function newsList(activeSlug) {
  return posts.map((p) => `                  <div class="NewsListItem"
            style="cursor: pointer;"
            data-id="${p.id}"
            data-slug="${p.slug}"
            data-permalink="../${p.slug}/index.html">
            <div class="NewsListData">${p.date || ""}</div>
            <h3 class="NewsListTitle">
              ${p.title}            </h3>
          </div>`).join("\n");
}

/* ---------- per-post page ---------- */
const template = fs.readFileSync(path.join(ROOT, "build", "news-template.html"), "utf8");
const newsJson = {};

for (const p of posts) {
  const newsImg = p.hero
    ? `<div class="NewsImg">\n            <img src="${p.hero}" alt="${esc(p.hero_alt || p.title)}" class="lazyload">\n          </div>`
    : `<div class="NewsImg" style="display: none;">\n          </div>`;
  const newsBtn = p.link
    ? `<a target="_blank" href="${p.link}" class="NewsBtn">MORE INFO <svg width="15" height="9" viewBox="0 0 15 9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.3536 4.85355C14.5488 4.65829 14.5488 4.34171 14.3536 4.14645L11.1716 0.964466C10.9763 0.769204 10.6597 0.769204 10.4645 0.964466C10.2692 1.15973 10.2692 1.47631 10.4645 1.67157L13.2929 4.5L10.4645 7.32843C10.2692 7.52369 10.2692 7.84027 10.4645 8.03553C10.2692 8.2308 10.9763 8.2308 11.1716 8.03553L14.3536 4.85355Z" fill="currentColor"/></svg></a>`
    : `<a href="../../index.html" class="NewsBtn"></a>`;
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: p.title, description: p.description || "",
        datePublished: p.dateObj.toISOString(), dateModified: p.dateObj.toISOString(),
        mainEntityOfPage: DOMAIN + "/news/" + p.slug + "/",
        author: { "@type": "Organization", name: "Nellis Architecture" },
        publisher: { "@type": "Organization", name: "Nellis Architecture" } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: DOMAIN + "/" },
        { "@type": "ListItem", position: 2, name: "News" },
        { "@type": "ListItem", position: 3, name: p.title } ] }
    ]
  });

  let html = template
    .replaceAll("{{SEO_TITLE}}", esc(p.seo_title || p.title + " | Nellis Architecture"))
    .replaceAll("{{META_DESC}}", esc(p.description || ""))
    .replace(/\{\{SLUG\}\}/g, p.slug)
    .replaceAll("{{OG_TITLE}}", esc(p.seo_title || p.title))
    .replaceAll("{{OG_DESC}}", esc(p.description || ""))
    .replaceAll("{{MOD_TIME}}", p.dateObj.toISOString())
    .replaceAll("{{SCHEMA}}", schema)
    .replaceAll("{{NEWS_IMG}}", newsImg)
    .replaceAll("{{TITLE}}", p.title)
    .replaceAll("{{DATE}}", p.date || "")
    .replaceAll("{{CONTENT}}", "\n" + p.html + "\n        ")
    .replaceAll("{{NEWS_BTN}}", newsBtn)
    .replaceAll("{{NEWSLIST}}", newsList(p.slug));

  const outDir = path.join(ROOT, "news", p.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);

  newsJson[p.id] = { success: true, data: {
    title: p.title, content: p.html, data: p.date || "",
    img: p.hero || "", imgalt: p.hero_alt || p.title, link: p.link || "", slug: p.slug
  }};
}

/* ---------- refresh NewsList inside every news page (incl. untouched ones) ---------- */
const newsDirs = fs.readdirSync(path.join(ROOT, "news")).filter((d) =>
  fs.existsSync(path.join(ROOT, "news", d, "index.html")));
for (const d of newsDirs) {
  const f = path.join(ROOT, "news", d, "index.html");
  let src = fs.readFileSync(f, "utf8");
  const i = src.indexOf('<div class="NewsList">');
  const j = src.indexOf('<div class="elscroll"></div>', i);
  if (i > -1 && j > i) {
    src = src.slice(0, i) + '<div class="NewsList">\n' + newsList(d) + "\n                " + src.slice(j);
    fs.writeFileSync(f, src);
  }
}

/* ---------- nav "News" link -> newest post ---------- */
const newest = posts[0];
const indexFile = path.join(ROOT, "index.html");
let idx = fs.readFileSync(indexFile, "utf8");
idx = idx.replace(/(<a[^>]*href=")news\/[^"]*\/index\.html("[^>]*>\s*News\s*<\/a>)/, "$1news/" + newest.slug + "/index.html$2");
fs.writeFileSync(indexFile, idx);

/* ---------- data/news.json ---------- */
fs.writeFileSync(path.join(ROOT, "data", "news.json"), JSON.stringify(newsJson));

/* ---------- sitemap.xml ---------- */
const urls = [
  { loc: DOMAIN + "/", pr: "1.0" },
  { loc: DOMAIN + "/studio/", pr: "0.8" },
  { loc: DOMAIN + "/people/", pr: "0.8" },
  { loc: DOMAIN + "/privacy/", pr: "0.2" },
  ...posts.map((p) => ({ loc: DOMAIN + "/news/" + p.slug + "/", pr: "0.6", lastmod: p.dateObj.toISOString().slice(0, 10) })),
];
const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.pr}</priority></url>`).join("\n") +
  `\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sm);

console.log(`built ${posts.length} news pages; newest: ${newest.slug}`);

# Nellis Architecture — Static Site

A 1:1 static rebuild of nellisarchitecture.com. No WordPress, no PHP, no database —
nothing for attackers to exploit. All original functionality (project overlays,
category filters, live search, news switching) is reproduced client-side from
static JSON snapshots.

## Process & docs

How this project is run — start here:

- **Conventions and working agreements:** [AGENTS.md](AGENTS.md) — principles, code style, content and SEO rules, testing.
- **How we work (workflows):** [development](docs/workflow/development.md) · [grooming](docs/workflow/grooming.md) · [incident response](docs/workflow/incident.md). Driven by `/ticket`, `/groom` and `/incident` in [Claude Code](https://code.claude.com/docs). Tool bindings (Trello, Netlify, commands) are in [development.md → Bindings](docs/workflow/development.md#bindings).
- **Tasks, requirements, decisions and status:** the **Website** board on Trello — <https://trello.com/b/9x8aKhpS/website>.
- **Hosting:** Netlify — <https://app.netlify.com/projects/nellis-arch/overview>. Preview: <https://nellis-arch.netlify.app>.

## Structure

```
index.html, {studio,people,privacy,contact}/index.html             # pages (generated)
news/index.html                                                    # news index: all articles, newest first (generated)
news/<slug>/index.html                                             # 58 articles (generated)
projects/index.html                                                # projects hub: all projects + category links (generated)
projects/<category>/index.html                                     # 4 category pages (generated)
projects/<category>/<slug>/index.html                              # 32 project pages (generated from data/projects.json)
wp-content/                                                        # theme assets + images
data/                 # static "backend": projects, search index, filters, news JSON
js/static-backend.js  # intercepts the theme's old AJAX calls, serves data/ instead
content/news/*.md     # news source of truth (edited via the CMS)
content/pages/*.json  # page content source of truth (edited via the CMS)
content/redirects.json # CMS redirects (301), source of truth (edited via the CMS)
_redirects            # Netlify redirects (generated from content/redirects.json + news slugs)
build/news-template.html
build/lib/            # page generator: helpers, page modules, partials/*.html
build-news.js         # regenerates news pages, generated pages, sitemap + feed.xml
feed.xml              # RSS feed, served at /feed/ (generated)
robots.txt            # crawl rules (generated from content/robots.json, edited in the CMS)
admin/                # Decap CMS (news and page editing UI)
netlify.toml          # build + headers + caching + redirects + 404 deny rules
eslint.config.mjs     # lint rules (npm run lint)
test/                 # unit tests (npm test)
```

## Deploy (Netlify, free tier)

1. Push this folder to a GitHub repo.
2. Netlify → Add new site → Import from Git → pick the repo.
   Build command and publish dir come from `netlify.toml` automatically.
3. Point the DNS for nellisarchitecture.com to Netlify.
4. In Netlify: **Site configuration → Forms** is already enabled by the
   `data-netlify` attributes — the two contact forms deliver submissions to
   Netlify (add email notifications under Forms → Notifications).
5. For the news admin: **Identity → Enable Identity**, then
   **Identity → Services → Git Gateway → Enable**. Invite the SEO team under
   **Identity → Invite users**.

## Updating news (SEO team)

1. Go to `nellisarchitecture.com/admin` and log in (Netlify Identity invite).
2. News → New article. Fill title, date, meta description, hero image, body.
3. Publish → the site rebuilds automatically in ~1 minute:
   new article page, refreshed sidebar on all 58 articles, the /news/ list,
   sitemap.xml, the RSS feed (feed.xml), and the in-page switcher data.
4. To hide an article from Google, turn on **Hide from search (noindex)**. The sitemap drops it; the site and the news list keep it.

To edit page texts (Home, Studio, People, Privacy, the News index, shared affiliations and forms), open **Pages** in `/admin`.

### Manual alternative (no CMS)

```bash
# edit or add a file in content/news/, then:
node build-news.js
# commit + push (Netlify rebuilds), or test locally:
npm run serve
```

To use the CMS on your computer, see [Local CMS](docs/workflow/development.md#commands).

## Notes

- Contact-form spam protection uses Netlify's honeypot; the old PHP captcha is gone.
- All absolute URLs (canonical, Open Graph, schema.org) intentionally keep the
  production domain — correct after DNS cutover.
- Google Analytics (G-5D57DNBBLX) is unchanged.

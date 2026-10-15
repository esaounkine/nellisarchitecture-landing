# Development workflow

How a task goes from **To do** to shipped. Any person or agent can follow this spec. The concrete tools are in [Bindings](#bindings).

Driver: `/ticket <card-url>` ([.claude/commands/ticket.md](../../.claude/commands/ticket.md)).

## Roles

| Role | Does | Agent |
|---|---|---|
| Operator | Prioritises, answers open decisions, reviews, pushes, closes cards. | the person |
| Orchestrator | Reads the card state, starts the hat for that state, moves the card. | main session |
| Architect | Checks for duplicates, writes the design and the plan. No code. | [architect](../../.claude/agents/architect.md) |
| Bar-raiser | Reviews the design (Architect BR) and the code (Dev BR). PASS or BLOCK. | [bar-raiser](../../.claude/agents/bar-raiser.md) |
| Developer | Implements the signed-off plan with tests. Commits locally. | [dev](../../.claude/agents/dev.md) |
| QA | Checks the change against the acceptance criteria and the content and SEO rules. | [qa](../../.claude/agents/qa.md) |

## States

The board list of a card is its state.

```
Backlog → To do → Architect BR → In Progress → Test → Dev BR → Review → Shipping → Done
                                 Blocked / Closed (from any state)
```

| State | Hat | Work | Exit gate | Next |
|---|---|---|---|---|
| Backlog | — | Groom ([grooming.md](grooming.md)). | Operator prioritises. | To do |
| To do | architect | Duplicate check. Design (only if a decision is needed) and plan, written to the card. | Plan on the card. | Architect BR |
| Architect BR | bar-raiser | Design review. Skip it for a `bug` or `debt` card with no open decision. | PASS (or skipped). Operator sign-off only for a serious open decision or an unknown effort or outcome (AGENTS.md → Decisions). BLOCK → To do. | In Progress |
| In Progress | dev | Implement. Run checks. Local commit. | Green checkpoint commit. | Test |
| Test | orchestrator | Run checks. | Checks pass. Fail → In Progress. | Dev BR |
| Dev BR | bar-raiser | Code and test review. | PASS. BLOCK → In Progress. | Review |
| Review | qa | Acceptance criteria, content and SEO checks. [Review scenario](#review-scenario): write it, run it, attach the evidence. | PASS **and operator review**. BLOCK → In Progress. | Shipping |
| Shipping | orchestrator | Operator pushes. Verify the deploy. Run the pending scenario tests. | Deploy verified. | Done (operator) |
| Done | — | Terminal. Follow-ups go to Backlog. | — | — |
| Blocked | — | Report the blocker. Ask the operator. | — | previous state |
| Closed | — | Not done, not needed. Terminal. | — | — |

Human gates: Review sign-off, push, Done, Closed, and an Architect BR sign-off only when AGENTS.md → Decisions asks for one. Agents never pass these gates.

## Board conventions

- Every card move has a comment: `<from> → <to>: <reason>`. Add the evidence: plan summary, verdict, commit hash, or check output tail.
- A design or a decision goes on the card (description or comment). No separate decision files.
- A BLOCK comment lists each finding on one line: `location · what to change · why`.
- One card, one change. Split big cards in grooming.

## Review scenario

At Review, write a review scenario on the card. The operator uses it to review the change.

1. Write a table. Each row is one test: what to do, where to check, and the expected result.
   - Where: local preview, the Netlify preview URL, the CMS, or the live site for comparison.
   - Cover each acceptance criterion. Include the failing and edge cases, not only the happy path.
2. Run each test that you can run before the push. Write the result for each test on the card.
3. Attach evidence:
   - A visual change: a screenshot. Show the new page next to the live page.
   - A change you cannot see: the command output, for example head tags, status codes or sitemap lines.
   - CMS behaviour: test on a temporary copy of the repo. Never change the real content.
4. Mark each test that needs the deploy or a CMS login as **pending**. Run the deploy tests in Shipping. The operator runs the CMS login tests.

## Bindings

### Task board — Trello

- Board: **Website** — <https://trello.com/b/jaBEXApc/website> (board id `6acf67111cc66adaf0db8c8a`).
- API: [Trello REST API](https://developer.atlassian.com/cloud/trello/rest/) with `curl`. Credentials come from the environment: `TRELLO_KEY`, `TRELLO_TOKEN` (set in the operator's shell profile; restart the app after a change). Never print or commit them.
- A card URL `https://trello.com/c/<shortLink>/...` gives the card id `<shortLink>`.

| List | id |
|---|---|
| Backlog | `6acf67111cc66adaf0db8c81` |
| To do | `6acf67111cc66adaf0db8c7f` |
| Architect BR | `6acf67111cc66adaf0db8c89` |
| Blocked | `6acf67111cc66adaf0db8c80` |
| In Progress | `6acf67111cc66adaf0db8c82` |
| Test | `6acf67111cc66adaf0db8c83` |
| Dev BR | `6acf67111cc66adaf0db8c84` |
| Review | `6acf67111cc66adaf0db8c85` |
| Shipping | `6acf67111cc66adaf0db8c86` |
| Done | `6acf67111cc66adaf0db8c87` |
| Closed | `6acf67111cc66adaf0db8c88` |

Labels: see [grooming.md](grooming.md#labels).

```sh
A="key=$TRELLO_KEY&token=$TRELLO_TOKEN"; T=https://api.trello.com/1
# read a card (state = idList)
curl -s "$T/cards/<shortLink>?fields=name,desc,idList,labels,url&actions=commentCard&$A"
# comment
curl -s -X POST "$T/cards/<shortLink>/actions/comments?$A" --data-urlencode "text=To do → Architect BR: …"
# move
curl -s -X PUT "$T/cards/<shortLink>?idList=<list-id>&$A"
# list cards in a list
curl -s "$T/lists/<list-id>/cards?fields=name,shortUrl,labels&$A"
```

The shell is zsh: an unquoted `$var` does not split into words. Pass each argument separately.

### Repository

- GitHub: <https://github.com/esaounkine/nellisarchitecture-landing> (private). Branch: `master`. CLI: `gh`.
- Decap CMS commits to `master` on the remote. Before work: `git pull --rebase`.

### Commands

- Runtime: [Node.js](https://nodejs.org/) 20+ (pinned in `.nvmrc`). Package manager: npm.
- Install: `npm ci`.
- Build: `npm run build` (runs `node build-news.js`). It regenerates `news/index.html` (from `content/pages/news.json`), `news/*/index.html`, `projects/index.html` (from `content/pages/projects.json`), `projects/<category>/index.html` (from `content/pages/projects-<category>.json`), `projects/<category>/<slug>/index.html` (from `data/projects.json`), `data/news.json`, `sitemap.xml`, `feed.xml`, `robots.txt` (from `content/robots.json`), `index.html`, `studio/index.html`, `people/index.html`, `privacy/index.html`, `contact/index.html` (from `content/pages/contact.json`) and `_redirects`. It deletes `news/<dir>/` folders that no post owns, and `projects/` folders that no project owns (category folders stay).
- Local preview: `npm run serve` ([serve](https://www.npmjs.com/package/serve)), then open <http://localhost:8000>.
- Local CMS: also run `npm run cms` ([decap-server](https://www.npmjs.com/package/decap-server), port 8081), then open <http://localhost:8000/admin/> and click Login (no password). The CMS writes straight to the files in your working copy. There is no editorial workflow and no commit. Run the build and commit yourself. Decap uses the local backend only on `localhost` (`local_backend: true` in `admin/config.yml`).
- Lint: `npm run lint` ([ESLint](https://eslint.org/) with [eslint-config-airbnb-extended](https://www.npmjs.com/package/eslint-config-airbnb-extended), config in `eslint.config.mjs`). Fix style: `npm run format`.
- Unit tests: `npm test` ([node:test](https://nodejs.org/api/test.html), files in `test/`).
- **Checks** (Test state and before a push): `npm run lint && npm test && npm run build`, then `git status`. Only the expected files may change.
- Screenshots (review scenario): a headless Chromium browser, for example [Brave](https://brave.com/) or Chrome: `"<browser>" --headless=new --hide-scrollbars --window-size=1440,900 --virtual-time-budget=8000 --screenshot=<file>.png <url>`. Make the file small before you attach it: `sips -s format jpeg -s formatOptions 40 -Z 1000 <file>.png --out <file>.jpg` (macOS).
- Attach a file to a card: `POST /1/cards/<shortLink>/attachments` with `-F file=@<path>` ([Trello REST API](https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-attachments-post)).

### Hosting — Netlify

Netlify is the current binding, not a fixed choice. See [AGENTS.md → Portable hosting](../../AGENTS.md#principles). The host-specific parts and their replacements on other hosts (for example Cloudflare Pages or AWS Amplify):

| Netlify binding | Where | Replace with |
|---|---|---|
| Build, headers, redirects, deny rules | [netlify.toml](../../netlify.toml) (build, deny rules), [_headers](../../_headers) (headers), generated `_redirects` (from [build/redirects.txt](../../build/redirects.txt) and `content/redirects.json`) | The new host's config. Cloudflare Pages reads `_redirects` and `_headers`. |
| Forms | `data-netlify` forms, POST to `/` | A form backend or a serverless function on the new host |
| CMS login | Netlify Identity + Git Gateway | Another Decap backend (for example GitHub with an OAuth app) |

- Site: **nellis-arch** — <https://app.netlify.com/projects/nellis-arch/overview>.
- Preview URL: <https://nellis-arch.netlify.app>. Production domain: <https://nellisarchitecture.com> (still on WordPress until the DNS cutover).
- Deploy: a push to `master` builds and deploys (config in [netlify.toml](../../netlify.toml)).
- Rollback: Netlify → Deploys → pick the last good deploy → **Publish deploy**. Operator only.
- CMS: `/admin` (Decap CMS, Netlify Identity + Git Gateway, editorial workflow).
- Forms: Netlify Forms (`data-netlify` attributes).

### Netlify credits

Netlify bills in credits ([how credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/), [plans](https://www.netlify.com/pricing/)). Builds and serving both use credits:

| Item | Credits |
|---|---|
| Production deploy (each push to `master`, and each CMS publish) | 15 |
| Deploy Preview, branch deploy, failed deploy, rollback | 0 |
| Bandwidth | 20 per GB |
| Web requests | 2 per 10,000 |
| Forms | 0 |

The Free plan has 300 credits each month and a hard limit. When the credits run out, Netlify pauses the site. Personal (1,000 credits) and Pro (3,000 credits) can buy more.

Rules:

- Push to `master` in batches. One push is one production deploy, whatever the number of commits. Do not push for docs or test changes alone.
- Do the checks that need a deploy on a free branch deploy or Deploy Preview, when one is set up. Then push to `master` once.
- CMS editors: one publish is one production deploy. Publish changes together.
- Page weight costs credits after the DNS cutover. A first view of Home, Studio or People is about 5 MB (measured 2026-10-12); about 200 such views use 1 GB (20 credits). Check the credit use in Netlify → Usage before and after the cutover.

### Deploy check (Shipping)

- Netlify deploy for the pushed commit is **Published**.
- Changed pages, `/`, `/news/<newest-slug>/` and `/sitemap.xml` return 200 on the preview URL (or production after cutover).
- `/admin/` loads.
- The pending tests of the [review scenario](#review-scenario) pass. Write the results on the card.

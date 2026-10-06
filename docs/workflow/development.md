# Development workflow

How a task goes from **To do** to shipped. Any person or agent can follow this spec. The concrete tools are in [Bindings](#bindings).

Driver: `/ticket <card-url>` ([.claude/commands/ticket.md](../../.claude/commands/ticket.md)).

## Roles

| Role | Does | Agent |
|---|---|---|
| Operator | Prioritises, signs off designs, reviews, pushes, closes cards. | the person |
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
| Architect BR | bar-raiser | Design review. | PASS **and operator sign-off**. BLOCK → To do. | In Progress |
| In Progress | dev | Implement. Run checks. Local commit. | Green checkpoint commit. | Test |
| Test | orchestrator | Run checks. | Checks pass. Fail → In Progress. | Dev BR |
| Dev BR | bar-raiser | Code and test review. | PASS. BLOCK → In Progress. | Review |
| Review | qa | Acceptance criteria, content and SEO checks. | PASS **and operator review**. BLOCK → In Progress. | Shipping |
| Shipping | orchestrator | Operator pushes. Verify the deploy. | Deploy verified. | Done (operator) |
| Done | — | Terminal. Follow-ups go to Backlog. | — | — |
| Blocked | — | Report the blocker. Ask the operator. | — | previous state |
| Closed | — | Not done, not needed. Terminal. | — | — |

Human gates: Architect BR sign-off, Review sign-off, push, Done, Closed. Agents never pass these gates.

## Board conventions

- Every card move has a comment: `<from> → <to>: <reason>`. Add the evidence: plan summary, verdict, commit hash, or check output tail.
- A design or a decision goes on the card (description or comment). No separate decision files.
- A BLOCK comment lists each finding on one line: `location · what to change · why`.
- One card, one change. Split big cards in grooming.

## Bindings

### Task board — Trello

- Board: **Website** — <https://trello.com/b/9x8aKhpS/website> (board id `64004737063f0377fe13deb7`).
- API: [Trello REST API](https://developer.atlassian.com/cloud/trello/rest/) with `curl`. Credentials come from the environment: `TRELLO_KEY`, `TRELLO_TOKEN` (set in the operator's shell profile; restart the app after a change). Never print or commit them.
- A card URL `https://trello.com/c/<shortLink>/...` gives the card id `<shortLink>`.

| List | id |
|---|---|
| Backlog | `6400473a362ce2364fccfaaf` |
| To do | `640047381985397cc43a022b` |
| Architect BR | `6ac512a0eec4cb36f6c15bad` |
| Blocked | `640047394b90a0f29ac4a4f7` |
| In Progress | `6ac4f74d098f74b0d13ede2a` |
| Test | `6ac4f756e7a572e92255a327` |
| Dev BR | `6ac4f75f50cdb298296000c8` |
| Review | `6ac4f766804c0e1b97095e97` |
| Shipping | `6ac4f76ba15f165757f7fa8d` |
| Done | `6ac4f7730fcaebe95e620afa` |
| Closed | `6ac4f7788ffab6a53a6b9f4d` |

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

- Runtime: [Node.js](https://nodejs.org/) 20+ (pinned in `.nvmrc`) and Python 3 (the local server). Package manager: npm.
- Install: `npm ci`.
- Build: `npm run build` (runs `node build-news.js`). It regenerates `news/*/index.html`, `data/news.json`, `sitemap.xml` and the News link.
- Local preview: `npm run serve`, then open <http://localhost:8000>.
- Lint: `npm run lint` ([ESLint](https://eslint.org/) with [eslint-config-airbnb-extended](https://www.npmjs.com/package/eslint-config-airbnb-extended), config in `eslint.config.mjs`). Fix style: `npm run format`.
- Unit tests: `npm test` ([node:test](https://nodejs.org/api/test.html), files in `test/`).
- **Checks** (Test state and before a push): `npm run lint && npm test && npm run build`, then `git status`. Only the expected files may change.

### Hosting — Netlify

- Site: **nellis-arch** — <https://app.netlify.com/projects/nellis-arch/overview>.
- Preview URL: <https://nellis-arch.netlify.app>. Production domain: <https://nellisarchitecture.com> (still on WordPress until the DNS cutover).
- Deploy: a push to `master` builds and deploys (config in [netlify.toml](../../netlify.toml)).
- Rollback: Netlify → Deploys → pick the last good deploy → **Publish deploy**. Operator only.
- CMS: `/admin` (Decap CMS, Netlify Identity + Git Gateway, editorial workflow).
- Forms: Netlify Forms (`data-netlify` attributes).

### Deploy check (Shipping)

- Netlify deploy for the pushed commit is **Published**.
- Changed pages, `/`, `/news/<newest-slug>/` and `/sitemap.xml` return 200 on the preview URL (or production after cutover).
- `/admin/` loads.

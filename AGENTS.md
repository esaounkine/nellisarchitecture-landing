## Overall

Be brief. No prose.

## Purpose

We migrate the website [nellisarchitecture.com](https://nellisarchitecture.com) from WordPress to a static site. The site is hosted on Netlify. The news section is edited in Decap CMS. See [README.md](README.md).

## Principles

Durable working agreements. Hold to these agreements regardless of tools.

- **Single entry point:** [README.md](README.md) is the only front door. A person or any agent onboards from the README. Everything else hangs off the README.
- **One source per concern:** document each thing once. Everywhere else, link to the source. Pipeline → [docs/workflow/development.md](docs/workflow/development.md). Requirements, decisions, tasks and status → the Trello board. Never duplicate.
- **Abstract the design, concretise the execution:** specs are tool-neutral and vendor-neutral. A person or any agent can follow a spec. *Bindings* (the harness, the board, the exact commands) are named and concrete, in one place. Do not genericise the bindings.
- **Name bindings, do not wrap them:** when a choice is tool-specific (Claude Code, Trello, Netlify, npm), state the tool as the current binding. Do not build an abstraction layer for tools we do not use.
- **Abstraction, not at the cost of performance:** refuse indirection and adapters added for hypothetical futures (YAGNI). The shortest path wins.

## Decisions

Discuss every decision.
Record each decision on its Trello card (description or comment). Do not create separate decision files.
The operator (human stakeholder) signs off the design at **Architect BR**. If the operator does not sign off, do not proceed.

## Task execution

Always plan before implementing. Describe what will be done. Then do.
Be brief when describing. No need to explain unless asked.
Do not jump to conclusions or actions. Always ask.
Before planning a big feature or phase, decompose it into cards on the Trello board (see [docs/workflow/grooming.md](docs/workflow/grooming.md)).

**How we work — workflows** (tool-neutral specs; each spec names its own tool bindings):

- **Development** — [docs/workflow/development.md](docs/workflow/development.md), driven by `/ticket <card-url>` (a task from To do to shipped).
- **Grooming** — [docs/workflow/grooming.md](docs/workflow/grooming.md), driven by `/groom <card-url>` (make an under-specified backlog ticket *ready* → To do).
- **Incident response** — [docs/workflow/incident.md](docs/workflow/incident.md), driven by `/incident <alert>` (outage/error → remediation → blameless post-mortem).

Task status lives on the Trello board.

When driving a card via `/ticket`, read the card's current list. Follow the state machine in [docs/workflow/development.md](docs/workflow/development.md). Invoke the hat for that state only. Move the card (with the required comment) when the state's exit gate is met. An implemented task must never be left in **To do** or **In Progress** after a green checkpoint commit.

## Requirements

- Requirements live on the Trello card: a user story and acceptance criteria. See [docs/workflow/grooming.md](docs/workflow/grooming.md).
- Every change must trace back to a card. No speculative "just in case" modules.
- Defer tech decisions until a card actually forces the decision.

## Content & SEO

The site replaces a live WordPress site. Search ranking must survive the migration.

- `content/news/*.md` is the source of truth for news. The CMS and people edit only these files (and uploads).
- Never edit generated files by hand: `news/<slug>/index.html`, `data/news.json`, `sitemap.xml`, and the News link in the page navigation. Change `build-news.js` or `build/news-template.html`, then run the build.
- Keep every public URL of the old site. If a URL must change, add a 301 redirect in `netlify.toml`.
- Keep titles, meta descriptions, canonical URLs, Open Graph tags and schema.org data correct. Absolute URLs use the production domain `https://nellisarchitecture.com`.
- Never delete or rename files in `wp-content/uploads/`. Pages and external sites link to them.
- Netlify publishes the repo root. A new internal root file or folder needs a 404 deny rule in `netlify.toml`. A new public root file or folder needs an entry in the `SITE` allow-list in `test/netlify-deny.test.js`, and no deny rule. Root `*.html` pages and dotfiles need neither.
- Decap CMS commits to `master` on the remote. Pull before you work. Rebase local commits before a push.

## Code style

The code style is important for this project. We decide what style to use, then we stick to the style. Create eslint rules to enforce the style.
Let's use a solid base (for example Airbnb) and adjust the base to our needs.

Scope: our own code (`build-news.js`, `js/static-backend.js`, future scripts). Do not lint or reformat the original WordPress theme files in `wp-content/` or the page HTML.

### Individual rules

// List the individual new code style rules below - this is good for better visibility than eslint

- Plain JavaScript. No TypeScript. No framework.
- Build scripts run on Node with zero runtime dependencies. Add a dependency only when a card needs it. Dev tools go in `devDependencies`.
- Browser code runs without a bundler. Keep the existing theme scripts working.
- Base: Airbnb via `eslint-config-airbnb-extended` (`eslint.config.mjs`). Linted files: `build-news.js`, `js/static-backend.js`, `test/`, `eslint.config.mjs`. Add new own files to the config.
- Build scripts: synchronous `fs` calls and `console` output are allowed (`n/no-sync`, `no-console` off).
- Browser scripts: `'use strict'` inside the IIFE (`strict: function`). Underscore fields are allowed for shim internals (`no-underscore-dangle` off).
- Build scripts export their pure functions and run only when called directly (`require.main === module`), so tests can import them.

### Generic rules

- No code spaghetti. Create files and include the files to make the code modular.
- No trivial comments. We all know what things do in the code.
- No need to reinvent the wheel. Use libraries that do common things.
- Do not over-engineer.
- When we agree on a new convention or pattern, add the convention here as a rule (keep this list current).
- After each task, create a checkpoint (git commit). Run the project's checks (see [Bindings](docs/workflow/development.md#bindings)). Move the card to the next pipeline state (usually **Dev BR** after Test). Then stop for the bar-raiser or human review. Do not leave an implemented change in **To do** or **In Progress**.
- Do not push to the remote after committing. Commit locally as checkpoints. Push in batches when multiple changes reach the shipping stage, and the operator decides the changes are ready to ship. Only `git push` when operator explicitly asks. A push to `master` deploys to production.

## Writing style

The controlled writing standard ASD-STE100 Simplified Technical English is the preferred language of this project.

Key rules:
- Use approved words only. Use the word list specified by the standard. Each word has one meaning. Do not use words on the blacklist of the standard.
- Use one word for one idea. Do not use two words for the same thing.
- Write short sentences. Use 20 words or less for instructions.
- Use active voice. Write "Turn the switch", not "The switch must be turned".
- Write short paragraphs. Keep one topic in each paragraph.

The goal is easy reading. Many readers are not native English speakers. Clear text helps them do the work in a safe and correct way.

## Testing

- Cover our own code with unit tests.
- Every bug fix must include a unit test that reproduces the failing case. The test must fail without the fix and pass with the fix. Cover the failing and edge cases, not just the happy path.
- After a change to the build or the templates, run the build and check the generated diff. Only the expected files may change.

## Documentation

- Always add links to all doc references. When a doc mentions an external resource (library, tool, spec, standard) or another internal doc, link the resource. Verify the link and any claim the link backs (for example a license) before stating the claim.

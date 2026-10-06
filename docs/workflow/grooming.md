# Grooming workflow

How an under-specified **Backlog** card becomes *ready* and moves to **To do**. Board bindings: [development.md → Bindings](development.md#bindings).

Driver: `/groom <card-url>` ([.claude/commands/groom.md](../../.claude/commands/groom.md)). Agent: [project-manager](../../.claude/agents/project-manager.md).

## Roles

- **Product owner** — owns product, content and SEO cards. The operator plays this role.
- **Tech lead** — owns `debt` and `infra` cards. The operator plays this role.
- **Project manager (agent)** — prepares the card and lists open decisions. Never decides.

## Ready

A card is ready when it has all of these:

- A one-line **user story**: `As a <visitor | editor | operator>, I want <…>, so that <…>.`
- **Acceptance criteria**: a short checklist. Each item is testable.
- **Labels** from the taxonomy below.
- No open decisions. Each decision is answered and recorded on the card.

## Steps

1. Read the card.
2. If the card is ready, say so. Stop.
3. Write the user story and the acceptance criteria. Use the [README](../../README.md), the code, and the live sites. Keep it minimal.
4. Propose labels.
5. List each open decision and its owner (product owner or tech lead).
6. Write the result to the card description. Add a summary comment.
7. **HALT.** The operator confirms the card is ready.
8. On confirm, move the card to **To do** with a comment.

## Labels

| Label | Colour | Use | id |
|---|---|---|---|
| `feature` | green | New or changed visitor or editor capability. | `6400473bbebe3015d0fd932b` |
| `bug` | red | Something does not work as before or as specified. | `6400473e6e7d295da2419833` |
| `content` | blue | Text, images, news, pages. | `6400473f156f504fcfa23bb1` |
| `seo` | purple | URLs, redirects, meta tags, sitemap, structured data. | `6400473fdf21f52afef24917` |
| `infra` | yellow | Netlify, DNS, CMS setup, build, tooling. | `6400473ce6fd5930aa20068a` |
| `debt` | orange | Clean-up with no visible change. | `6400473d85320705612524e0` |

Add a label: `curl -s -X POST "$T/cards/<shortLink>/idLabels?value=<label-id>&$A"`.

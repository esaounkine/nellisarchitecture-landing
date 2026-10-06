# Incident response workflow

What to do when the site is down, broken, or shows an error. Bindings: [development.md → Bindings](development.md#bindings).

Driver: `/incident <alert>` ([.claude/commands/incident.md](../../.claude/commands/incident.md)). Agent: [incident-responder](../../.claude/agents/incident-responder.md).

## Steps

1. **Assess.** Find what is broken, the blast radius and the severity. Use read-only commands only.
2. **Remediate.** Use the safest reversible action first. Follow a known runbook if one matches. Else: contain, diagnose, fix forward or roll back.
3. **Approve.** The operator approves each outward action before it happens: rollback, push, deploy, DNS or Netlify setting change.
4. **Verify.** Run the [deploy check](development.md#deploy-check-shipping).
5. **Post-mortem.** Write a blameless COE to `docs/incidents/<YYYY-MM-DD>-<slug>.md`: timeline, impact, root cause (five whys), what went well, what went badly, action items. File each action item as a Backlog card with the label `bug` or `debt`.

## Severity

| Sev | Meaning |
|---|---|
| 1 | Site down, or all pages broken. |
| 2 | A key function broken: contact forms, news, project overlays, CMS. |
| 3 | A single page, image or link broken. SEO regression. |

## Signals

- Site: `curl -sI https://nellis-arch.netlify.app/` (production domain after the DNS cutover).
- Deploys and build logs: Netlify → Deploys.
- CMS: `/admin/` loads and the editor can log in (Netlify Identity, Git Gateway).
- Forms: Netlify → Forms.
- Recent changes: `git log origin/master` (includes CMS commits).

## Known runbooks

- **Bad deploy** (site broken after a push or CMS publish): Netlify → Deploys → last good deploy → **Publish deploy**. Then fix forward on a card.
- **Build fails** (`build-news.js` error, often bad front matter from the CMS): read the Netlify build log. Find the bad file in `content/news/`. Fix the file in a commit. The last good deploy stays live meanwhile.
- **CMS login fails**: check Netlify → Identity is on, and Identity → Services → Git Gateway is on. Check the editor's invite.
- **Forms do not arrive**: check Netlify → Forms and the notification settings.

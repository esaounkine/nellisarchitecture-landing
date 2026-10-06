---
description: Drive an outage or error response. Assess, remediate with safe actions only, verify, and write a COE (docs/workflow/incident.md). Outward actions need human approval.
argument-hint: <alert or short description>
---

You are the orchestrator of the **incident-response** workflow. Spec: **docs/workflow/incident.md**. The spec has the Known runbooks and the Signals. Incident: **$1**

1. Delegate to the `incident-responder` subagent. The subagent assesses the severity and the blast radius. The subagent proposes a remediation plan from the Known runbooks.
2. Run only read-only diagnostics yourself. For each outward action, present the action and **HALT for the person to approve** before you act. These actions include: roll back a Netlify deploy, push, change Netlify or DNS settings.
3. After remediation, run the deploy check (docs/workflow/development.md → Bindings).
4. Draft the blameless post-mortem (COE) to `docs/incidents/<date>-<slug>.md`. File action items as **Backlog cards** with the label `bug` or `debt`.

---
description: Groom a Trello backlog card. Elaborate the card (user story, acceptance criteria). Label the card. On sign-off, move the card to To do (docs/workflow/grooming.md).
argument-hint: <card-url> (or empty to list un-ready backlog cards)
---

You are the orchestrator of the **grooming** workflow. Spec: **docs/workflow/grooming.md**. Board Bindings: **docs/workflow/development.md**. Target: **$1**

- **No argument** → List the Backlog cards that are not ready. A card is not ready if it has no user story or no acceptance criteria. Then stop.
- **A card URL** →
  1. Read the card from the board.
  2. Delegate to the `project-manager` subagent for the elaboration and the proposed labels.
  3. Write the elaboration into the card description. Apply the labels.
  4. Write a summary comment. **HALT for the person to confirm the card is ready.**
  5. On confirm, move the card to **To do**.

Never invent a product decision that the project-manager flagged. Surface the decision for the person.

# The six phases

Every ticket moves through the same six phases. Each phase has an owner, a file it leaves behind, and a place in mission control. pstack is not one step: its skills and playbooks spread across the phases.

| # | Phase | What happens | Who | Saved as |
|---|---|---|---|---|
| 1 | **Plan** | The idea becomes a ticket: goal, a done-check that can pass or fail, proof wanted | You, in mission control (or a sensor, or a GitHub issue) | `1-plan/ticket.md` |
| 2 | **Design** | The builder traces the code and, before changing it, writes what it found, the shapes it considered, the one it chose, the files it expects to touch, the risks | Builder agent | `2-design/design.md` |
| 3 | **Build** | The builder changes the code on a branch and writes what changed, how it proved it, what it could not verify | Builder agent, with any helper agents pstack starts | `3-build/report.md`, the commits |
| 4 | **Test** | Branch checks, six gates, the browser drive, then a second agent that did not write the code tries to break it | Scripts, then the verifier agent | `4-test/gates.txt`, `4-test/browser.txt`, `4-test/verdict.md` |
| 5 | **Deploy** | You read the verdict, merge, push; GitHub Actions reruns the gates; you restart the app | You | The merge commit |
| 6 | **Maintain** | The uptime check, the live check and the error tracker watch the running app. A failure becomes a new ticket in Plan | Sensors | A new ticket |

All of a ticket's files sit together in the project, committed on the ticket's branch:

```
docs/work/TN-6/
  1-plan/ticket.md
  2-design/design.md
  3-build/report.md
  4-test/gates.txt
  4-test/browser.txt
  4-test/verdict.md
```

They arrive on `main` with the merge, so the history of a feature travels with its code. A ticket counts as done when `4-test/verdict.md` is on `main`.

## Where pstack sits in each phase

| Phase | pstack skills and playbooks | Pocock skills (typed by you) |
|---|---|---|
| Plan | `sharpen`, `in-your-own-words`, `how`, `why`, the investigation playbook | `grill-with-docs`, `to-spec`, `to-tickets` |
| Design | `architect`, `arena`, `statechart`, `figure-it-out`, the prototype and multi-phase-plan playbooks, the principles on foundations, design space, domain modelling, types and boundaries | |
| Build | `poteto-mode` and its feature, bug-fix and refactoring playbooks, `typescript-best-practices`, `tdd`, `swarm`, `no-comments`, `unslop`, the principles on subtracting first, laziness, reader load, root causes | |
| Test | `interrogate`, `blast-radius`, `create-verification-skill`, the principles on proving it works and testing behaviour, the forensics playbooks | |
| Deploy | The shipping, opening-a-pr and babysit playbooks | |
| Maintain | `correct`, `maintain-verification-skill`, `reflect`, `recall` | `improve-codebase-architecture`, `triage` |

The orchestrator calls pstack once per agent run, with `/pstack:poteto-mode`. pstack then decides which of these to load. Mission control reads each run's record and shows, under each phase of a ticket, the pstack skills that were actually loaded there. The table above is the lookup it uses (`mission-control/lib/phases.mjs`); a skill it does not know is shown under Build.

## What is and is not a separate step

- Design and Build are one agent run, not two. The builder is told to write the design note first, and the branch check sends it back if either note is missing. A separate design run with a pause for your approval would cost a second run per ticket and a wait; say so if you want it.
- Test is three scripts and one agent run.
- Deploy has no automation. Merging, pushing and restarting are yours.
- Maintain is not per ticket. It is the project's sensors; what they find comes back as tickets.

## Ticket names

A ticket has a short id and a title. The id is the project's initials and a number: `TN-6` for the sixth ticket of `tiny-notes`, `MA-1` for the first of `my-app`. The title says what it is: "Note count in the heading".

- Everywhere you read (mission control, Discord, logs) shows both: `TN-6 Note count in the heading`.
- The branch is `agent/TN-6`, the file is `tickets/ready/TN-6.md`, the folder is `docs/work/TN-6/`.
- The number is given by the orchestrator when the ticket enters the queue. You never pick it.

Older tickets named like `004-note-count` keep working and keep their names.

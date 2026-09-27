> Guidance for OpenCode. Claude Code uses CLAUDE.md.
>
> **Any tool or model:** if you were given a review-handoff prompt, you are the
> independent reviewer of the implementer's work. Follow that prompt and
> `CLAUDE.md`; the OpenCode roles below do not apply to you.

# Discola — OpenCode guidance

The tool-agnostic principles, the verification gates and the project rules live
in [`CLAUDE.md`](CLAUDE.md). **Read it before implementing.** This file adds the
OpenCode-specific review process.

## Review process: an implementer and a reviewer

### Roles and identities

The roles are fixed; the models are not. The owner assigns a model to each role
in OpenCode and can change it without editing this file. The one requirement:
the reviewer is a different model from the implementer, so the two do not share
a blind spot (`CLAUDE.md`, *Principles*).

- **Implementer.** Writes the design, the code and the tests; replies on GitHub
  signed "— Implementer (<model>)", naming the model it runs as.
- **Reviewer**, invoked as a subagent in a fresh context, running the model the
  owner assigned to the role. It verifies against the real code rather than
  trusting the description, and posts its verdict on GitHub signed
  "— Reviewer (<model>)".
- The reviewer posts through the owner's GitHub account (no separate bot
  identity), so the signature line is the only marker of authorship.
- A **BLOCK** is not overridden by the implementer — it goes to the owner.

### Two stages

- **Design.** Before any implementation, write the proposal as a GitHub issue:
  problem, findings with `file:line` references, the design, and open questions.
  Have the reviewer review that issue and comment. Iterate — reply, the
  reviewer re-reviews — until the reviewer posts an explicit **AGREE**. Do not
  implement before that.
- **Implementation.** Implement the agreed design on a new branch in a worktree
  of your own, `<project>-work/<branch>`, never in the main checkout (`CLAUDE.md`,
  *Who works where*), and open a PR that references the issue. Have the reviewer
  review the PR against the agreed design, in a worktree of its own under
  `<project>-review/`, detached at the PR's head commit: it fetches first
  (`git fetch origin --tags <SHA>`, then `git fetch origin pull/<N>/head`; never
  `git pull`), stops only if `git cat-file -t <SHA>` still does not print
  "commit" after the fetch, checks that
  `git rev-parse HEAD` there equals the head commit before it reviews, and
  installs the dependencies there (`npm ci`) before any check runs. Fix and
  iterate until the reviewer posts an explicit **AGREE**. The owner merges.

### Bootstrap

The change that introduces or edits this file or `CLAUDE.md` goes straight to a
PR that the reviewer reviews to AGREE, exactly as for a code change. The
process reviews its own amendment.

This governs amendments made in an OpenCode session. When Claude makes one,
`CLAUDE.md`'s process applies instead: Claude verifies the PR, the owner merges,
and the reviewer's AGREE is not required (owner decision, #34). A process
change is not a milestone.

## Split by tool

- `AGENTS.md` (this file) holds the OpenCode per-PR review process.
- `CLAUDE.md` holds the tool-agnostic principles, the verification gates and the
  project rules, with no reviewer-spawning mechanism. Its "Milestones and the
  independent review (every implementer)" section is the release process for
  OpenCode too: when a release is called, OpenCode opens the milestone issue,
  hands off the review prompt, packages, runs the smoke and tags, as that
  section says.

Keep one source of truth per idea: process here, principles and rules there.

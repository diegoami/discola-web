# Proposal: a lean process, ready for OpenCode

Delete this file when the proposal merges; the PR keeps the record.

## Problem

The process text has outgrown the project. The rules that keep the game correct
are buried in the rules for how agents behave, and the two instruction files
have to be kept consistent with each other.

- **536 lines of agent guidance**: `CLAUDE.md` 278, `AGENTS.md` 72,
  `.claude/skills/review-handoff/SKILL.md` 186. About 370 of them are process:
  `CLAUDE.md:11-148`, `CLAUDE.md:171-219`, all of `AGENTS.md`, and most of the
  skill. What the project actually needs to know (gates, card budget, engine,
  conventions) takes about 90 lines.
- **The process is changing faster than the product.** Since 22 September,
  18 of the 20 commits that touch these files change process only (8 of them
  on 27 September alone). PRs #68, #69 and #71 amend worktree and review
  rules and nothing else.
- **Two files, one idea split across both.** `AGENTS.md:10-12` sends OpenCode to
  `CLAUDE.md`, `CLAUDE.md:1` sends it back, and `AGENTS.md:51-72` (*Bootstrap*,
  *Split by tool*) exists only to say which file governs which case. A change to
  one file needs a check of the other.
- **The same steps are written three times.** The fetch, `cat-file`, detached
  worktree and `npm ci` sequence is in `CLAUDE.md:20-80`,
  `AGENTS.md:47-56` and the skill's template (`SKILL.md:79-104`).
- **Generic tool advice.** *Read this much, and no more*, *Keep command output
  short* and *Sessions and handoff* (`CLAUDE.md:171-219`) describe how any
  agent should save tokens, not this project. The tools handle it now.
- **Two layers of review.** OpenCode runs a reviewer AGREE loop on every design
  *and* every PR (`AGENTS.md:32-56`), and every release then gets an independent
  review too (`CLAUDE.md:82-148`). For a project that is nearly finished, the
  release review is the one that protects what ships.

## Moving to OpenCode

These are the loading rules the design relies on:

- OpenCode reads `AGENTS.md` and falls back to `CLAUDE.md` only when there is
  no `AGENTS.md`.
- Claude Code reads `CLAUDE.md`, which can pull in another file with an
  `@AGENTS.md` line.
- OpenCode discovers skills in `.opencode/skills/`, `.agents/skills/` **and**
  `.claude/skills/`, so the two existing skills work in both tools unchanged.
- A command (`.opencode/commands/*.md`) can run under a named agent
  (`.opencode/agents/*.md`) with its own permissions. For its model, the
  command's `model` wins, then the agent's, then `opencode run -m`, then the
  session's (`SessionPrompt.command` in `packages/opencode/src/session/prompt.ts`).
  `opencode run` without `--auto` auto-rejects any permission that would ask.

Checked against `sst/opencode` at `b471c2b` (26 September 2026): the docs in
`packages/web/src/content/docs/` (`rules.mdx`, `skills.mdx`, `commands.mdx`,
`agents.mdx`, `permissions.mdx`, `cli.mdx`) and the source cited above.

So `AGENTS.md` becomes the one source, and `CLAUDE.md` shrinks to an import.
It can be deleted when Claude Code is no longer used.

## Design

1. **One file.** `AGENTS.md` holds everything: the project, the gates, the
   rules, and a short process. `CLAUDE.md` is `@AGENTS.md` plus a comment
   saying why.
2. **Keep project knowledge as it is.** The Principles, Verification (the three
   runs included), UI check, engine tests, card-size budget, *engine is a
   transcription* and Conventions sections move over almost word for word. The
   only change is merging the two "after any … change" sections into
   Verification. Most of these rules exist because of a real defect, which
   the UI check skill records, so none of them is cut.
3. **Process in about 45 lines**, in two parts:
   - **Everyday work.** A non-trivial change starts as a proposal issue. Small
     fixes go straight to a PR. Branch from a fresh `origin/main`, open a PR
     with the gates green, and the owner merges. After the merge, update the
     local `main` and delete the branch. Worktrees are ad hoc, only for
     parallel work, with the install and Windows `longpaths` notes in one
     bullet. **No per-PR or per-design review.**
   - **Releases.** These don't change: an annotated tag on `main`, a milestone
     issue, an independent review before the tag, then package, smoke, tag.
     The review is now started with one command on a model you name:
     `opencode run -m <provider/model> --command review-release <issue>`.
     The release tools enforce the tag rules (`tools/publish_release.mjs`,
     `tools/source_tag.mjs`), so the prose only needs to name the steps.
4. **Replace the pasted prompt with an OpenCode agent and command.**
   `.opencode/agents/release-reviewer.md` holds the reviewer's job once:
   set-up, rules, the per-finding issues and the verdict format, all as before.
   It is a `primary` agent with `edit: deny` and `external_directory: allow`,
   so it can make its worktree next to the checkout but cannot edit.
   `.opencode/commands/review-release.md` runs it on a milestone issue
   number. Neither sets a model, so the model you name is the one that
   reviews. The milestone issue now carries what the prompt used to carry
   (what changed, claims to verify, owner decisions), and the reviewer reads
   it with `gh issue view`. The `review-handoff` skill shrinks to "fill in
   the issue, give the command, process the result". Another tool can still
   review: tell it to follow the agent file.
5. **Remove** *Who works where* (except the one bullet above), *Keep command
   output short* and *Sessions and handoff* (generic tool advice), *Bootstrap*,
   *Split by tool*, and *Roles and identities* (except the signature, now one
   clause). *Read this much* shrinks to one paragraph, with the keystore rule
   kept, and *Change the smallest thing* becomes a principle line.
6. **Update references.** `DESKTOP.md`, `ANDROID.md`, `STORES.md`,
   `tools/publish_release.mjs`, `tools/source_tag.mjs` and `.gitignore` cite
   `CLAUDE.md` for the milestone rule. They now cite `AGENTS.md`.

Result, in the draft on this branch: 138 lines of `AGENTS.md`, 2 of
`CLAUDE.md`, a review-handoff skill of 68, and 83 in `.opencode/`. That is
536 lines down to about 290, with no project rule lost.

## Owner decisions (settled)

1. **Review:** no per-PR or per-design review. Only releases are reviewed,
   started from OpenCode on a model you name (design point 4).
2. **Worktrees:** ad hoc, only for parallel work.
3. **After a merge:** update the local `main` with `git pull --ff-only` and
   delete the merged branch. This replaces "update the main checkout on
   start": nothing depends on the local `main`, since every branch starts
   from a fresh `origin/main`.
4. **`CLAUDE.md`:** kept as a 2-line import until Claude Code is no longer
   used, then deleted.
5. **Skills:** kept in `.claude/skills/`, which OpenCode reads.

## Still open

- No review has actually been run with `/review-release` yet: this session
  has no model credentials for OpenCode. The configuration does load (see
  below). The first release under this process is the real test, or you can
  try it first on an old milestone issue.

## How it was checked

- `grep` for `CLAUDE.md`, `AGENTS.md`, `milestone` and `worktree` across the
  `*.md` files, `tools/` and `.github/`. After the change, nothing points at a
  section that no longer exists.
- Went through the old files section by section against the new
  `AGENTS.md`. Every project rule (gates, the three runs, the card budget,
  the engine transcription, Piero's weights, i18n, no build step, the
  original art, the keystore) is still there.
- The model precedence and the auto-reject behaviour were read from
  OpenCode's source, not inferred from its docs. That is why the agent and
  the command leave `model` unset, and why the agent allows
  `external_directory` explicitly instead of relying on `--auto`.
- Loaded with OpenCode 1.18.32 (`npx opencode-ai`) in this repository:
  `opencode agent list` shows `release-reviewer (primary)` with `edit: deny`
  and `external_directory: allow`. `opencode debug config` shows the
  `review-release` command bound to that agent, with no model. `opencode debug
  skill` finds `ui-check` and `review-handoff` in `.claude/skills/`.
- No code changed. The only edits under `tools/` are three comments and one
  error string that now cite `AGENTS.md` (`node --check` passes on both files),
  so the gates cannot be affected. They still run in CI on the PR.

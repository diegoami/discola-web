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
     with the gates green, and the owner merges. Use a worktree of your own
     when another session may share the checkout, with the install and
     Windows `longpaths` notes in one bullet. A second-model PR review happens
     **when the owner asks for it**, not by default.
   - **Releases.** These don't change: an annotated tag on `main`, a milestone
     issue, an independent review before the tag, then package, smoke, tag.
     The release tools enforce the tag rules (`tools/publish_release.mjs`,
     `tools/source_tag.mjs`), so the prose only needs to name the steps.
4. **Cut the review-handoff skill to about 120 lines.** The milestone issue
   fields, the verdict format, the per-finding issues and the processing
   steps stay the same. The fetch and worktree steps become one paragraph
   that the template refers to.
5. **Remove** *Who works where* (except the one bullet above), *Keep command
   output short* and *Sessions and handoff* (generic tool advice), *Bootstrap*,
   *Split by tool*, and *Roles and identities* (except the signature, now one
   clause). *Read this much* shrinks to one paragraph, with the keystore rule
   kept, and *Change the smallest thing* becomes a principle line.
6. **Update references.** `DESKTOP.md`, `ANDROID.md`, `STORES.md`,
   `tools/publish_release.mjs`, `tools/source_tag.mjs` and `.gitignore` cite
   `CLAUDE.md` for the milestone rule. They now cite `AGENTS.md`.

Result, in the draft on this branch: 136 lines of `AGENTS.md`, 2 of
`CLAUDE.md`, and a review-handoff skill of 122. That is 536 lines down to
about 260, with no project rule lost.

## Owner decisions (recommended default first)

1. **Per-PR and per-design review in OpenCode.** *Default: only when you ask.*
   A reviewer subagent on every design and every PR doubles each change's
   cost, while the release review already runs before anything ships.
   Alternative: keep it for PRs that touch `public/engine.js` or
   `public/index.html`.
2. **Mandatory worktrees.** *Default: only when another session may share the
   checkout.* Alternative: keep them mandatory, which means about 40 lines
   come back.
3. **The "update the main checkout on start" rule.** *Default: drop it.* Every
   implementer already starts from `origin/main` after a fetch, and every
   reviewer from an exact SHA.
4. **Keep `CLAUDE.md` as an import or delete it now.** *Default: keep the
   2-line import* until you stop using Claude Code, then delete it.
5. **Where the skills live.** *Default: leave them in `.claude/skills/`*, which
   OpenCode reads. Alternative: move them to `.agents/skills/`, the neutral
   path, in the PR that deletes `CLAUDE.md`.
6. **Optional follow-up:** make the per-PR reviewer an OpenCode agent file
   (`.opencode/agents/reviewer.md`, set to read-only). Its role and model
   would then live in config instead of prose. This is not in the draft,
   because the frontmatter could not be checked against the current OpenCode
   docs from this session.

## How it was checked

- `grep` for `CLAUDE.md`, `AGENTS.md`, `milestone` and `worktree` across the
  `*.md` files, `tools/` and `.github/`. After the change, nothing points at a
  section that no longer exists.
- Went through the old files section by section against the new
  `AGENTS.md`. Every project rule (gates, the three runs, the card budget,
  the engine transcription, Piero's weights, i18n, no build step, the
  original art, the keystore) is still there.
- No code changed. The only edits under `tools/` are three comments and one
  error string that now cite `AGENTS.md` (`node --check` passes on both files),
  so the gates cannot be affected. They still run in CI on the PR.

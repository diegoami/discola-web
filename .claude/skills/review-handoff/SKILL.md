---
name: review-handoff
description: Write the prompt the owner gives an independent reviewer (a model that implemented none of the release, in a tool the owner picks) so it reviews a release candidate before it is tagged, and records the result on the milestone issue. Use when a milestone (a release, see CLAUDE.md) is called or proposed, for the re-review after a BLOCK, and whenever the owner asks for a review prompt. Also use when the owner says a review is in, to process it.
---

# Review handoff

A milestone is a release: the annotated tag `vX.Y.Z` on `main`, on the exact
commit the release is built from (`CLAUDE.md`). The review runs once per
milestone, on the candidate, before the tag. It never runs per PR. A PR,
a proposal or a process change gets no prompt. Say how it was verified instead.

One tool implements (Claude Code or OpenCode, as the owner assigns); a model
that implemented none of the release reviews. The owner picks the reviewer and
its tool (Codex, DeepSeek, or anything else that can run `gh`), so the prompt
never assumes one: no tool-specific commands, and the reviewer signs with its
own tool and model. Give the owner one prompt, ready to paste, in a single
fenced `text` block with nothing else in it. Tell the owner to run it in a
**fresh session**, re-reviews included: a reused session carries its earlier
conclusions. The reviewer starts with no context and posts its results to
GitHub itself, so the prompt has to carry everything it needs.

The tag waits for the verdict. It is not created until the verdict is AGREE,
unless the owner decides to tag without a review, which the milestone issue
then records.

A tool that loads `AGENTS.md` (Codex and OpenCode, for example) sees the
OpenCode roles there. The note at the top of `AGENTS.md` and the prompt's first
line both tell it that a handoff prompt makes it the reviewer instead. The first
line alone covers a tool that loads any other instructions file.
Every `gh` call needs network access, which some tools sandbox by default:
tell the owner to allow it.

## Open the milestone issue first

Title `Milestone vX.Y.Z`. The body, written to a file as UTF-8 without a BOM
and passed with `--body-file`:

- **Tag**: `vX.Y.Z` (the next version in the existing scheme, unless the
  owner says otherwise).
- **Candidate**: the full SHA on `main` (`git rev-parse origin/main` after a
  fetch), with every gate run on that SHA.
- **Previous milestone**: the latest `v*` tag (`git describe --tags --abbrev=0`).
- **Merged since**: every PR merged between the two, number and title.
- **Gates on the candidate**: `npm run verify` — the pass count, and CI's
  result for that SHA.
- **Review**: `pending` at first, then `AGREE at <sha>`, `BLOCK at <sha>: #n`,
  or `tagged without review (owner)`. Keep this line current.

## Fill in before writing the prompt

- **Repo**: `gh repo view --json nameWithOwner --jq .nameWithOwner`.
- **Milestone issue**: its URL. This is the thread.
- **Range**: `<previous tag>..<candidate SHA>`, both from the issue.
- **What changed and why**: two or three sentences across the range. Do not
  argue for it.
- **Claims to verify**: the specific things the release claims are true, with
  `file:line`. These are what the reviewer checks hardest.
- **Checks already run**: each command, its pass *count*, and what it would
  have caught. The reviewer should aim at what those checks cannot see.
- **Known owner decisions**: questions already settled, so the reviewer does
  not report them as defects.
- **Labels**: `gh label list`. Make sure `review` exists
  (`gh label create review --description "Found by an independent review"`).

## Template

```text
You are the independent reviewer for <owner/repo>, working from a review-handoff
prompt: this prompt, not the OpenCode roles in AGENTS.md or any other
agent-instructions file your tool loads, defines your job.
<implementer: tool and model> did this work, not you. Do not trust its
description. Verify everything against the code.

MILESTONE: <vX.Y.Z> (a release; the tag is created only after your AGREE)
THREAD: <milestone issue URL>
CANDIDATE: main at <full sha>. Before anything else, wherever you were
started:
1. Fetch first:
     git fetch origin --tags <full sha>
   Naming the SHA brings an untagged candidate even into a clone whose
   refspec leaves out main, such as a single-branch or shallow clone a
   sandbox or a cloud session makes. Reviewing a pull request instead, also
   git fetch origin pull/<N>/head. Not git pull: the checkout you start in
   may be on another branch or hold local changes, and it is not yours.
2. A commit you cannot see is not missing until you have fetched. Only if
   git cat-file -t <full sha> still does not print "commit" after the
   fetch, stop and say so.
3. Review in a fresh, detached worktree of your own at exactly that SHA,
   never in the checkout you started in:
     git worktree add --detach MAIN/../PROJECT-review/review-<first 12 of sha>-STAMP <full sha>
   MAIN is the parent directory of git rev-parse --path-format=absolute
   --git-common-dir, PROJECT is MAIN's name, and STAMP is the UTC time as
   YYYYMMDDTHHMMSSZ, so the path is unique to this run. Remove no worktree
   you did not make.
4. In that worktree, git rev-parse HEAD must equal <full sha> before you
   review. Every command from here on runs there.
5. Before any check runs in that worktree, install the dependencies there,
   as CI does: npm ci, then npx playwright-core install chromium. Never copy
   or link them from the main checkout.
On Windows, git config --global core.longpaths true is a prerequisite, since
nested worktree paths can pass the path limit. The owner sets it; do not set
it yourself. If it is missing and step 3 fails with "Filename too long", stop
and say so.
RANGE: git diff <previous tag>..<full sha>

WHAT CHANGED: <two or three sentences across the range>

CLAIMS TO VERIFY:
- <claim> (<file:line>)

ALREADY RUN: <command: pass count, what it would catch>. Look for what these
cannot see.

KNOWN OWNER DECISIONS (not defects): <list, or "none">

Read the repository's CLAUDE.md first: its principles and rules are the
standard. Review the RANGE, and follow it into any file it touches or relies
on. Problems elsewhere in the repository count too, as out of scope.

Rules:
- Do not edit files, commit, push, tag or publish. Your only writes are the
  GitHub issues and the one comment described below, made with the gh CLI (it
  needs network access).
- Write every issue and comment body to a file as UTF-8 without a byte-order
  mark, and pass it with --body-file.
- Reproduce every finding: cite file:line, and give the command, the input or
  the reasoning that shows it. Leave out anything you could not reproduce.
- Do not report style preferences.
- Before opening an issue, search open issues (gh issue list --search) and
  comment on an existing one instead of duplicating it.

1. For each finding, open one issue:
   gh issue create --label review --label <bug|robustness|tests|design|cleanup|documentation> --body-file <file>
   Title: the defect, stated plainly.
   Body:
     - Severity: MUST-FIX (must be fixed before this release is tagged),
       SHOULD, or OUT OF SCOPE (not caused by anything in the RANGE)
     - Found by: review of <THREAD> at <sha>
     - What: the defect, with file:line and a reproduction
     - Why it matters: what a user or maintainer would notice
     - Suggested fix: the smallest change that resolves it
     - Effort: S, M or L
     - Signed: — Reviewer (<tool>, <model>)

2. Then, always, even if you found nothing, post one comment on THREAD
   (gh issue comment <n> --body-file <file>):
   VERDICT: AGREE | BLOCK        (BLOCK if any MUST-FIX issue was opened)
   Reviewed: <sha>
   Worktree: your worktree's path, relative to MAIN (../PROJECT-review/review-...)
   Issues opened: #n (MUST-FIX), #m (SHOULD), ... or "none"
   Owner decisions: questions only the owner can settle, or "none"
   Nits: one line each, or "none" (nits do not get issues)
   Checked and clean: what you verified and found correct
   — Reviewer (<tool>, <model>)
```

MAIN, PROJECT and STAMP stay as written: the reviewer works them out on its
own machine.

For a re-review, the CANDIDATE is the new `main` commit and the RANGE stays
`<previous tag>..<new candidate>`. The reviewer fetches again and makes a new
worktree at the new SHA, since no earlier checkout or worktree has it. The
prompt also names the earlier verdict and the fix PRs, so the reviewer checks
the fixes and whatever else landed with them.

## When the owner says the review is in

- Read the verdict comment on the milestone issue and every issue it lists
  (`gh issue view <n>`), and update the issue's `Review:` line. Check that the
  SHA it names is the current candidate.
- Reproduce each finding yourself before acting on it. A reviewer can be wrong,
  and so can you.
- MUST-FIX: fix it in an ordinary PR (`Fixes #n`), or rebut it with evidence on
  the issue and leave the close to the owner. SHOULD: recommend whether it goes
  in before the tag; the owner decides. OUT OF SCOPE: leave it for its own
  change. Owner decisions: put them to the owner with a recommended default.
  Nits: your call, and say which you took.
- Reply on the milestone issue with what happened to each finding.
- **BLOCK**: once the fixes merge, move the candidate to the new `main` commit
  on the issue, rerun the gates there, and give the re-review prompt without
  being asked. If a third round does not end in AGREE, the milestone goes to
  the owner.
- **AGREE**: package from exactly the reviewed SHA (`DESKTOP.md` §Releasing),
  run the manual smoke, then tag that SHA and push the tag. Work merged after
  the candidate waits for the next milestone.

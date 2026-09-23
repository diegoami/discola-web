---
name: review-handoff
description: Write the prompt the owner runs in Codex so it independently reviews the repository at a milestone and records the result on GitHub. Use when a design proposal is written, when a reviewable PR is open with the gates green, or when a release is staged (the milestones in CLAUDE.md), and whenever the owner asks for a review prompt. Also use when the owner says a review is in, to process it.
---

# Review handoff

First check the milestone is one: `CLAUDE.md` says which PRs are reviewable.
A docs correction or a typo fix is not. Do not write a prompt for it; say it
was verified without Codex and why.

Claude implements; Codex reviews. At each milestone, stop and give the owner
one prompt, ready to run in Codex, in a single fenced `text` block with nothing
else in it. Codex starts with no context and posts its results to GitHub
itself, so the prompt has to carry everything it needs.

Codex reads `AGENTS.md`, which describes the OpenCode roles; the note at the
top of `AGENTS.md` and the first line of the prompt tell it that a handoff
prompt makes it the reviewer instead. Its sandbox may block network access by
default, and every `gh` call needs it: tell the owner to approve those calls
when Codex asks.

## Fill in before writing

- **Repo**: `gh repo view --json nameWithOwner --jq .nameWithOwner`.
- **Milestone and thread**: design (the proposal issue), PR (the PR), or release
  (the `release/X.Y.Z` PR).
- **Head SHA**: `git rev-parse HEAD` on the branch under review, pushed. A
  review of a stale head wastes a round.
- **What changed and why**: two or three sentences. Do not argue for the change.
- **Claims to verify**: the specific things the work says are true, with
  `file:line`. These are what the reviewer checks hardest.
- **Checks already run**: each command, its pass *count*, and what it would
  have caught. The reviewer should aim at what those checks cannot see.
- **Known owner decisions**: questions already put to the owner, so the
  reviewer does not report them as defects.
- **Labels**: `gh label list`. Make sure `review` exists
  (`gh label create review --description "Found by an independent review"`).

## Template

```text
You are Codex, the independent reviewer for <owner/repo>, working from a
review-handoff prompt: this prompt, not the OpenCode roles in AGENTS.md,
defines your job. Claude did this work. Do not trust its description. Verify
everything against the code.

MILESTONE: <design proposal | pull request | staged release>
THREAD: <issue or PR URL>
HEAD: <branch> at <sha>. Check out that SHA before you start, and stop and say
so if you cannot.

WHAT CHANGED: <two or three sentences>

CLAIMS TO VERIFY:
- <claim> (<file:line>)

ALREADY RUN: <command: pass count, what it would catch>. Look for what these
cannot see.

KNOWN OWNER DECISIONS (not defects): <list, or "none">

Read the repository's CLAUDE.md first: its principles and rules are the
standard. Review <the proposal | the diff against main | the release PR and the
staged checksums in its body>, and follow it into any file it touches or relies
on. Problems elsewhere in the repository count too, as out of scope.

Rules:
- Do not edit files, commit or push. Your only writes are the GitHub issues
  and the one comment described below, made with the gh CLI.
- Reproduce every finding: cite file:line, and give the command, the input or
  the reasoning that shows it. Leave out anything you could not reproduce.
- Do not report style preferences.
- Before opening an issue, search open issues (gh issue list --search) and
  comment on an existing one instead of duplicating it.

1. For each finding, open one issue:
   gh issue create --label review --label <bug|robustness|tests|design|cleanup|documentation>
   Title: the defect, stated plainly.
   Body:
     - Severity: BLOCK (must be fixed before this milestone passes), SHOULD,
       or OUT OF SCOPE (not caused by this change)
     - Found by: review of <THREAD> at <sha>
     - What: the defect, with file:line and a reproduction
     - Why it matters: what a user or maintainer would notice
     - Suggested fix: the smallest change that resolves it
     - Effort: S, M or L
     - Signed: — Reviewer (Codex, <model>)

2. Then, always, even if you found nothing, post one comment on THREAD:
   VERDICT: AGREE | BLOCK        (BLOCK if any BLOCK issue was opened)
   Reviewed: <sha>
   Issues opened: #n (BLOCK), #m (SHOULD), ... or "none"
   Owner decisions: questions only the owner can settle, or "none"
   Nits: one line each, or "none" (nits do not get issues)
   Checked and clean: what you verified and found correct
   — Reviewer (Codex, <model>)
```

## When the owner says the review is in

- Read the verdict comment on the thread and every issue it lists
  (`gh issue view <n>`). Check that the SHA it names is the current head.
- Reproduce each finding yourself before acting on it. A reviewer can be wrong,
  and so can you.
- BLOCK and SHOULD: fix it, with `Fixes #n` in the PR, or rebut it with
  evidence in a comment on the issue and leave the close to the owner. OUT OF
  SCOPE: leave the issue for its own change. Owner decisions: put them to the
  owner with a recommended default. Nits: your call, and say which you took.
- Reply on the thread with what happened to each finding.
- After a BLOCK, or a fix that would itself be reviewable, rerun the gates
  and give a new prompt for the new SHA. Otherwise, after an AGREE, post on the
  thread the reviewed SHA, the new head SHA and what each commit changed; that
  record extends the AGREE to the new head (`CLAUDE.md`), and the owner merges.

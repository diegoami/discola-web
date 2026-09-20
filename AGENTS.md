# Project instructions

This repository keeps its guidance in [`CLAUDE.md`](CLAUDE.md). **Read it before
changing anything.** It covers the UI check that must pass after any UI change,
the unit tests that must pass after any engine change, the card-size budget, and
the rule that the engine is a transcription of the 1997 Pascal rather than a
rewrite.

OpenCode V2 loads `AGENTS.md` and does not fall back to `CLAUDE.md`, while Claude
Code loads `CLAUDE.md`. This file exists so both tools share one source of truth
instead of a copy that drifts.

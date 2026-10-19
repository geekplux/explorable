# explorable

Paste an arXiv or blog URL (or pick a built-in sample) and get back an interactive explorable explainer in the spirit of Bartosz Ciechanowski and Amelia Wattenberger: the core idea of the piece rebuilt as a short scrolling essay with draggable, live figures whose numbers come from a real model of the idea, not a screenshot. The same capability ships as an agent skill, `/explorable`, so any coding agent can produce an explorable for a concept on request.

**Status:** planning

**Stack:** React + Vite + TypeScript, Vitest, oxlint; figures in SVG / Canvas 2D (no decorative 3D); a Cloudflare Worker for fetching and cleaning the source article (arXiv abstract/HTML, blog readability) and for lean Workers AI calls (outline + figure spec); built-in samples are pre-generated and committed so the first view needs no network or key; the `/explorable` skill lives in `skills/explorable/`.

## How this repo is built

This repository is developed by a Claude Code main agent acting as product manager, delegating to the specialist sub-agents in `.claude/agents/`. See `CLAUDE.md` for the operating manual, `docs/KICKOFF.md` for the start prompt, `docs/PLAN.md` for the plan (once written), and `docs/STATUS.md` for live progress. Work lands as a stack of pull requests, one per phase; nothing is merged without review.

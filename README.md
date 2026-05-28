# HackerRank Buildathon

Starter repository for the **HackerRank Buildathon**.

Build an AI agent that triages real **HackerRank** support tickets, using only the support corpus shipped in this repo. Your agent must have a UI that shows tickets being processed, so the work is visible on screen, not just a script running in a terminal.

Read [`problem_statement.md`](./problem_statement.md) for the full task spec, input/output schema, and allowed values, and [`evalutation_criteria.md`](./evalutation_criteria.md) for how submissions are scored.

---

## Start here (read first)

Before you build, know how the whole thing works so there are no surprises at the end:

1. **Clone this repo** and open it in your AI coding tool of choice (Cursor, Claude Code, Codex, Copilot, etc.).
2. **Your prompts are logged automatically.** The `AGENTS.md` in this repo tells your AI tool to write every prompt you send to a log file (see [Chat transcript logging](#chat-transcript-logging)). You don't enable anything — just work normally. This log is part of how you're judged, so don't delete it.
3. **Build your agent in `code/`**, give it a **UI** that shows tickets being processed, and write your answers to `support_tickets/output.csv`.
4. **Submit by sending one GitHub link.** At the end you copy your log into the repo, push, and send us the link. Full steps in [Submission](#submission).
5. **Then you sit a 30-minute AI Judge interview** about what you built.

That's the whole loop. Details below.

---

## Contents

1. [Repository layout](#repository-layout)
2. [What you need to build](#what-you-need-to-build)
3. [Where your code goes](#where-your-code-goes)
4. [How the day runs](#how-the-day-runs)
5. [Quickstart](#quickstart)
6. [Chat transcript logging](#chat-transcript-logging)
7. [Submission](#submission)
8. [AI Judge interview](#ai-judge-interview)
9. [Evaluation criteria](#evaluation-criteria)

---

## Repository layout

```
.
├── AGENTS.md                       # Rules for AI coding tools + transcript logging
├── problem_statement.md            # Full task description and I/O schema
├── README.md                       # You are here
├── code/                           # ← Build your agent here
│   └── main.py                     #   Entry point (rename/extend as you like)
├── data/                           # Local-only support corpus (no network needed)
│   └── hackerrank/                 #   HackerRank help center
└── support_tickets/
    ├── sample_support_tickets.csv  # Inputs + expected outputs (for development)
    ├── support_tickets.csv         # Inputs only (run your agent on these)
    └── output.csv                  # Write your agent's predictions here
```

---

## What you need to build

An AI agent that, for each row in `support_tickets/support_tickets.csv`, produces:

| Column         | Allowed values                                          |
| -------------- | ------------------------------------------------------- |
| `status`       | `replied`, `escalated`                                  |
| `product_area` | most relevant support category / domain area            |
| `response`     | user-facing answer grounded in the provided corpus      |
| `justification`| concise explanation of the routing/answering decision   |
| `request_type` | `product_issue`, `feature_request`, `bug`, `invalid`    |

Hard requirements (from `problem_statement.md`):

- Must have a **UI** that visibly shows tickets being processed (the queue, the current ticket, the decision, the response). It should not be a terminal-only script. Build the UI however you like — web, desktop, notebook, anything visual.
- Must use **only the provided support corpus** (no live web calls for ground-truth answers).
- Must **escalate** high-risk, sensitive, or unsupported cases instead of guessing.
- Must avoid hallucinated policies or unsupported claims.

Beyond that you are free to bring your own approach — RAG, vector DBs, tool use, structured output, agent frameworks, classical ML, or anything else. Polish counts: aesthetics and UX are part of the score.

---

## Where your code goes

All of your work belongs in [`code/`](./code/). The repo ships with an empty `code/main.py` you can grow into your full agent — add more modules (`agent.py`, `retriever.py`, `ui.py`, etc.) next to it as needed.

Conventions:

- Put a **README inside `code/`** describing how to install dependencies and run both your agent and its UI.
- Read secrets **from environment variables only** (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …). Copy `.env.example` → `.env` (already gitignored) if you keep one. **Never hardcode keys.**
- Be **deterministic** where possible. Seed any random sampling.
- Write responses to `support_tickets/output.csv`.

---

## How the day runs

The rough shape of the build (durations, not fixed clock times):

- **30 minutes** to plan with your AI and sketch a basic layout of your UI on a digital whiteboard (Excalidraw, FigJam, tldraw — whatever you like)
- a short **walkthrough** where you talk through your plan and your UI sketch on the whiteboard
- **~4.5 hours** of build time, split into two rounds
- a **30-minute break** in the middle
- a short window to **demo** what you built
- an **AI Judge interview** at the end

---

## Quickstart

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

Then:

1. Build your agent inside `code/`. Use any language or runtime; we recommend **Python**, **JavaScript**, or **TypeScript**.
2. Give it a UI that shows tickets being processed.
3. Run it against `support_tickets/support_tickets.csv` and write predictions to `support_tickets/output.csv`.
4. Write a short `code/README.md` so the judge can run your agent.

When you're done, follow [Submission](#submission) to share your work.

---

## Chat transcript logging

This repo ships with an `AGENTS.md` that any modern AI coding tool (Cursor, Claude Code, Codex, Gemini CLI, Copilot, etc.) will read. It instructs the tool to append every conversation turn to a single shared log file:

| Platform       | Path                                              |
| -------------- | ------------------------------------------------- |
| macOS / Linux  | `$HOME/hackerrank_buildathon/log.txt`             |
| Windows        | `%USERPROFILE%\hackerrank_buildathon\log.txt`     |

You don't need to do anything to enable it — just use your AI tool normally. The AI Judge reads this log to see how you worked.

---

## Submission

Your whole submission is your GitHub repo. When you're done:

1. Copy your prompt log into the repo:
   - macOS / Linux: `cp ~/hackerrank_buildathon/log.txt submission/log.txt`
   - Windows (PowerShell): `Copy-Item "$env:USERPROFILE\hackerrank_buildathon\log.txt" submission\log.txt`
2. Make sure your code is in `code/` and your predictions are in `support_tickets/output.csv`.
3. Commit and push everything:

```bash
git add -A
git commit -m "Submission"
git push
```

4. Send us your GitHub repo link.

That one link is your entire submission — your code, your `output.csv`, and your prompt log. Nothing else to upload.

---

## AI Judge interview

At the end of the build, you sit for an interview with the AI Judge. It has access to your code, your `output.csv`, and your prompt log, and asks about your approach, your decisions, and how you used AI while building.

The AI Judge weighs your code, your prompt log, your output, your UI, and the interview, and decides the winner.

---

## Evaluation criteria

Submissions are scored across agent design (your `code/`), the AI Judge interview, output accuracy on `support_tickets/output.csv`, AI fluency from your prompt log, and the aesthetics and functionality of your UI.

See [`evalutation_criteria.md`](./evalutation_criteria.md) for the full rubric.

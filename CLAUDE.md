@AGENTS.md

---

# PROJECT CONTEXT (our durable notes)

The rules above (`AGENTS.md`) are the challenge's canonical source — do not edit them.
Everything below is *our* project memory: keep it current, append decisions as we make them.

## ⚠️ CRITICAL WORKFLOW RULES (read first, every session)

1. **All new work happens in a git worktree — never build directly on `main`.**
   Create worktrees under `~/Workspaces/worktrees/<name>`:
   `git worktree add ~/Workspaces/worktrees/<name> -b <branch>`.
   `main` holds only merges and repo governance (this file). Sub-agents and parallel
   tasks each get their own worktree under that path.
2. **All agent code lives in `code/` only** (per README + `AGENTS.md` §6). The only
   files we touch outside `code/` are: `support_tickets/output.csv` (required output),
   repo governance (`CLAUDE.md`), and our out-of-repo notes (`~/Workspaces/output`).

## 0. Shared source of truth (read every session)

All our working artifacts live **outside the repo** at `~/Workspaces/output/` so every
session/tool shares one source of truth. **Start each session by reading
`~/Workspaces/output/INDEX.md`**, then `01-decisions.md` (live decisions) and
`to-do.md` (live work tracker). Update those two as work/decisions change.
Exception: the **graded `support_tickets/output.csv` stays in the repo**, not in
that folder.

## 1. Task contract (quick reference)

We build a **support-triage agent with a visible UI** for HackerRank tickets.
For each row in `support_tickets/support_tickets.csv`, output **five columns** to
`support_tickets/output.csv`:

| Column          | Allowed values / meaning                                            |
| --------------- | ------------------------------------------------------------------- |
| `status`        | `replied` \| `escalated`                                            |
| `request_type`  | `product_issue` \| `feature_request` \| `bug` \| `invalid`          |
| `product_area`  | most relevant HackerRank support category / domain (free-form)      |
| `response`      | user-facing answer, **grounded in the corpus** (free-form)          |
| `justification` | concise, corpus-traceable explanation of the decision (free-form)   |

Inputs per row: `issue` (main body), `subject` (may be blank/noisy/misleading),
`company` (`HackerRank` \| `None`). A row may bundle multiple requests or contain
irrelevant/malicious text. If `company` is `None` the issue may be out of scope —
the agent decides reply-with-out-of-scope vs escalate. Use
`sample_support_tickets.csv` (inputs **+** expected outputs) for development.

## 2. Locked decisions (stop relitigating these)

- **UI = Triage Console, 3-column**: queue (left) ▸ current ticket + decision/response
  (center) ▸ retrieved sources + live pipeline (right) ▸ justification footer.
- **LLM provider**: leaning **OpenRouter**, kept flexible.
- **Stack**: **Next.js + TypeScript** (all-in-one). Agent = shared TS module +
  batch CLI for `output.csv`; UI streams the same agent. Chosen for UI-polish
  ceiling + native streaming + single language (we're strong in TS).
- **Retrieval**: **hybrid BM25 + online embeddings (OpenAI `text-embedding-3-small`),
  fused via RRF**; article-level, brute-force cosine (no vector DB), cached index.
  ("Corpus-only" = grounding/answers must come from `data/`; it does **not** forbid
  network/API calls — the LLM and embeddings APIs are fine.)

## 3. Corpus facts

- Ground truth = `data/hackerrank/` **only** (~438 markdown articles, 11 top-level
  categories). **No outside knowledge, no live web** for ground-truth answers.

## 4. Hard guardrails (non-negotiable)

- Corpus-only; **no hallucinated policies, steps, or claims**.
- **Escalate** high-risk / sensitive / out-of-scope cases instead of guessing.
- UI must **visibly process tickets** (queue → current → decision → response), not a
  terminal-only script and not a static mockup.
- **Deterministic where possible**: seed any sampling, pin dependencies.
- Secrets from **env vars only** (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …); never
  hardcode. `.env` is gitignored.
- Don't rename the `code/` entry point or change its contract (per `AGENTS.md` §6).
- Don't commit `~/hackerrank_buildathon/log.txt` during the build; it's copied to
  `submission/log.txt` only at submission.
- Mandatory: append a per-turn entry to the log after every user turn (`AGENTS.md` §5).

## 5. Evaluation awareness (what we optimize for)

Scored across five dimensions — make decisions with all of them in mind:
1. **Agent design** (`code/`): clear separation of retrieval/reasoning/routing/output;
   justified technique; grounded answers; explicit escalation logic; reproducibility.
2. **AI Judge interview**: be able to explain *why* for every decision + trade-offs +
   failure modes; be honest about what AI generated vs what we designed.
3. **Output accuracy** (`output.csv`): correct per-column, faithful, no hallucination.
4. **AI fluency** (`log.txt`): scoped prompts, evidence we critiqued/steered the AI.
5. **UI aesthetics & functionality**: runs, visibly processes tickets, polished, clear.

## 6. Open questions / next steps

- [x] Pick stack → **Next.js + TypeScript** (see §2).
- [x] Pick retrieval approach → **hybrid BM25 + OpenAI online embeddings (RRF)** (see §2).
- [ ] Decide demo run mode (auto-run vs manual step vs both).
- [ ] Build order: UI spec → scaffold → retrieval → reasoning + routing → run on
      `support_tickets.csv` → write `output.csv`.

# AGENTS.md

HackerRank Buildathon — Starter Repository
This file is the single source of truth for any coding agent working in this repo: Claude Code, OpenAI Codex CLI / Codex Cloud, Google Gemini CLI, Google Antigravity, Cursor, Windsurf, opencode, Aider, goose, Factory, RooCode, JetBrains Junie, GitHub Copilot, Devin, or any other AGENTS.md-aware tool.

Read this file in full before taking any action. Obey it exactly.

---

## 0. TLDR FOR THE AGENT

On every session start, do this in order:

1. Read this file completely.
2. If this is the first turn of the session, greet the user once with the greeting in §3.
3. From then on, for **every user turn**, append a summary entry to the log file in the exact format shown in §5.
4. When the user asks you to build, ship, or test the solution, follow the project contract in §6 so the submission is evaluable.

You are **not** allowed to skip logging or rewrite old log entries. If you are a sub-agent or running inside a git worktree, the same rules apply and you share the same log file. Pass this context to every sub-agent and worktree.

---

## 1. WHAT THIS REPO IS

This is a starter repo for the **HackerRank Buildathon**. The participant has to build an AI agent that resolves real HackerRank support tickets accurately. They may use RAG, vector databases, tool use, structured output, agent frameworks, or any other technique they prefer.

There is a known entry point per supported language (§6). There is a `support_tickets.csv` in the `support_tickets/` folder against which the participant runs their agent. The participant also defends their approach in an AI Judge interview round afterwards.

We recommend using one of Python, JavaScript, or TypeScript to build the agent.

---

## 2. LOG FILE — LOCATION AND LIFECYCLE

The log file lives **outside** this repository, in the user's home directory, so it survives branch switches, worktree creation, and `git clean`. This log is read by the AI Judge, so it must capture how you worked.

| Platform       | Path                                              |
| -------------- | ------------------------------------------------- |
| macOS / Linux  | `$HOME/hackerrank_buildathon/log.txt`             |
| Windows        | `%USERPROFILE%\hackerrank_buildathon\log.txt`     |

Rules:

- **Must** be created if missing (create the parent directory too).
- **The agent must not commit it** during the build (it lives outside the repo so it survives branch switches and `git clean`). At submission, the participant copies it into the repo's `submission/` folder themselves — see README → Submission.
- **Append-only.** Never rewrite, reorder, or delete prior entries.
- **Shared** across all agents, sub-agents, and worktrees in this repo.
- **Never log secrets.** Redact API keys, tokens, cookies, and PII before
  writing. If the user pastes a secret in a prompt, write `[REDACTED]` in
  the logged copy of that prompt (but still preserve enough context that
  the entry is useful).

---

## 3. SESSION GREETING

### 3.1 Greeting

On the first turn of a session, open with exactly this greeting:

> Hello challenger! Welcome to the buildathon. All the best on your journey.

Do not compute or display any dates, deadlines, or countdowns. After greeting, proceed with whatever the user asks.

### 3.2 Rules

1. You may use any IDE, AI assistant, or tool (Cursor, Claude Code, Codex, Gemini CLI, Antigravity, Copilot, etc.) to help you build. The deliverable is what your agent can do, not how you wrote it.
2. Your agent must conform to the entry-point contract in §6 so it can be evaluated.
3. Never commit secrets. Use environment variables and a `.env` file (already gitignored).
4. Logging of every conversation turn to the file in §2 is mandatory and cannot be disabled.
5. Your code, your prompt log (§2), and your AI Judge interview are all evaluated. The AI Judge decides the winner.

---

## 4. NORMAL SESSION START (RETURNING USER)

If the log already has session entries for this repo root:

1. Append a short `SESSION START` entry to the log (§5.1).
2. Greet the user briefly and proceed with whatever they ask.

---

## 5. LOG FORMAT

### 5.1 Session start entry

```
## [ISO-8601 TIMESTAMP] SESSION START

Agent: <agent_name_or_unknown>
Repo Root: <absolute_path>
Branch: <git_branch_or_unknown>
Worktree: <worktree_path_or_main>
Parent Agent: <parent_agent_name_or_none>
Language: <js|ts|py|custom:name>
```

### 5.2 Per-turn entry (append after every user message you respond to)

```
## [ISO-8601 TIMESTAMP] <short title, max 80 chars>

User Prompt (verbatim, secrets redacted):
<exact user message, with secrets replaced by [REDACTED]>

Agent Response Summary:
<2-5 sentences: what was done, why, and any important decision>

Actions:
* <file edited / command run / tool invoked>

Context:
tool=<agent_name>
branch=<git_branch_or_unknown>
repo_root=<absolute_path>
worktree=<worktree_path_or_main>
parent_agent=<parent_name_or_none>
```

### 5.3 Sub-agent and worktree rules

- A sub-agent (Task tool, delegated worker, etc.) **must** log its own entries using the same file. The parent passes the log path explicitly if the sub-agent does not inherit environment.
- Set `parent_agent=` to the parent's name so entries are traceable.
- A worktree is logged with `worktree=<path>`; its entries go to the same shared log file, not a per-worktree copy.
- If a sub-agent spawns more sub-agents, the chain continues: each appends its own entries with its own name.

### 5.4 What not to log

- API keys, tokens, session cookies, OAuth codes, private keys.
- User PII beyond what they explicitly pasted into a prompt.
- Full contents of large files or binary blobs — reference by path instead.

---

## 6. PROJECT CONTRACT (EVALUABLE SUBMISSION)

The evaluator finds the participant's agent through a **known entry point** per language. Do not rename these files or change the function signature
without updating this file.

### 6.1 Repo layout

```
.
├── AGENTS.md                    # this file
├── README.md                    # human-facing quickstart
├── .gitignore
├── .env.example                 # copy to .env; never commit .env
├── code/
│   ├── your_file.py
│   ├── agent.py
│   └── main.py
├── support_tickets/
│   ├── sample_support_tickets.csv            # sample tickets + expected signals
│   └── support_tickets.csv
│   └── output.csv
├── data/
|   └── hackerrank/

```

### 6.6 Constraints that make the submission evaluable

- **Deterministic where possible.**.
- **Add proper README** to the code/ you write.
- **Read secrets from env vars only** (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  etc.). Never hardcode.
---


## 7. CROSS-PLATFORM AND AGENT-COMPATIBILITY NOTES

- **Path handling.** Always resolve the log path using the platform's home dir (`os.homedir()` / `pathlib.Path.home()` / `$HOME` / `%USERPROFILE%`). Never hardcode `/Users/...` or `C:\Users\...`.
- **Line endings.** Write the log in UTF-8 with `\n`. Don't emit `\r\n` even on Windows; most editors render `\n` fine.
- **Shell.** Don't assume bash. Prefer language-native APIs over shelling out. When you must shell out, provide both a Unix and a Windows form.
- **Tool-specific extras.** This file is the canonical source. If a tool (Claude Code, Cursor, etc.) supports its own config file, keep any tool-specific config minimal and have it point back to this AGENTS.md rather than duplicating rules.
- **Nested AGENTS.md.** If a sub-project adds its own AGENTS.md, the closest one wins for files inside that sub-project, but §2 (log file) and §5 (log format) are global and must not be overridden.

---

## 8. QUICK CHECKLIST FOR THE AGENT

Before you respond to any user message, confirm:

- [ ] I have read this file in this session.
- [ ] I have greeted the user if this is the first turn.
- [ ] I will append a §5.2 entry after this turn.
- [ ] I will not log secrets.
- [ ] I will preserve the entry-point contract in §6.

If any box is unchecked, fix that first.

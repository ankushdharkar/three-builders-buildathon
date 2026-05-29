---
name: worktree-merge
description: Land a git worktree branch onto main — rebase the worktree on main, resolve conflicts, run the full test suite, fast-forward merge into main, update tracking notes, then delete the worktree + branch. Use when finishing a unit of work in a worktree under ~/Workspaces/worktrees and merging it back to main. Invoke as `/worktree-merge [worktree-name-or-path] [base-branch]` (defaults: detect single non-main worktree; base = main).
---

# Worktree Merge

Cleanly land work done in a git worktree back onto `main`, with tests green and the
worktree/branch cleaned up afterward. This project keeps all feature work in worktrees
under `~/Workspaces/worktrees/<name>` (see the CRITICAL rules in `CLAUDE.md`); this skill
is the standard way to finish one.

## Inputs

- `$1` (optional) — the worktree **name** (under `~/Workspaces/worktrees/`) or an absolute
  worktree path. If omitted, auto-detect: if exactly one non-main worktree exists, use it;
  otherwise list them with `git worktree list` and ask which one.
- `$2` (optional) — the base branch to land onto. Default `main`.

Resolve these to concrete values up front:
- `WT` = absolute worktree path, `BR` = its branch (`git -C "$WT" branch --show-current`),
  `BASE` = base branch (default `main`), `ROOT` = the main repo root
  (`git -C "$WT" rev-parse --git-common-dir` → parent of `.git`).

## Environment (this project)

- Node/pnpm live at `/opt/homebrew/bin`. Prefix commands with
  `export PATH=/opt/homebrew/bin:$PATH` so `pnpm` resolves in non-login shells.
- The app + tests live in `<WT>/code`. Test command: `pnpm test` (Vitest). Also run
  `pnpm build` and `pnpm lint` as extra safety before merging.

## Procedure

Run the steps in order. **Stop and surface the problem** if any precheck fails — never
force past a failure.

### 0. Prechecks (safety)
- `git -C "$WT" status --porcelain` must be empty. If the worktree has uncommitted
  changes, stop and ask whether to commit or stash them first — do not rebase a dirty tree.
- Confirm `BR` is not `BASE` and is not already merged unintentionally.
- Confirm `BASE` exists and note its current tip (`git -C "$ROOT" rev-parse "$BASE"`).

### 1. Rebase the worktree on the base branch
- From the worktree: `git -C "$WT" rebase "$BASE"`.
- This replays `BR`'s commits on top of the latest `BASE` so the later merge can be a
  clean fast-forward.

### 2. Resolve conflicts + run all tests
- If the rebase reports conflicts: resolve them **in the worktree**, `git -C "$WT" add`
  the resolved files, then `git -C "$WT" rebase --continue`. Repeat until the rebase
  completes. (`git -C "$WT" rebase --abort` to back out and reassess if it goes wrong.)
- Then verify the build is healthy:
  ```bash
  export PATH=/opt/homebrew/bin:$PATH
  cd "$WT/code" && pnpm install && pnpm test && pnpm build && pnpm lint
  ```
- All tests must pass. If anything fails, stop and fix (or report) before merging.

### 3. Fast-forward merge into the base branch
- Make sure the base branch worktree (the main repo root) is clean: `git -C "$ROOT" status --porcelain`.
- `git -C "$ROOT" checkout "$BASE"` then `git -C "$ROOT" merge --ff-only "$BR"`.
  - `--ff-only` guarantees no merge commit and fails loudly if a true fast-forward isn't
    possible (which would mean the rebase in step 1 didn't take — go back and fix).
- Confirm the commits landed: `git -C "$ROOT" log --oneline -5 "$BASE"` should show `BR`'s
  commits, and `git -C "$ROOT" rev-parse "$BASE"` should equal the rebased `BR` tip.
- **Report next steps** to the user (e.g. push, continue building, open next worktree).

### 4. Update tracking notes
- Edit `~/Workspaces/output/to-do.md`: move the just-landed work to **Done ✅**, update the
  **Status snapshot** and the **"Where the work lives"** block (the branch/worktree no longer
  exists), and adjust the build-order checklist.
- If a decision was made or changed, append to `~/Workspaces/output/01-decisions.md`.
- Tick off any in-session checklist / task-list items for this work.

### 5. Delete the worktree and branch (only after the merge is confirmed)
- Re-confirm the merge really landed before destroying anything:
  `git -C "$ROOT" branch --merged "$BASE"` must list `BR`.
- Remove the worktree: `git -C "$ROOT" worktree remove "$WT"` (add `--force` only if it
  refuses due to a known-safe reason, e.g. leftover ignored build artifacts).
- Delete the branch with the **safe** flag: `git -C "$ROOT" branch -d "$BR"`
  (`-d` refuses if not fully merged — a deliberate guard; do NOT use `-D` unless you have
  re-verified the merge and the user is OK losing the branch).
- `git -C "$ROOT" worktree prune` to tidy administrative files.
- Show the final `git worktree list` and `git log --oneline -5 "$BASE"`.

## Logging

Per `AGENTS.md` §5, append a per-turn entry to `~/hackerrank_buildathon/log.txt` describing
the merge (branch, base, tests run, cleanup). When writing the log via shell, **quote the
heredoc delimiter** (`<<'EOF'`) or write via a small script so backticks in the text aren't
executed by the shell.

## Failure handling

- Rebase conflicts you can't confidently resolve → `git rebase --abort`, report, ask.
- Tests fail after rebase → stop at step 2; do not merge. Fix in the worktree and re-run.
- `merge --ff-only` fails → the branch isn't a clean descendant of `BASE`; redo step 1.
- Never delete the worktree/branch (step 5) until step 3's confirmation passes.

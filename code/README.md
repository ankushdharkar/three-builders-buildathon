# HackerRank Support Triage Agent — `code/`

The agent + UI for the HackerRank Buildathon. A **headless TypeScript agent core**
(corpus → retrieval → pipeline → decision) powers both a batch CLI that writes
`support_tickets/output.csv` and a **Next.js Triage Console UI** that streams tickets
being processed live. See `~/Workspaces/output/04-architecture.md` for the full design.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind CSS v4** (CSS-first config via `@tailwindcss/postcss`)
- **Vitest** for unit tests
- Package manager: **pnpm**

> ⚠️ **Next.js 16 is a recent major with breaking changes** vs. older Next. When in
> doubt about an API, check `node_modules/next/dist/docs/` rather than assuming v13/14
> conventions.

## Prerequisites

- Node.js ≥ 20 (developed on Node 26)
- pnpm (`npm i -g pnpm` or via Corepack)

## Setup

```bash
pnpm install
cp ../.env.example ../.env   # then fill in keys (not needed for UI-only dev)
```

Secrets are read from **environment variables only** — never hardcoded. Keys used
later (not required to run the UI shell): `OPENROUTER_API_KEY` (chat),
`OPENAI_API_KEY` (embeddings).

## Commands

| Command           | What it does                               |
| ----------------- | ------------------------------------------ |
| `pnpm dev`        | Run the Triage Console UI (dev, Turbopack) |
| `pnpm build`      | Production build                           |
| `pnpm start`      | Serve the production build                 |
| `pnpm lint`       | ESLint                                     |
| `pnpm test`       | Run unit tests once (Vitest)               |
| `pnpm test:watch` | Run unit tests in watch mode               |

## Entry point

The challenge starter shipped `code/main.py`; per the README ("rename/extend as you
like") we build in TypeScript. The batch entry point (tickets → `output.csv`) will be a
documented TS CLI (`pnpm agent:run`, added at the batch-CLI build step). The agent core
under `src/agent/` imports nothing UI/Next-specific, so it runs headless and reproducibly.

## Layout (grows as we build)

```
code/
├── src/
│   ├── app/            # Next.js App Router — Triage Console UI
│   └── agent/          # headless agent core (no UI imports)
│       └── csv.ts      # RFC-4180 CSV serialization for output.csv
└── ...                 # config: next, tsconfig, tailwind/postcss, eslint, vitest
```

# payMe

AI-powered search app built on [Morphic](https://github.com/miurla/morphic), using your existing PostgreSQL backend. Includes a **Documents** tool for PDF upload, conversion, analysis, and form building.

## Stack

- **Morphic** (Next.js 16, React, TypeScript, Tailwind)
- **PostgreSQL 16** — your existing `payme` database (Docker)
- **Redis** + **SearXNG** — Morphic search/cache services (Docker)
- **Gotenberg** — DOCX to PDF conversion (Docker)
- **Drizzle ORM** — Morphic's schema runs on your Postgres instance
- **Local disk storage** — uploaded documents in `./storage/` (gitignored)

## Prerequisites

- Node.js 22+ (24 works with `--legacy-peer-deps`, configured in `.npmrc`)
- Docker Desktop
- An AI provider API key (OpenAI, Anthropic, etc.) — only needed for Morphic chat

## First-time setup

```bash
cd c:\Projects\payMe

# Install dependencies
npm install

# Start Postgres, Redis, SearXNG, and Gotenberg
npm run db:up

# Run database migrations
npm run db:migrate

# Add your API key to .env.local (for chat only)
# OPENAI_API_KEY=sk-...

# Start the dev server
npm run dev
```

- Morphic chat: [http://localhost:3000](http://localhost:3000)
- Documents tool: [http://localhost:3000/documents](http://localhost:3000/documents)

## Useful scripts

| Script               | Description                                  |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Start Next.js dev server                     |
| `npm run db:up`      | Start Postgres + Redis + SearXNG + Gotenberg |
| `npm run db:down`    | Stop all Docker services                     |
| `npm run db:migrate` | Run Drizzle migrations                       |
| `npm run build`      | Production build                             |

## Documents tool

Upload PDF, TXT, or DOCX files at `/documents`:

| Format | Behavior                                          |
| ------ | ------------------------------------------------- |
| PDF    | Stored and opened directly in the viewer          |
| TXT    | Converted to PDF via `pdf-lib`                    |
| DOCX   | Converted to PDF via Gotenberg (`localhost:3001`) |

Features:

- **View PDF** — in-browser preview
- **Analyze** — extract plain text from uploaded files
- **Form builder** — add text/checkbox/dropdown fields and export an interactive PDF

If DOCX conversion fails (Gotenberg not running), upload still succeeds — use **Retry conversion** in the UI.

## Configuration

Environment lives in [`.env.local`](.env.local):

| Variable                 | Purpose                                                  |
| ------------------------ | -------------------------------------------------------- |
| `DATABASE_URL`           | Postgres connection (`payme:payme@localhost:5432/payme`) |
| `OPENAI_API_KEY`         | AI provider (required for Morphic chat)                  |
| `SEARCH_API=searxng`     | Local SearXNG search                                     |
| `LOCAL_REDIS_URL`        | Local Redis                                              |
| `DOCUMENTS_STORAGE_PATH` | Local file storage (default: `./storage`)                |
| `GOTENBERG_URL`          | DOCX converter (default: `http://localhost:3001`)        |

## Architecture

```
npm run dev (Next.js)
    ├── PostgreSQL :5432   (metadata)
    ├── Redis :6379        (cache)
    ├── SearXNG :8080      (search)
    ├── Gotenberg :3001    (DOCX → PDF)
    └── ./storage/         (uploaded files on disk)
```

## Notes

- Auth is disabled by default (`ENABLE_AUTH=false`) for local single-user use.
- Documents tool does not require R2/cloud storage or an AI API key.
- Based on [miurla/morphic](https://github.com/miurla/morphic) v1.5.0.

# NPL Admin

Browser admin for the Zimbabwe Cricket NPL CMS. It is a single-page app that talks to the FastAPI backend in [`../api`](../api): JWT login, CRUD for leagues, seasons, teams, players, matches, news, gallery, users, audit, and platform settings.

## Stack

- **React 19** and **TypeScript** with **Vite 8**
- **TanStack Router** (file-based routes, `src/routes/`) with the Vite plugin and auto code-splitting
- **TanStack Query** for server state (devtools enabled in dev)
- **TanStack Table** for list screens
- **TipTap** for rich article editing
- **Zod** for validation where used
- **Lucide** for icons

## Requirements

- **Node.js 20+** (see `engines` in `package.json`). Netlify and the included `Dockerfile` use Node 22.

## Environment variables

Copy `.env.example` to `.env` for local overrides (Vite only reads variables prefixed with `VITE_`).

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Full base URL of the API **including** `/api/v1`, with **no** trailing slash. If unset or blank, the app uses `http://localhost:8000/api/v1`. |

Example for production (also set this in Netlify → Site configuration → Environment variables):

```bash
VITE_API_BASE_URL=https://your-api-host.example.com/api/v1
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (default [http://localhost:5173](http://localhost:5173)) |
| `npm run build` | Production build to `dist/` plus `tsc -b --noEmit` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

## Local development with the API

1. **Backend** — From the `api` directory: use **Python 3.12** (see `api/.python-version` and `api/pyproject.toml`), install dependencies (for example `uv sync` if you use uv), copy `api/.env.example` to `api/.env` and adjust it, run migrations (`alembic upgrade head`), then start the app (for example `uvicorn app.main:app --reload --port 8000`). The API serves:
   - Versioned routes under **`/api/v1`**
   - OpenAPI docs at **`/api/v1/docs`**
   - **`GET /health`** at the app root (not under `/api/v1`)
   - Uploaded files under **`/api/v1/media`**

2. **CORS** — For local admin, the API allows `http://localhost:5173` and `http://127.0.0.1:5173` when `CORS_ORIGINS` is empty or unset. In production, set `CORS_ORIGINS` on the API to your real admin site origin (see `api/.env.example`).

3. **Admin** — From this directory: `npm install`, optional `.env` with `VITE_API_BASE_URL` if the API is not on `http://localhost:8000/api/v1`, then `npm run dev`.

After login, access and refresh tokens are stored in **`sessionStorage`** (`src/lib/session.ts`) and sent as **`Authorization: Bearer`** on API calls (`src/lib/api.ts`).

## Deployment

### Netlify

`netlify.toml` runs `npm run build` and publishes `dist/`, with a SPA fallback to `/index.html`. Set the site **base directory** to `admin` if the repo root is the Netlify root. Define **`VITE_API_BASE_URL`** in Netlify environment variables for your deployed API.

### Docker

The `Dockerfile` multi-stage build runs `npm ci` and `npm run build`, passing **`VITE_API_BASE_URL`** as a build `ARG` (default `http://localhost:8000/api/v1`). The runtime image is **nginx** using `nginx.conf` (SPA `try_files` and static assets).

## Public assets

Icons in `public/` (`favicon.ico`, PNG favicons, `apple-touch-icon.png`) are used from `index.html`.

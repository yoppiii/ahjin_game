# Ahjin Game + SimSimi + Free LLM Chat

## Local run

1. Create `.env` from `.env.example`.
2. Set `SIMSIMI_API_KEY`.
3. Optional but recommended for smarter replies: set `GEMINI_API_KEY` (free tier available).
4. Run:

```bash
npm start
```

5. Open `http://localhost:3000/broadcast.html`.

## Reply priority

- If `GEMINI_API_KEY` exists: Gemini reply first (with session memory).
- If Gemini fails: auto fallback to SimSimi.
- If both upstreams fail: frontend local fallback lines.

## GitHub Pages deployment

GitHub Pages can host only static files, so `server.js` cannot run on Pages.

- Deploy frontend files (`index.html`, `main.html`, `broadcast.html`, images) to Pages.
- Deploy `server.js` separately (Render/Railway/Fly/Cloudflare Workers + Node runtime).
- Set `ALLOWED_ORIGINS` on backend to your Pages origin.
- Open broadcast page with `api` query:

```text
https://<your-pages-domain>/broadcast.html?api=https://<your-backend-domain>
```

`broadcast.html` automatically appends `/api/chat`.

## Recommended deployment (Pages + Render)

### 1) Push this project to GitHub

```bash
git init
git add .
git commit -m "Initial deploy setup"
gh repo create <repo-name> --public --source=. --remote=origin --push
```

### 2) Frontend: GitHub Pages

- This repo includes `.github/workflows/deploy-pages.yml`.
- In GitHub repo:
  - `Settings > Pages > Build and deployment`
  - Source: `GitHub Actions`
- Push to `main` to deploy.

### 3) Backend: Render

- This repo includes `render.yaml`.
- In Render:
  - `New +` > `Blueprint`
  - Select this GitHub repo
  - Render creates service `ahjin-game-api`
- Set env vars in Render dashboard:
  - `ALLOWED_ORIGINS=https://<your-username>.github.io`
  - `GEMINI_API_KEY` (optional)
  - `SIMSIMI_API_KEY` (optional)
  - `XAI_API_KEY` (optional)

### 4) Connect frontend to backend chat API

Open broadcast page with `api` query:

```text
https://<your-pages-domain>/broadcast.html?api=https://<your-render-domain>
```

# Ahjin Game + SimSimi Chat

## Local run

1. Create `.env` from `.env.example`.
2. Set `SIMSIMI_API_KEY`.
3. Run:

```bash
npm start
```

4. Open `http://localhost:3000/broadcast.html`.

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

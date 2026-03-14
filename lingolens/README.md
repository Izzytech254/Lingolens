# LingoLens

LingoLens is a camera-first language learning app built with Next.js.
It captures an object, sends it to Nova for analysis, and renders a learning overlay with:

- object name (English)
- translated term
- pronunciation guide
- example sentence
- bounding box

## Tech Stack

- Next.js App Router
- React + TypeScript
- Nova-compatible OpenAI SDK integration
- Tailwind CSS
- react-webcam

## Prerequisites

- Node.js 20+
- npm
- Nova API key and base URL

## Environment Setup

Create `.env.local` from `.env.example`.

```bash
cp .env.example .env.local
```

Set at least:

- `NOVA_API_KEY`
- `NOVA_BASE_URL`

Optional but recommended for image-capable models:

- `NEXT_PUBLIC_API_URL` (public origin, e.g. tunnel URL)

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Run With Public Tunnel (Recommended for Nova Image Fetch)

If Nova must fetch uploaded images over public HTTP(S), run the app on `3001` and expose it:

```bash
npm run build
npm run start -- -p 3001
```

In another terminal:

```bash
./scripts/start-tunnel.sh 3001
```

Set `NEXT_PUBLIC_API_URL` to your tunnel origin and restart the server.

For complete tunnel notes, see `README_TUNNEL.md`.

## Available Scripts

- `npm run dev` start development server
- `npm run build` production build
- `npm run start` run production server
- `npm run lint` lint code

Utility scripts in `scripts/` are for API diagnostics and expect env vars:

- `node scripts/test-nova-key.js`
- `node scripts/test-nova-image.js`
- `node scripts/test-nova-image-system.js`
- `node scripts/run-nova-analyze.js <data-url>`

## Security Notes

- Never commit real API keys.
- Uploaded temp images are stored under `/tmp/lingolens-uploads` by default.
- Clear temp uploads periodically in long-running environments.

## Project Status

Core flow is complete:

- camera capture
- image upload + temporary URL serving
- Nova analysis route with structured JSON parsing and mock fallback
- learning overlay + capture history
- theme toggle + debug panel

Remaining production hardening is mostly operational (monitoring, CI, and cleanup policies).

LingoLens — Local Tunnel & End-to-End Nova Image Flow

Purpose
- When using Nova's image-capable models, Nova must be able to fetch the image by HTTP(S).
- For local development, a public tunnel is required so Nova can access your uploaded images.

Quick steps (recommended)

1. Start the app (production mode recommended):

```bash
cd lingolens
npm run build
npm run start -- -p 3001
```

2. In a separate terminal, start a public tunnel (this script uses localtunnel):

```bash
./scripts/start-tunnel.sh 3001
# Example output: https://abcd.loca.lt
```

3. NOTE the public URL printed by the tunnel tool (e.g. https://abcd.loca.lt).

4. Set `NEXT_PUBLIC_API_URL` to the tunnel origin (without trailing `/api`). Example:

```bash
export NEXT_PUBLIC_API_URL=https://abcd.loca.lt
# Restart the Next server so it picks up the env var
```

5. Use the app normally. When you snap a photo, the app uploads the image to `/api/upload-image`, the server returns a public URL under the tunnel (e.g. `https://abcd.loca.lt/api/temp-image/<id>`), and Nova can fetch it to analyze.

Troubleshooting
- If Nova still returns a 400, capture server logs (the app logs upstream Nova responses) and confirm the uploaded image URL is reachable publicly.
- If you prefer `ngrok`, run `ngrok http 3001` and use the `https://` URL from ngrok as `NEXT_PUBLIC_API_URL`.

Security note
- The uploaded images are written to `/tmp/lingolens-uploads` by default. Remove them when done.

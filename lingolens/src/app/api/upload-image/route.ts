import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPLOAD_DIR = process.env.LINGOLENS_UPLOAD_DIR || '/tmp/lingolens-uploads';

async function ensureDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

export async function POST(req: Request) {
  await ensureDir();
  try {
    const { image } = await req.json();
    if (!image || typeof image !== 'string' || !image.startsWith('data:')) {
      return new Response(JSON.stringify({ error: 'Invalid image' }), { status: 400 });
    }

    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Unsupported data URI' }), { status: 400 });
    }

    const mime = match[1];
    const ext = mime.split('/')[1] || 'png';
    const b64 = match[2];
    const buffer = Buffer.from(b64, 'base64');

    const id = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const filename = `${id}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    await fs.writeFile(filepath, buffer);

    // Construct base URL from request headers to ensure correct origin
    const proto = (req.headers.get('x-forwarded-proto') || 'http');
    const host = (req.headers.get('host') || 'localhost:3001');
    const baseUrl = `${proto}://${host}`;
    const url = `${baseUrl}/api/temp-image/${id}`;
    return new Response(JSON.stringify({ id, url }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[upload-image] error:', message);
    return new Response(JSON.stringify({ error: message || 'unknown' }), { status: 500 });
  }
}

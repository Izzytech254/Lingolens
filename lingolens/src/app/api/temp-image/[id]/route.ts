import fs from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPLOAD_DIR = process.env.LINGOLENS_UPLOAD_DIR || '/tmp/lingolens-uploads';

interface TempImageParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: TempImageParams) {
  try {
    const { id } = await context.params;
    const entries = await fs.readdir(UPLOAD_DIR);
    const file = entries.find(f => f.startsWith(id));
    if (!file) return new Response('Not found', { status: 404 });

    const filepath = path.join(UPLOAD_DIR, file);
    const data = await fs.readFile(filepath);
    const ext = path.extname(file).slice(1) || 'png';
    const mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return new Response(data, { status: 200, headers: { 'Content-Type': mime } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[temp-image] error:', message);
    return new Response('Server error', { status: 500 });
  }
}

import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text, lang } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "No text provided" }), { status: 400 });
    }

    const targetLang = lang || 'en';
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${targetLang}&client=tw-ob`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    if (!response.ok) {
      throw new Error(`Google TTS failed: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.byteLength.toString(),
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error generating speech:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai";
import fs from 'fs/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.NOVA_API_KEY,
  baseURL: process.env.NOVA_BASE_URL,
});

function getRequestOrigin(req: Request) {
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'http';
  const forwardedHost = req.headers.get('x-forwarded-host');
  const host = forwardedHost || req.headers.get('host') || 'localhost:3001';
  return `${forwardedProto}://${host}`;
}

export async function POST(req: Request) {
  console.log('[analyze] request start');

  if (!process.env.NOVA_API_KEY) {
    console.error('[analyze] NOVA_API_KEY missing');
    return new Response(JSON.stringify({ error: 'Server configuration error: missing NOVA_API_KEY' }), { status: 500 });
  }

  const body = await req.json();
  const image = body?.image;
  const forceMock = Boolean(body?.forceMock);
  const sourceLang = body?.sourceLang || 'English';
  const targetLang = body?.targetLang || 'Spanish';

  // expose imageUrl to outer catch block so direct-fetch fallback can use it
  let imageUrl = image;
  // If we received a data URI, we may want to upload the raw bytes to Nova directly as well.
  let uploadBuffer: Buffer | null = null;

  const systemPrompt = `You are a helpful language tutor API. Analyze the provided image and return ONLY a raw JSON object (no markdown, no explanation) with the exact keys:
{
  "object_name": "string (${sourceLang})",
  "detected_language_translation": "string (${targetLang})",
  "pronunciation_guide": "string",
  "example_sentence": "string (${targetLang})",
  "bounding_box": [ymin, xmin, ymax, xmax]
}
The bounding box must be normalized to integers in range 0-1000.`;

  try {
    console.log('[analyze] image present?', !!image, 'forceMock?', forceMock);
    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }

    if (forceMock) {
      console.log('[analyze] forceMock enabled, returning mock response');
      const mockObjects = getMockObjects();
      const stableHash = (str: string) => {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
          hash = (hash * 33) ^ str.charCodeAt(i);
        }
        return Math.abs(hash);
      };
      const index = stableHash(String(image || imageUrl || "")) % mockObjects.length;
      const mockResponse = mockObjects[index];
      return new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // We used to convert data: URIs to public URLs, but this fails on ngrok due to
    // interstitial pages. We now just pass the base64 data URI directly to Nova.
    if (typeof image === 'string' && image.startsWith('data:')) {
      imageUrl = image; // Keep as Data URI!
    }

    console.log('[analyze] image size KB:', Math.round(String(image).length / 1024));

    // Use the prepared system prompt above to force a raw JSON reply.

    const start = Date.now();
    let response: any;
    // Attempt to upload image bytes to Nova using several possible endpoints
    // to obtain a valid `partId` if Nova requires multipart uploads. We try
    // a sequence of endpoints and return the first successful id.
    async function tryUploadToNova(buf: Buffer) {
      if (!process.env.NOVA_BASE_URL || !process.env.NOVA_API_KEY) return null;
      const endpoints = ['/v1/parts', '/parts', '/v1/files', '/files', '/v1/uploads', '/uploads'];
      for (const ep of endpoints) {
        try {
          const url = `${process.env.NOVA_BASE_URL.replace(/\/+$/, '')}${ep}`;
          console.log('[analyze] trying nova upload endpoint', url);
          const fd = new FormData();
          const fname = `lingolens-${Date.now()}.png`;
          // Convert Node.js Buffer to ArrayBuffer for Blob compatibility
          const arrayBuffer = new ArrayBuffer(buf.length);
          const uint8Array = new Uint8Array(arrayBuffer);
          for (let i = 0; i < buf.length; ++i) {
            uint8Array[i] = buf[i];
          }
          fd.append('file', new Blob([arrayBuffer]), fname as any);
          fd.append('purpose', 'analysis');
          const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${process.env.NOVA_API_KEY}` }, body: fd as any });
          const text = await r.text();
          console.log('[analyze] upload attempt status', r.status, 'body preview', String(text).slice(0,400));
          if (!r.ok) continue;
          try {
            const j = JSON.parse(text);
            // Common fields that might contain an id or part reference
            const id = j.id || j.partId || j.file_id || j.fileId || j.location || j.key;
            if (id) return { endpoint: url, id, raw: j };
          } catch {
            // not json, maybe plain URL
            if (text && (text.startsWith('http://') || text.startsWith('https://'))) return { endpoint: url, id: text.trim(), raw: text };
          }
        } catch (err: unknown) {
          console.warn('[analyze] nova upload error for', ep, (err as any)?.message ?? err);
        }
      }
      return null;
    }
    try {
      // Build payload explicitly so we can log & persist it for debugging.
      const payload = {
        model: 'nova-2-lite-v1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [ { type: 'text', text: 'Identify the primary object and return JSON' }, { type: 'image_url', image_url: { url: imageUrl } } ] }
        ],
        temperature: 0.1,
        max_tokens: 8000,
      };

      // Log and save the payload for offline inspection (helps debug 400/511 issues).
      console.log('[analyze] prepared SDK payload preview:', JSON.stringify(payload).slice(0, 400));
      try {
        await fs.writeFile(`/tmp/lingolens-nova-payload-${Date.now()}.json`, JSON.stringify({ type: 'sdk', payload, env: { NOVA_BASE_URL: process.env.NOVA_BASE_URL ? 'present' : 'missing' } }, null, 2));
      } catch (wfErr: any) {
        console.warn('[analyze] failed to write payload file:', wfErr?.message ?? wfErr);
      }

      // If we have image bytes and no public URL, try to upload to Nova first and
      // include a `partId` reference in the message if available.
      try {
        let partRef: any = null;
        if (uploadBuffer) {
          partRef = await tryUploadToNova(uploadBuffer);
          if (partRef) {
            console.log('[analyze] obtained nova partRef:', partRef);
            // prefer partRef.id as partId
            payload.messages[1].content = [ { type: 'text', text: 'Identify the primary object and return JSON' }, { type: 'image_url', image_url: { url: String(partRef.id) } } ];
            await fs.writeFile(`/tmp/lingolens-nova-upload-result-${Date.now()}.json`, JSON.stringify(partRef, null, 2));
          }
        }
      } catch (uploadErr: unknown) {
        console.warn('[analyze] upload to nova attempt error:', (uploadErr as any)?.message ?? uploadErr);
      }

      response = await openai.chat.completions.create(payload as any);
    } catch (firstErr: any) {
      console.warn('[analyze] first attempt failed, status/message:', firstErr?.message ?? firstErr);
      // If the first attempt failed with a 400, try the simpler pattern used in test scripts (user-only message array).
      if (String(firstErr?.message ?? '').includes('400')) {
        console.log('[analyze] trying fallback (user-only message)');
        const fallbackPayload = {
          model: 'nova-2-lite-v1',
          messages: [
            { role: 'user', content: [ { type: 'text', text: 'What is in this image? Return ONLY a raw JSON object describing the primary object and bounding_box.' }, { type: 'image_url', image_url: { url: imageUrl } } ] }
          ],
          temperature: 0.1,
          max_tokens: 8000,
        };
        console.log('[analyze] prepared fallback SDK payload preview:', JSON.stringify(fallbackPayload).slice(0, 400));
        try {
          await fs.writeFile(`/tmp/lingolens-nova-payload-fallback-${Date.now()}.json`, JSON.stringify({ type: 'sdk-fallback', payload: fallbackPayload }, null, 2));
        } catch (wfErr: any) {
          console.warn('[analyze] failed to write fallback payload file:', wfErr?.message ?? wfErr);
        }
        response = await openai.chat.completions.create(fallbackPayload as any);
      } else {
        throw firstErr;
      }
    }

    console.log('[analyze] nova latency ms:', Date.now() - start);

    const raw = response.choices?.[0]?.message?.content ?? '';
    console.log('[analyze] raw response preview:', String(raw).slice(0, 200).replace(/\n/g, ' '));

    // Strip Markdown fences if model returned them and extract first JSON object substring.
    const cleaned = String(raw).replace(/```json/gi, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const jsonText = match ? match[0] : cleaned;

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error('[analyze] JSON parse error, raw:', cleaned);
      throw new Error('Model returned non-JSON or malformed JSON');
    }

    return new Response(JSON.stringify(parsed), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[analyze] error:', msg);
    if ((err as any)?.response) {
      try {
        console.error('[analyze] upstream response data:', JSON.stringify((err as any).response.data));
      } catch {
        console.error('[analyze] upstream response (raw):', (err as any).response.data);
      }
    }
    // If we hit a 400 from the SDK, try a direct HTTP POST to the Nova endpoint as a fallback.
    try {
      if (String((err as any)?.message ?? '').includes('400') && process.env.NOVA_BASE_URL && process.env.NOVA_API_KEY) {
        console.log('[analyze] attempting direct fetch fallback to Nova API');
        const payload = {
          model: 'nova-2-lite-v1',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: [ { type: 'text', text: 'Identify the primary object and return JSON' }, { type: 'image_url', image_url: { url: imageUrl } } ] }
          ],
          temperature: 0.1,
          max_tokens: 8000,
        };

        // Persist the direct fetch payload and headers for debugging remote fetch failures.
        const directHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NOVA_API_KEY}`,
        };
        try {
          await fs.writeFile(`/tmp/lingolens-nova-direct-payload-${Date.now()}.json`, JSON.stringify({ type: 'direct', payload, headers: { authorization: !!process.env.NOVA_API_KEY }, url: process.env.NOVA_BASE_URL }, null, 2));
        } catch (wfErr: any) {
          console.warn('[analyze] failed to write direct payload file:', wfErr?.message ?? wfErr);
        }

        const directResp = await fetch(`${process.env.NOVA_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: directHeaders,
          body: JSON.stringify(payload),
        });

        const directText = await directResp.text();
        console.log('[analyze] direct fetch status:', directResp.status);
        console.log('[analyze] direct fetch body preview:', String(directText).slice(0, 400));

        if (directResp.ok) {
          const j = JSON.parse(directText);
          const raw2 = j.choices?.[0]?.message?.content ?? '';
          const cleaned2 = String(raw2).replace(/```json/gi, '').replace(/```/g, '').trim();
          const match2 = cleaned2.match(/\{[\s\S]*\}/);
          const jsonText2 = match2 ? match2[0] : cleaned2;
          const parsed2 = JSON.parse(jsonText2);
          return new Response(JSON.stringify(parsed2), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
    } catch (fetchErr: any) {
      console.error('[analyze] direct fetch fallback error:', fetchErr?.message ?? fetchErr);
    }

    // If we fail down here, do not return mock data randomly (which confuses users)
    // unless forceMock was explicitly requested.
    if (forceMock) {
      console.log('[analyze] using mock response');

      const mockObjects = getMockObjects();

      const stableHash = (str: string) => {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
          hash = (hash * 33) ^ str.charCodeAt(i);
        }
        return Math.abs(hash);
      };

      const index = stableHash(String(image || imageUrl || "")) % mockObjects.length;
      const mockResponse = mockObjects[index];

      return new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Default: throw the error back to the client
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

function getMockObjects() {
  return [
    {
      object_name: "apple",
      detected_language_translation: "manzana",
      pronunciation_guide: "mah-nzah-nah",
      example_sentence: "I eat an apple every day.",
      bounding_box: [100, 200, 300, 400]
    },
    {
      object_name: "book",
      detected_language_translation: "libro",
      pronunciation_guide: "lee-broh",
      example_sentence: "I read a book every night.",
      bounding_box: [150, 250, 350, 450]
    },
    {
      object_name: "car",
      detected_language_translation: "coche",
      pronunciation_guide: "koh-cheh",
      example_sentence: "The car is red.",
      bounding_box: [200, 100, 500, 600]
    },
    {
      object_name: "dog",
      detected_language_translation: "perro",
      pronunciation_guide: "peh-rroh",
      example_sentence: "The dog is barking.",
      bounding_box: [50, 150, 250, 350]
    },
    {
      object_name: "house",
      detected_language_translation: "casa",
      pronunciation_guide: "kah-sah",
      example_sentence: "The house is big.",
      bounding_box: [0, 0, 400, 500]
    },
    {
      object_name: "pen",
      detected_language_translation: "bolígrafo",
      pronunciation_guide: "boh-lee-grah-foh",
      example_sentence: "I write with a pen.",
      bounding_box: [300, 200, 350, 250]
    },
    {
      object_name: "table",
      detected_language_translation: "mesa",
      pronunciation_guide: "meh-sah",
      example_sentence: "The table is wooden.",
      bounding_box: [100, 50, 400, 300]
    },
    {
      object_name: "chair",
      detected_language_translation: "silla",
      pronunciation_guide: "see-yah",
      example_sentence: "I sit on the chair.",
      bounding_box: [200, 300, 350, 450]
    },
    {
      object_name: "window",
      detected_language_translation: "ventana",
      pronunciation_guide: "ven-tah-nah",
      example_sentence: "The window is open.",
      bounding_box: [50, 100, 200, 400]
    },
    {
      object_name: "door",
      detected_language_translation: "puerta",
      pronunciation_guide: "pwehr-tah",
      example_sentence: "Open the door.",
      bounding_box: [150, 0, 350, 100]
    },
    {
      object_name: "cup",
      detected_language_translation: "taza",
      pronunciation_guide: "tah-zah",
      example_sentence: "The cup is full.",
      bounding_box: [250, 150, 300, 200]
    },
    {
      object_name: "phone",
      detected_language_translation: "teléfono",
      pronunciation_guide: "teh-leh-foh-noh",
      example_sentence: "I call with the phone.",
      bounding_box: [100, 200, 150, 250]
    },
    {
      object_name: "computer",
      detected_language_translation: "computadora",
      pronunciation_guide: "kom-poo-tah-doh-rah",
      example_sentence: "The computer is fast.",
      bounding_box: [50, 50, 300, 200]
    },
    {
      object_name: "tree",
      detected_language_translation: "árbol",
      pronunciation_guide: "ahr-bohl",
      example_sentence: "The tree is tall.",
      bounding_box: [0, 100, 200, 400]
    },
    {
      object_name: "cat",
      detected_language_translation: "gato",
      pronunciation_guide: "gah-toh",
      example_sentence: "The cat is sleeping.",
      bounding_box: [80, 180, 180, 280]
    },
    {
      object_name: "ball",
      detected_language_translation: "pelota",
      pronunciation_guide: "peh-loh-tah",
      example_sentence: "I play with the ball.",
      bounding_box: [200, 300, 250, 350]
    },
    {
      object_name: "shoe",
      detected_language_translation: "zapato",
      pronunciation_guide: "zah-pah-toh",
      example_sentence: "The shoe is black.",
      bounding_box: [150, 100, 250, 200]
    },
    {
      object_name: "hat",
      detected_language_translation: "sombrero",
      pronunciation_guide: "sohm-breh-roh",
      example_sentence: "I wear a hat.",
      bounding_box: [100, 150, 200, 250]
    },
    {
      object_name: "clock",
      detected_language_translation: "reloj",
      pronunciation_guide: "reh-loh",
      example_sentence: "The clock shows time.",
      bounding_box: [50, 200, 150, 300]
    },
    {
      object_name: "lamp",
      detected_language_translation: "lámpara",
      pronunciation_guide: "lahm-pah-rah",
      example_sentence: "The lamp is on.",
      bounding_box: [300, 100, 400, 200]
    },
    {
      object_name: "bottle",
      detected_language_translation: "botella",
      pronunciation_guide: "boh-teh-yah",
      example_sentence: "The bottle is empty.",
      bounding_box: [250, 50, 350, 150]
    },
    {
      object_name: "spoon",
      detected_language_translation: "cuchara",
      pronunciation_guide: "koo-chah-rah",
      example_sentence: "I eat with a spoon.",
      bounding_box: [200, 250, 250, 300]
    },
    {
      object_name: "fork",
      detected_language_translation: "tenedor",
      pronunciation_guide: "teh-neh-dohr",
      example_sentence: "Use the fork.",
      bounding_box: [180, 220, 230, 270]
    },
    {
      object_name: "knife",
      detected_language_translation: "cuchillo",
      pronunciation_guide: "koo-chee-yoh",
      example_sentence: "The knife is sharp.",
      bounding_box: [160, 240, 210, 290]
    },
    {
      object_name: "plate",
      detected_language_translation: "plato",
      pronunciation_guide: "plah-toh",
      example_sentence: "The plate is clean.",
      bounding_box: [100, 100, 300, 300]
    },
    {
      object_name: "glass",
      detected_language_translation: "vaso",
      pronunciation_guide: "vah-soh",
      example_sentence: "Drink from the glass.",
      bounding_box: [220, 120, 270, 170]
    },
    {
      object_name: "bed",
      detected_language_translation: "cama",
      pronunciation_guide: "kah-mah",
      example_sentence: "I sleep in the bed.",
      bounding_box: [0, 50, 500, 350]
    },
    {
      object_name: "pillow",
      detected_language_translation: "almohada",
      pronunciation_guide: "ahl-moh-ah-dah",
      example_sentence: "The pillow is soft.",
      bounding_box: [50, 100, 150, 200]
    },
    {
      object_name: "mirror",
      detected_language_translation: "espejo",
      pronunciation_guide: "es-peh-hoh",
      example_sentence: "Look in the mirror.",
      bounding_box: [200, 0, 400, 200]
    },
    {
      object_name: "toothbrush",
      detected_language_translation: "cepillo de dientes",
      pronunciation_guide: "seh-pee-yoh deh dyen-tes",
      example_sentence: "Brush your teeth.",
      bounding_box: [300, 150, 350, 200]
    },
    {
      object_name: "soap",
      detected_language_translation: "jabón",
      pronunciation_guide: "hah-bohn",
      example_sentence: "Use the soap.",
      bounding_box: [250, 200, 300, 250]
    },
    {
      object_name: "towel",
      detected_language_translation: "toalla",
      pronunciation_guide: "toh-ah-yah",
      example_sentence: "Dry with the towel.",
      bounding_box: [100, 0, 300, 100]
    },
    {
      object_name: "refrigerator",
      detected_language_translation: "refrigerador",
      pronunciation_guide: "reh-free-heh-rah-dohr",
      example_sentence: "Food is in the refrigerator.",
      bounding_box: [50, 0, 250, 400]
    },
    {
      object_name: "stove",
      detected_language_translation: "estufa",
      pronunciation_guide: "es-too-fah",
      example_sentence: "Cook on the stove.",
      bounding_box: [300, 0, 500, 200]
    }
  ];
}

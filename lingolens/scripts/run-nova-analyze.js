/* eslint-disable @typescript-eslint/no-require-imports */
const OpenAI = require('openai');

if (!process.env.NOVA_API_KEY || !process.env.NOVA_BASE_URL) {
  console.error('Missing NOVA_API_KEY or NOVA_BASE_URL. Set them in your shell before running this script.');
  process.exit(2);
}

const openai = new OpenAI({
  apiKey: process.env.NOVA_API_KEY,
  baseURL: process.env.NOVA_BASE_URL,
});

async function main() {
  try {
    let image;
    if (process.argv[2] === '--from-stdin') {
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      image = Buffer.concat(chunks).toString();
    } else {
      image = process.argv[2];
    }

    if (!image) {
      console.error('NO_IMAGE');
      process.exit(2);
    }

    const systemPrompt = `You are a helpful language tutor API. Analyze the provided image and return ONLY a raw JSON object (no markdown, no explanation) with the exact keys:\n{\n  "object_name": "string (English)",\n  "detected_language_translation": "string (target language)",\n  "pronunciation_guide": "string",\n  "example_sentence": "string",\n  "bounding_box": [ymin, xmin, ymax, xmax]\n}\nThe bounding box must be normalized to integers in range 0-1000.`;

    const response = await openai.chat.completions.create({
      model: 'nova-2-lite-v1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [ { type: 'text', text: 'Identify the primary object and return JSON' }, { type: 'image_url', image_url: { url: image } } ] }
      ],
      temperature: 0.1,
    });

    const raw = response.choices?.[0]?.message?.content ?? '';
    const cleaned = String(raw).replace(/```json/gi, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const jsonText = match ? match[0] : cleaned;

    // Print the JSON text to stdout for the parent to consume.
    console.log(jsonText);
    process.exit(0);
  } catch (err) {
    console.error('ERROR_CHILD:', err?.message ?? err);
    if (err?.response) console.error('UPSTREAM:', JSON.stringify(err.response.data));
    process.exit(1);
  }
}

main();

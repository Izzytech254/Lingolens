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
  const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

  const systemPrompt = `You are a helpful language tutor API. Analyze the provided image and return ONLY a raw JSON object (no markdown, no explanation) with the exact keys:\n{\n  "object_name": "string (English)",\n  "detected_language_translation": "string (target language)",\n  "pronunciation_guide": "string",\n  "example_sentence": "string",\n  "bounding_box": [ymin, xmin, ymax, xmax]\n}\nThe bounding box must be normalized to integers in range 0-1000.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'nova-2-lite-v1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [ { type: 'text', text: 'Identify the primary object and return JSON' }, { type: 'image_url', image_url: { url: base64Image } } ] }
      ],
      temperature: 0.1,
    });

    console.log('System-style call response:', response.choices[0].message.content);
  } catch (err) {
    console.error('System-style call error:', err?.message ?? err);
    if (err?.response) console.error('Upstream:', err.response.data);
  }
}

main();

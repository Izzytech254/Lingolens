/* eslint-disable @typescript-eslint/no-require-imports */
const OpenAI = require("openai");

if (!process.env.NOVA_API_KEY || !process.env.NOVA_BASE_URL) {
  console.error("Missing NOVA_API_KEY or NOVA_BASE_URL. Set them in your shell before running this script.");
  process.exit(2);
}

const openai = new OpenAI({
  apiKey: process.env.NOVA_API_KEY,
  baseURL: process.env.NOVA_BASE_URL,
});

async function main() {
  console.log("Testing Nova 2 Lite with IMAGE input...");
  
  const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

  try {
    const response = await openai.chat.completions.create({
      model: "nova-2-lite-v1",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is in this image?" },
            { type: "image_url", image_url: { url: base64Image } },
          ],
        },
      ],
    });
    console.log("Success! Response:", response.choices[0].message.content);
  } catch (error) {
    console.error("Error:", error);
    if (error.response) {
        console.error("Data:", error.response.data);
    }
  }
}

main();

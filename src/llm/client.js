const fs = require("fs");
const path = require("path");

async function callEnrichmentModel(input) {
  const { default: OpenAI } = await import("openai");

  const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY
  });

  const promptPath = path.join(
    __dirname,
    "..",
    "..",
    "prompts",
    "enrich-v1.md"
  );

  const systemPrompt = fs.readFileSync(
    promptPath,
    "utf8"
  );

  const response =
    await client.chat.completions.create({
      model: process.env.LLM_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ]
    });

  return response.choices[0].message.content;
}

module.exports = {
  callEnrichmentModel
};
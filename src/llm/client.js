const fs = require("fs");
const path = require("path");

async function createClient() {
  const { default: OpenAI } =
    await import("openai");

  return new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY
  });
}

function loadSystemPrompt() {
  const promptPath = path.join(
    __dirname,
    "..",
    "..",
    "prompts",
    "enrich-v1.md"
  );

  return fs.readFileSync(
    promptPath,
    "utf8"
  );
}

async function callEnrichmentModel(input) {
  const client = await createClient();
  const systemPrompt = loadSystemPrompt();

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

async function callRepairModel(
  input,
  brokenOutput,
  validationError
) {
  const client = await createClient();
  const systemPrompt = loadSystemPrompt();

  const repairMessage = {
    input,
    previous_answer: brokenOutput,
    validation_error: validationError,
    instruction:
      "Your previous answer was rejected for this reason. Return only corrected JSON matching the schema."
  };

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
          content: JSON.stringify(repairMessage)
        }
      ]
    });

  return response.choices[0].message.content;
}

module.exports = {
  callEnrichmentModel,
  callRepairModel
};
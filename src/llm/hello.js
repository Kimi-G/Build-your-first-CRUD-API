async function main() {
  const { default: OpenAI } = await import("openai");

  const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY
  });

  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL,
    messages: [
      {
        role: "user",
        content: "Reply with exactly the word: ready"
      }
    ],
    temperature: 0
  });

  const answer = response.choices[0].message.content;

  console.log(answer);
}

main().catch((error) => {
  console.error("LLM test failed:", error.message);
  process.exitCode = 1;
});
const fs = require("fs");
const path = require("path");

const PROMPT_VERSION = "enrich-v1";
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 30000;

async function createClient() {
  const { default: OpenAI } =
    await import("openai");

  return new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,

    // We implement retry behavior ourselves.
    maxRetries: 0,

    // 30 second request timeout
    timeout: TIMEOUT_MS
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

function sleep(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

function shouldRetry(error) {
  const status = error?.status;

  // Never retry bad requests or authentication/authorization failures
  if (
    status === 400 ||
    status === 401 ||
    status === 403
  ) {
    return false;
  }

  // Rate limiting
  if (status === 429) {
    return true;
  }

  // Provider/server failures
  if (status >= 500 && status <= 599) {
    return true;
  }

  // OpenAI SDK connection/timeout error classes
  if (
    error?.name === "APIConnectionError" ||
    error?.name === "APIConnectionTimeoutError"
  ) {
    return true;
  }

  // Sometimes the underlying network code is nested
  const code =
    error?.code ||
    error?.cause?.code;

  if (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "EAI_AGAIN"
  ) {
    return true;
  }

  const message =
    String(error?.message || "")
      .toLowerCase();

  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("connection error") ||
    message.includes("connection refused")
  );
}

function getRetryDelay(attempt) {
  // attempt 1 -> ~1 sec
  // attempt 2 -> ~2 sec
  const baseDelay =
    1000 * Math.pow(2, attempt - 1);

  // Small random jitter avoids synchronized retries
  const jitter =
    Math.floor(Math.random() * 300);

  return baseDelay + jitter;
}

async function requestWithRetry(makeRequest) {
  let lastError;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      return await makeRequest();
    } catch (error) {
      lastError = error;

      const retryable =
        shouldRetry(error);

      console.error(
        JSON.stringify({
          event: "llm_request_error",
          attempt,
          status: error?.status || null,
          code:
  error?.code ||
  error?.cause?.code ||
  null,
          retryable
        })
      );

      if (
        !retryable ||
        attempt === MAX_ATTEMPTS
      ) {
        throw error;
      }

      const delay =
        getRetryDelay(attempt);

      console.log(
        JSON.stringify({
          event: "llm_retry",
          attempt,
          next_attempt: attempt + 1,
          delay_ms: delay
        })
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

function logUsage({
  response,
  durationMs,
  repairCount
}) {
  const usage = response?.usage || {};

  console.log(
    JSON.stringify({
      event: "llm_usage",
      prompt_version: PROMPT_VERSION,
      model: process.env.LLM_MODEL,
      input_tokens:
        usage.prompt_tokens ?? null,
      output_tokens:
        usage.completion_tokens ?? null,
      total_tokens:
        usage.total_tokens ?? null,
      duration_ms: durationMs,
      repair_count: repairCount,

      // Local Ollama has no provider API charge
      estimated_cost_usd: 0
    })
  );
}

async function callEnrichmentModel(input) {
  const client = await createClient();
  const systemPrompt =
    loadSystemPrompt();

  const startedAt = Date.now();

  const response =
    await requestWithRetry(() =>
      client.chat.completions.create({
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
      })
    );

  logUsage({
    response,
    durationMs:
      Date.now() - startedAt,
    repairCount: 0
  });

  return response.choices[0].message.content;
}

async function callRepairModel(
  input,
  brokenOutput,
  validationError
) {
  const client = await createClient();
  const systemPrompt =
    loadSystemPrompt();

  const repairMessage = {
    input,
    previous_answer: brokenOutput,
    validation_error: validationError,
    instruction:
      "Your previous answer was rejected for this reason. Return only corrected JSON matching the schema."
  };

  const startedAt = Date.now();

  const response =
    await requestWithRetry(() =>
      client.chat.completions.create({
        model: process.env.LLM_MODEL,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content:
              JSON.stringify(repairMessage)
          }
        ]
      })
    );

  logUsage({
    response,
    durationMs:
      Date.now() - startedAt,
    repairCount: 1
  });

  return response.choices[0].message.content;
}

module.exports = {
  callEnrichmentModel,
  callRepairModel,
  shouldRetry
};
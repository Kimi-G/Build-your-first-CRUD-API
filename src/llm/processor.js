const fs = require("fs");
const path = require("path");

const {
  EnrichOutputSchema
} = require("./schema");

const {
  callEnrichmentModel,
  callRepairModel
} = require("./client");

const PROMPT_VERSION = "enrich-v1";

function extractJsonObject(rawText) {
  if (typeof rawText !== "string") {
    throw new Error("Model output was not text");
  }

  let cleaned = rawText.trim();

  // Remove common Markdown code fences
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // If the model added text before/after JSON,
  // extract from first { to last }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace < firstBrace
  ) {
    throw new Error("No JSON object found in model output");
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function parseAndValidate(rawText) {
  const jsonText = extractJsonObject(rawText);

  let parsed;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `JSON parse failed: ${error.message}`
    );
  }

  const result =
    EnrichOutputSchema.safeParse(parsed);

  if (!result.success) {
    const reasons = result.error.issues
      .map((issue) => {
        const field =
          issue.path.length > 0
            ? issue.path.join(".")
            : "output";

        return `${field}: ${issue.message}`;
      })
      .join("; ");

    throw new Error(
      `Schema validation failed: ${reasons}`
    );
  }

  return result.data;
}

function writeQuarantine({
  input,
  rawOutput,
  repairOutput,
  error
}) {
  const logsDir = path.join(
    __dirname,
    "..",
    "..",
    "logs"
  );

  const quarantineFile = path.join(
    logsDir,
    "quarantine.jsonl"
  );

  fs.mkdirSync(logsDir, {
    recursive: true
  });

  const entry = {
    timestamp: new Date().toISOString(),
    prompt_version: PROMPT_VERSION,
    input,
    raw_model_output: rawOutput,
    repair_model_output: repairOutput,
    error
  };

  fs.appendFileSync(
    quarantineFile,
    JSON.stringify(entry) + "\n",
    "utf8"
  );
}

async function enrichBook(input) {
  const rawOutput =
    await callEnrichmentModel(input);

  try {
    const data =
      parseAndValidate(rawOutput);

    return {
      success: true,
      data,
      repaired: false
    };
  } catch (firstError) {
    // Exactly one repair retry
    const repairOutput =
      await callRepairModel(
        input,
        rawOutput,
        firstError.message
      );

    try {
      const repairedData =
        parseAndValidate(repairOutput);

      return {
        success: true,
        data: repairedData,
        repaired: true
      };
    } catch (secondError) {
      writeQuarantine({
        input,
        rawOutput,
        repairOutput,
        error: secondError.message
      });

      return {
        success: false,
        error:
          "Model output could not be validated after one repair attempt"
      };
    }
  }
}

module.exports = {
  extractJsonObject,
  parseAndValidate,
  enrichBook
};
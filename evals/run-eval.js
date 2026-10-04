const fs = require("fs");
const path = require("path");

const casesPath = path.join(
  __dirname,
  "cases.json"
);

const cases = JSON.parse(
  fs.readFileSync(casesPath, "utf8")
);

const ENDPOINT =
  process.env.EVAL_ENDPOINT ||
  "http://localhost:3000/enrich";

async function run() {
  let matches = 0;
  const results = [];

  console.log(
    `Running ${cases.length} evaluation cases...\n`
  );

  for (const testCase of cases) {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(testCase.input)
      });

      const body = await response.json();

      const actualCategory =
        body.category ?? null;

      const matched =
        response.ok &&
        actualCategory ===
          testCase.expected_category;

      if (matched) {
        matches++;
      }

      results.push({
        id: testCase.id,
        expected:
          testCase.expected_category,
        actual: actualCategory,
        status: response.status,
        matched
      });

      console.log(
        `${matched ? "PASS" : "FAIL"} | ` +
        `${testCase.id} | ` +
        `expected=${testCase.expected_category} | ` +
        `actual=${actualCategory} | ` +
        `status=${response.status}`
      );
    } catch (error) {
      results.push({
        id: testCase.id,
        expected:
          testCase.expected_category,
        actual: null,
        status: null,
        matched: false,
        error: error.message
      });

      console.log(
        `FAIL | ${testCase.id} | ` +
        `request error: ${error.message}`
      );
    }
  }

  const percentage =
    Math.round(
      (matches / cases.length) * 100
    );

  console.log("\n-------------------------");
  console.log(
    `Score: ${matches}/${cases.length} (${percentage}%)`
  );
  console.log(
    "Key field evaluated: category"
  );
  console.log(
    "Prompt version: enrich-v1"
  );
  console.log(
    `Date: ${
      new Date()
        .toISOString()
        .split("T")[0]
    }`
  );
  console.log("-------------------------");

  const outputPath = path.join(
    __dirname,
    "last-run.json"
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        date:
          new Date()
            .toISOString()
            .split("T")[0],
        prompt_version: "enrich-v1",
        score: `${matches}/${cases.length}`,
        percentage,
        key_field: "category",
        results
      },
      null,
      2
    )
  );

  console.log(
    `\nSaved detailed results to ${outputPath}`
  );
}

run().catch((error) => {
  console.error(
    "Evaluation failed:",
    error.message
  );

  process.exitCode = 1;
});
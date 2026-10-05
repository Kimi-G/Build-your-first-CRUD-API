const path = require("path");

const {
  renderReport
} = require("../src/renderReport");

const outputPath = path.join(
  __dirname,
  "..",
  "reports",
  "test.pdf"
);

async function main() {
  await renderReport(outputPath);

  console.log(
    `PDF created: ${outputPath}`
  );
}

main().catch((error) => {
  console.error(
    "PDF generation failed:",
    error.message
  );

  process.exitCode = 1;
});
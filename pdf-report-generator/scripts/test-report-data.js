const {
  getReportData
} = require("../src/reportData");

try {
  const report = getReportData();

  console.log(
    JSON.stringify(report, null, 2)
  );
} catch (error) {
  console.error(
    "Report data test failed:",
    error.message
  );

  process.exitCode = 1;
}

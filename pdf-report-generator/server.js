const express = require("express");
const path = require("path");

const {
  renderReport
} = require("./src/renderReport");

const {
  initializeReportsTable,
  createReportRecord,
  getReportById,
  getReportForDate
} = require("./src/reportStore");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

initializeReportsTable();

let reportGenerationPromise = null;

async function generateAndStoreReport() {
  const reportsDir = path.join(
    __dirname,
    "reports"
  );

  const filename =
    `report-${Date.now()}.pdf`;

  const outputPath = path.join(
    reportsDir,
    filename
  );

  await renderReport(outputPath);

  return createReportRecord(outputPath);
}

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

app.post("/reports", async (req, res) => {
  try {
    const force = req.body?.force === true;

    // Normal requests reuse today's report.
    if (!force) {
      const today =
        new Date().toISOString().slice(0, 10);

      const existingReport =
        getReportForDate(today);

      if (existingReport) {
        return res.status(200).json({
          id: existingReport.id,
          file:
            `/reports/${existingReport.id}/file`
        });
      }

      /*
        If another request is already generating
        today's report, wait for that same work
        instead of generating a duplicate.
      */
      if (reportGenerationPromise) {
        const report =
          await reportGenerationPromise;

        return res.status(200).json({
          id: report.id,
          file:
            `/reports/${report.id}/file`
        });
      }

      reportGenerationPromise =
        generateAndStoreReport();

      try {
        const report =
          await reportGenerationPromise;

        return res.status(201).json({
          id: report.id,
          file:
            `/reports/${report.id}/file`
        });
      } finally {
        reportGenerationPromise = null;
      }
    }

    // force:true always generates a fresh report.
    const report =
      await generateAndStoreReport();

    return res.status(201).json({
      id: report.id,
      file:
        `/reports/${report.id}/file`
    });
  } catch (error) {
    console.error(
      "Report generation failed:",
      error.message
    );

    return res.status(500).json({
      error: "Report generation failed"
    });
  }
});

app.get("/reports/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({
      error: "Report not found"
    });
  }

  const report = getReportById(id);

  if (!report) {
    return res.status(404).json({
      error: "Report not found"
    });
  }

  return res.status(200).json({
    id: report.id,
    created_at: report.created_at,
    file: `/reports/${report.id}/file`
  });
});

app.get("/reports/:id/file", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({
      error: "Report not found"
    });
  }

  const report = getReportById(id);

  if (!report) {
    return res.status(404).json({
      error: "Report not found"
    });
  }

  return res.sendFile(
    path.resolve(report.path),
    (error) => {
      if (error && !res.headersSent) {
        console.error(
          "Report file error:",
          error.message
        );

        res.status(404).json({
          error: "Report file not found"
        });
      }
    }
  );
});

app.listen(PORT, () => {
  console.log(
    `PDF Report Generator API running at http://localhost:${PORT}`
  );
});
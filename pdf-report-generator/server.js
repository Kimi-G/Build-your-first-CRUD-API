const express = require("express");
const path = require("path");

const {
  renderReport
} = require("./src/renderReport");

const {
  initializeReportsTable,
  createReportRecord,
  getReportById
} = require("./src/reportStore");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

initializeReportsTable();

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

app.post("/reports", async (req, res) => {
  try {
    const reportsDir = path.join(
      __dirname,
      "reports"
    );

    /*
      We create the DB record after rendering,
      so use a unique timestamp filename for now.
      Stage 5 will add idempotency.
    */
    const filename =
      `report-${Date.now()}.pdf`;

    const outputPath = path.join(
      reportsDir,
      filename
    );

    await renderReport(outputPath);

    const report =
      createReportRecord(outputPath);

    return res.status(201).json({
      id: report.id,
      file: `/reports/${report.id}/file`
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
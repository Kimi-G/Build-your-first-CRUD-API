const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const {
  getReportData,
  getAllBooks
} = require("./reportData");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(price) {
  return `£${Number(price).toFixed(2)}`;
}

function buildReportHtml(report, books) {
  const today = new Date().toISOString().slice(0, 10);

  const topFiveRows = report.top_5_most_expensive
    .map(
      (book) => `
        <tr>
          <td>${escapeHtml(book.title)}</td>
          <td>${formatPrice(book.price)}</td>
          <td>${book.rating} / 5</td>
        </tr>
      `
    )
    .join("");

  const ratingRows = report.books_per_rating
    .map(
      (row) => `
        <tr>
          <td>${row.rating} star</td>
          <td>${row.count}</td>
        </tr>
      `
    )
    .join("");

  const allBookRows = books
    .map(
      (book) => `
        <tr>
          <td>${book.id}</td>
          <td>
            <a href="${escapeHtml(book.url)}">
              ${escapeHtml(book.title)}
            </a>
          </td>
          <td>${formatPrice(book.price)}</td>
          <td>${book.rating} / 5</td>
        </tr>
      `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />

        <title>Bookstore Report</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
          }

          h1 {
            margin-bottom: 4px;
          }

          h2 {
            margin-top: 28px;
            margin-bottom: 10px;
          }

          .report-date {
            margin-top: 0;
            margin-bottom: 24px;
          }

          .summary {
            display: flex;
            gap: 16px;
            margin-bottom: 24px;
          }

          .summary-card {
            border: 1px solid #ccc;
            padding: 12px;
            min-width: 180px;
          }

          .summary-label {
            font-size: 11px;
          }

          .summary-value {
            font-size: 22px;
            font-weight: bold;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }

          thead {
            display: table-header-group;
          }

          th,
          td {
            border: 1px solid #bbb;
            padding: 7px;
            text-align: left;
            vertical-align: top;
          }

          th {
            font-weight: bold;
          }

          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          a {
            color: inherit;
            text-decoration: none;
          }

          @media print {
            thead {
              display: table-header-group;
            }

            tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>

      <body>
        <h1>Bookstore Report</h1>

        <p class="report-date">
          Generated: ${today}
        </p>

        <div class="summary">
          <div class="summary-card">
            <div class="summary-label">
              Total Books
            </div>

            <div class="summary-value">
              ${report.total_books}
            </div>
          </div>

          <div class="summary-card">
            <div class="summary-label">
              Average Price
            </div>

            <div class="summary-value">
              ${formatPrice(report.average_price)}
            </div>
          </div>
        </div>

        <h2>Top 5 Most Expensive Books</h2>

        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Price</th>
              <th>Rating</th>
            </tr>
          </thead>

          <tbody>
            ${topFiveRows}
          </tbody>
        </table>

        <h2>Books by Rating</h2>

        <table>
          <thead>
            <tr>
              <th>Rating</th>
              <th>Number of Books</th>
            </tr>
          </thead>

          <tbody>
            ${ratingRows}
          </tbody>
        </table>

        <h2>All Books</h2>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Price</th>
              <th>Rating</th>
            </tr>
          </thead>

          <tbody>
            ${allBookRows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

async function renderReport(outputPath) {
  const report = getReportData();
  const books = getAllBooks();

  const html = buildReportHtml(
    report,
    books
  );

  fs.mkdirSync(
    path.dirname(outputPath),
    {
      recursive: true
    }
  );

  const browser = await chromium.launch({
    headless: true
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "load"
    });

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "15mm",
        right: "12mm",
        bottom: "15mm",
        left: "12mm"
      }
    });
  } finally {
    await browser.close();
  }

  return outputPath;
}

module.exports = {
  buildReportHtml,
  renderReport
};
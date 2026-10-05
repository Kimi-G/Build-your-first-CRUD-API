const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const databasePath = path.join(
  __dirname,
  "..",
  "report.db"
);

function openDatabase() {
  return new DatabaseSync(databasePath);
}

function initializeReportsTable() {
  const db = openDatabase();

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
  } finally {
    db.close();
  }
}

function createReportRecord(filePath) {
  const db = openDatabase();

  try {
    const createdAt =
      new Date().toISOString();

    const result = db
      .prepare(`
        INSERT INTO reports (
          path,
          created_at
        )
        VALUES (?, ?)
      `)
      .run(
        filePath,
        createdAt
      );

    return {
      id: Number(result.lastInsertRowid),
      path: filePath,
      created_at: createdAt
    };
  } finally {
    db.close();
  }
}

function getReportById(id) {
  const db = openDatabase();

  try {
    const report = db
      .prepare(`
        SELECT
          id,
          path,
          created_at
        FROM reports
        WHERE id = ?
      `)
      .get(id);

    if (!report) {
      return null;
    }

    return { ...report };
  } finally {
    db.close();
  }
}

module.exports = {
  initializeReportsTable,
  createReportRecord,
  getReportById
};
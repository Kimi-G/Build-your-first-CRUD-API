const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const booksPath = path.join(
  __dirname,
  "..",
  "..",
  "scraper",
  "output",
  "books.json"
);

const databasePath = path.join(
  __dirname,
  "..",
  "report.db"
);

const ratingMap = {
  One: 1,
  Two: 2,
  Three: 3,
  Four: 4,
  Five: 5
};

const books = JSON.parse(
  fs.readFileSync(booksPath, "utf8")
);

const db = new DatabaseSync(databasePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    price REAL NOT NULL,
    rating INTEGER NOT NULL,
    url TEXT NOT NULL
  )
`);

const insertBook = db.prepare(`
  INSERT INTO books (
    title,
    price,
    rating,
    url
  )
  VALUES (?, ?, ?, ?)
`);

try {
  db.exec("BEGIN");

  // Keep the seed script safe to run repeatedly.
  db.exec("DELETE FROM books");

  for (const book of books) {
    const rating = ratingMap[book.rating_text];

    if (!rating) {
      throw new Error(
        `Unknown rating "${book.rating_text}" for "${book.title}"`
      );
    }

    if (
      typeof book.price_gbp !== "number" ||
      !Number.isFinite(book.price_gbp)
    ) {
      throw new Error(
        `Invalid price for "${book.title}"`
      );
    }

    insertBook.run(
      book.title,
      book.price_gbp,
      rating,
      book.product_url
    );
  }

  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  db.close();

  console.error("Seed failed:", error.message);
  process.exit(1);
}

const result = db
  .prepare("SELECT COUNT(*) AS count FROM books")
  .get();

console.log(`Seed complete: ${result.count} books`);

db.close();
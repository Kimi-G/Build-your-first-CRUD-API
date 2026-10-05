const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const databasePath = path.join(
  __dirname,
  "..",
  "report.db"
);

function getReportData() {
  const db = new DatabaseSync(databasePath);

  try {
    const totalBooks = db
      .prepare(`
        SELECT COUNT(*) AS total_books
        FROM books
      `)
      .get();

    const averagePrice = db
      .prepare(`
        SELECT ROUND(AVG(price), 2) AS average_price
        FROM books
      `)
      .get();

    const topFive = db
      .prepare(`
        SELECT
          title,
          price,
          rating,
          url
        FROM books
        ORDER BY price DESC
        LIMIT 5
      `)
      .all();

    const booksPerRating = db
      .prepare(`
        SELECT
          rating,
          COUNT(*) AS count
        FROM books
        GROUP BY rating
        ORDER BY rating DESC
      `)
      .all();

    return {
      total_books: totalBooks.total_books,
      average_price: averagePrice.average_price,
      top_5_most_expensive: topFive.map(
        (book) => ({ ...book })
      ),
      books_per_rating: booksPerRating.map(
        (row) => ({ ...row })
      )
    };
  } finally {
    db.close();
  }
}

function getAllBooks() {
  const db = new DatabaseSync(databasePath);

  try {
    return db
      .prepare(`
        SELECT
          id,
          title,
          price,
          rating,
          url
        FROM books
        ORDER BY id
      `)
      .all()
      .map((book) => ({ ...book }));
  } finally {
    db.close();
  }
}

module.exports = {
  getReportData,
  getAllBooks
};

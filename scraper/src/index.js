const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { z } = require("zod");

const START_URL =
  "https://books.toscrape.com/catalogue/page-1.html";

const CACHE_DIR = path.join(__dirname, "..", "cache");
const BOOK_CACHE_DIR = path.join(CACHE_DIR, "books");
const OUTPUT_DIR = path.join(__dirname, "..", "output");
const BOOKS_FILE = path.join(OUTPUT_DIR, "books.json");
const ERRORS_FILE = path.join(OUTPUT_DIR, "errors.json");

const USER_AGENT =
  "FlyRankInternship-A9/1.0 (+https://github.com/Kimi-G/Build-your-first-CRUD-API)";

const TIMEOUT_MS = 5000;
const REQUEST_DELAY_MS = 500;

let lastRealRequestTime = 0;

const BookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url(),
  price_text: z.string().min(1),
  price_gbp: z.number().finite().nonnegative(),
  availability_text: z.string().min(1),
  rating_text: z.string().min(1),
  description: z.string().nullable(),
  source_page: z.string().url(),
  fetched_at: z.string().datetime()
});

function normalizeRecord(rawRecord) {
  const numericPrice = Number(
    rawRecord.price_text.replace("£", "").trim()
  );

  return {
    ...rawRecord,
    price_gbp: numericPrice
  };
}

function validateRecords(rawRecords) {
  const validRecords = [];
  const errors = [];

  for (const rawRecord of rawRecords) {
    const normalizedRecord = normalizeRecord(rawRecord);

    const result = BookSchema.safeParse(normalizedRecord);

    if (result.success) {
      validRecords.push(result.data);
    } else {
      errors.push({
        product_url: rawRecord.product_url,
        reason: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }
  }

  return {
    validRecords,
    errors
  };
}

function deduplicateByProductUrl(records) {
  const uniqueRecords = new Map();

  for (const record of records) {
    uniqueRecords.set(record.product_url, record);
  }

  return [...uniqueRecords.values()];
}

function writeOutput(validRecords, errors) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  fs.writeFileSync(
    BOOKS_FILE,
    JSON.stringify(validRecords, null, 2),
    "utf8"
  );

  fs.writeFileSync(
    ERRORS_FILE,
    JSON.stringify(errors, null, 2),
    "utf8"
  );
}

// Wait at least 500 ms between real requests
async function waitBeforeRealRequest() {
  const elapsed = Date.now() - lastRealRequestTime;

  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, REQUEST_DELAY_MS - elapsed)
    );
  }
}

// Cache filename for catalogue pages
function getCatalogueCacheFile(pageUrl) {
  const url = new URL(pageUrl);
  const match = url.pathname.match(/page-(\d+)\.html$/);

  if (!match) {
    throw new Error(
      `Could not determine catalogue page number from ${pageUrl}`
    );
  }

  return path.join(
    CACHE_DIR,
    `catalogue-page-${match[1]}.html`
  );
}

// Cache filename for book detail pages
function getBookCacheFile(bookUrl) {
  const url = new URL(bookUrl);

  const parts = url.pathname
    .split("/")
    .filter(Boolean);

  // Example:
  // catalogue/a-light-in-the-attic_1000/index.html
  const bookSlug = parts[parts.length - 2];

  return path.join(
    BOOK_CACHE_DIR,
    `${bookSlug}.html`
  );
}

// Generic fetch/cache helper
async function getPage(url, cacheFile) {
  if (fs.existsSync(cacheFile)) {
    const html = fs.readFileSync(cacheFile, "utf8");

    console.log(`CACHE HIT ${url}`);

    return {
      html,
      fetchedAt: new Date(
        fs.statSync(cacheFile).mtime
      ).toISOString()
    };
  }

  await waitBeforeRealRequest();

  console.log(`FETCH ${url}`);

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT
      },
      signal: controller.signal
    });

    lastRealRequestTime = Date.now();

    if (response.status !== 200) {
      throw new Error(
        `Fetch failed with status ${response.status}: ${url}`
      );
    }

    const html = await response.text();

    fs.mkdirSync(
      path.dirname(cacheFile),
      { recursive: true }
    );

    fs.writeFileSync(
      cacheFile,
      html,
      "utf8"
    );

    console.log(`status=${response.status}`);

    return {
      html,
      fetchedAt: new Date().toISOString()
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Discover 60 unique books and remember which catalogue page
// each book came from
async function discoverBooks() {
  let currentPageUrl = START_URL;
  let cataloguePages = 0;
  let discovered = 0;

  const booksByUrl = new Map();

  while (
    currentPageUrl &&
    cataloguePages < 3
  ) {
    const cacheFile =
      getCatalogueCacheFile(currentPageUrl);

    const { html } = await getPage(
      currentPageUrl,
      cacheFile
    );

    const $ = cheerio.load(html);

    cataloguePages++;

    $("article.product_pod h3 a").each(
      (index, element) => {
        const href =
          $(element).attr("href");

        if (!href) {
          return;
        }

        const productUrl =
          new URL(
            href,
            currentPageUrl
          ).href;

        discovered++;

        // Canonical URL prevents duplicates
        if (!booksByUrl.has(productUrl)) {
          booksByUrl.set(productUrl, {
            product_url: productUrl,
            source_page: currentPageUrl
          });
        }
      }
    );

    const nextHref =
      $("li.next a").attr("href");

    if (
      nextHref &&
      cataloguePages < 3
    ) {
      currentPageUrl =
        new URL(
          nextHref,
          currentPageUrl
        ).href;
    } else {
      currentPageUrl = null;
    }
  }

  console.log(
    `catalogue_pages=${cataloguePages}`
  );
  console.log(
    `discovered=${discovered}`
  );
  console.log(
    `unique_urls=${booksByUrl.size}`
  );

  return [...booksByUrl.values()];
}

// Extract one raw book record
function extractBookRecord(
  html,
  productUrl,
  sourcePage,
  fetchedAt
) {
  const $ = cheerio.load(html);

  const title =
    $("div.product_main h1")
      .first()
      .text()
      .trim();

  const priceText =
    $("div.product_main .price_color")
      .first()
      .text()
      .trim();

  const availabilityText =
    $("div.product_main .availability")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

  const ratingClass =
    $("div.product_main .star-rating")
      .first()
      .attr("class") || "";

  const ratingText =
    ratingClass
      .split(/\s+/)
      .find(
        (className) =>
          className !== "star-rating"
      ) || null;

  // Some books may not have a description
  const descriptionElement =
    $("#product_description")
      .next("p");

  const description =
    descriptionElement.length > 0
      ? descriptionElement
          .text()
          .trim()
      : null;

  return {
    title,
    product_url: productUrl,
    price_text: priceText,
    availability_text:
      availabilityText,
    rating_text: ratingText,
    description,
    source_page: sourcePage,
    fetched_at: fetchedAt
  };
}

// Visit all 60 book pages
async function extractAllBooks(
  discoveredBooks
) {
  const rawRecords = [];

  for (const book of discoveredBooks) {
    const cacheFile =
      getBookCacheFile(
        book.product_url
      );

    const {
      html,
      fetchedAt
    } = await getPage(
      book.product_url,
      cacheFile
    );

    const record =
      extractBookRecord(
        html,
        book.product_url,
        book.source_page,
        fetchedAt
      );

    rawRecords.push(record);
  }

  return rawRecords;
}

async function main() {
  try {
    const discoveredBooks = await discoverBooks();

    const rawRecords = await extractAllBooks(
      discoveredBooks
    );

    console.log(`detail_pages=${rawRecords.length}`);

    const {
      validRecords,
      errors
    } = validateRecords(rawRecords);

    const uniqueValidRecords =
      deduplicateByProductUrl(validRecords);

    writeOutput(uniqueValidRecords, errors);

    console.log(`valid_records=${uniqueValidRecords.length}`);
    console.log(`invalid_records=${errors.length}`);
    console.log(`books_file=${BOOKS_FILE}`);
    console.log(`errors_file=${ERRORS_FILE}`);

    console.log("\nSample validated record:");
    console.log(
      JSON.stringify(uniqueValidRecords[0], null, 2)
    );
  } catch (error) {
    if (error.name === "AbortError") {
      console.error(
        `Request timed out after ${TIMEOUT_MS} ms`
      );
    } else {
      console.error(error.message);
    }

    process.exitCode = 1;
  }
}

main();
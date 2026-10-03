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

const RUN_REPORT_FILE = path.join(
  OUTPUT_DIR,
  "run-report.json"
);

const runStats = {
  startTime: new Date().toISOString(),
  networkRequests: 0,
  pagesFetched: 0,
  cacheHits: 0,
  failedPages: []
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    runStats.cacheHits++;

    console.log(`CACHE HIT ${url}`);

    return {
      html,
      fetchedAt: new Date(
        fs.statSync(cacheFile).mtime
      ).toISOString()
    };
  }

  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await waitBeforeRealRequest();

    console.log(
      `FETCH ${url} attempt=${attempt}`
    );

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, TIMEOUT_MS);

    try {
      runStats.networkRequests++;
      lastRealRequestTime = Date.now();

      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT
        },
        signal: controller.signal
      });

      // Never retry 403 or 404
      if (response.status === 403 || response.status === 404) {
        const error = new Error(
          `Fetch failed with status ${response.status}: ${url}`
        );

        error.status = response.status;
        throw error;
      }

      // Retry server errors once
      if (response.status >= 500 && response.status <= 599) {
        if (attempt < maxAttempts) {
          console.warn(
            `Server error ${response.status}; retrying once...`
          );

          await sleep(1000);
          continue;
        }

        const error = new Error(
          `Fetch failed with status ${response.status}: ${url}`
        );

        error.status = response.status;
        throw error;
      }

      if (response.status !== 200) {
        const error = new Error(
          `Fetch failed with status ${response.status}: ${url}`
        );

        error.status = response.status;
        throw error;
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

      runStats.pagesFetched++;

      console.log(`status=${response.status}`);

      return {
        html,
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      const isTimeout = error.name === "AbortError";

      // Retry timeout once
      if (isTimeout && attempt < maxAttempts) {
        console.warn(
          `Request timed out; retrying once...`
        );

        await sleep(1000);
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
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
async function extractAllBooks(discoveredBooks) {
  const rawRecords = [];

  for (const book of discoveredBooks) {
    try {
      const cacheFile =
        getBookCacheFile(book.product_url);

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
    } catch (error) {
      console.error(
        `SKIPPED ${book.product_url}: ${error.message}`
      );

      runStats.failedPages.push({
        url: book.product_url,
        status: error.status || null,
        reason: error.message
      });
    }
  }

  return rawRecords;
}

function writeRunReport(
  validRecords,
  errors,
  startedAtMs
) {
  const report = {
    start_time: runStats.startTime,
    duration_ms: Date.now() - startedAtMs,
    network_requests: runStats.networkRequests,
    pages_fetched: runStats.pagesFetched,
    cache_hits: runStats.cacheHits,
    valid_records: validRecords.length,
    invalid_records: errors.length,
    failed_pages: runStats.failedPages.length,
    failed_page_details: runStats.failedPages
  };

  fs.mkdirSync(OUTPUT_DIR, {
    recursive: true
  });

  fs.writeFileSync(
    RUN_REPORT_FILE,
    JSON.stringify(report, null, 2),
    "utf8"
  );

  return report;
}

async function main() {
  const startedAtMs = Date.now();

  try {
    const discoveredBooks =
      await discoverBooks();

    if (process.env.INJECT_FAKE_URL === "1") {
      discoveredBooks.push({
        product_url:
          "https://books.toscrape.com/catalogue/definitely-not-a-real-book-stage-5/index.html",
        source_page: START_URL
      });

      console.log(
        "Injected one fake URL for Stage 5 failure test."
      );
    }

    const rawRecords =
      await extractAllBooks(
        discoveredBooks
      );

    console.log(
      `detail_pages=${rawRecords.length}`
    );

    const {
      validRecords,
      errors
    } = validateRecords(rawRecords);

    const uniqueValidRecords =
      deduplicateByProductUrl(
        validRecords
      );

    writeOutput(
      uniqueValidRecords,
      errors
    );

    const report =
      writeRunReport(
        uniqueValidRecords,
        errors,
        startedAtMs
      );

    console.log(
      `valid_records=${uniqueValidRecords.length}`
    );

    console.log(
      `invalid_records=${errors.length}`
    );

    console.log(
      `failed_pages=${runStats.failedPages.length}`
    );

    console.log(
      `cache_hits=${runStats.cacheHits}`
    );

    console.log(
      `pages_fetched=${runStats.pagesFetched}`
    );

    console.log(
      `run_report=${RUN_REPORT_FILE}`
    );

    console.log(
      "\nRun report:"
    );

    console.log(
      JSON.stringify(
        report,
        null,
        2
      )
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

main();
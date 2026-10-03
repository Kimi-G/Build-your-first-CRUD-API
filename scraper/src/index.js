const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const START_URL =
  "https://books.toscrape.com/catalogue/page-1.html";

const CACHE_DIR = path.join(__dirname, "..", "cache");

const USER_AGENT =
  "FlyRankInternship-A9/1.0 (+https://github.com/Kimi-G/Build-your-first-CRUD-API)";

const TIMEOUT_MS = 5000;
const REQUEST_DELAY_MS = 500;

let lastRealRequestTime = 0;

// Wait at least 500 ms between real network requests
async function waitBeforeRealRequest() {
  const elapsed = Date.now() - lastRealRequestTime;

  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, REQUEST_DELAY_MS - elapsed)
    );
  }
}

// Build a cache filename from the catalogue page URL
function getCatalogueCacheFile(pageUrl) {
  const url = new URL(pageUrl);

  const match = url.pathname.match(/page-(\d+)\.html$/);

  if (!match) {
    throw new Error(`Could not determine page number from ${pageUrl}`);
  }

  const pageNumber = match[1];

  return path.join(
    CACHE_DIR,
    `catalogue-page-${pageNumber}.html`
  );
}

// Fetch a catalogue page or read it from cache
async function getCataloguePage(pageUrl) {
  const cacheFile = getCatalogueCacheFile(pageUrl);

  if (fs.existsSync(cacheFile)) {
    const html = fs.readFileSync(cacheFile, "utf8");
    const size = Buffer.byteLength(html, "utf8");

    console.log(`CACHE HIT ${pageUrl}`);
    console.log(`response_size=${size} bytes`);

    return html;
  }

  await waitBeforeRealRequest();

  console.log(`FETCH ${pageUrl}`);

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": USER_AGENT
      },
      signal: controller.signal
    });

    lastRealRequestTime = Date.now();

    if (response.status !== 200) {
      throw new Error(
        `Fetch failed with status ${response.status}`
      );
    }

    const html = await response.text();

    fs.mkdirSync(CACHE_DIR, { recursive: true });

    fs.writeFileSync(cacheFile, html, "utf8");

    const size = Buffer.byteLength(html, "utf8");

    console.log(`status=${response.status}`);
    console.log(`response_size=${size} bytes`);
    console.log(`cached=${cacheFile}`);

    return html;
  } finally {
    clearTimeout(timeout);
  }
}

// Discover book URLs from the first 3 catalogue pages
async function discoverBookUrls() {
  let currentPageUrl = START_URL;

  let cataloguePages = 0;
  let discovered = 0;

  const uniqueBookUrls = new Set();

  while (currentPageUrl && cataloguePages < 3) {
    const html = await getCataloguePage(currentPageUrl);

    const $ = cheerio.load(html);

    cataloguePages++;

    // Collect book links
    $("article.product_pod h3 a").each(
      (index, element) => {
        const href = $(element).attr("href");

        if (!href) {
          return;
        }

        const absoluteUrl = new URL(
          href,
          currentPageUrl
        ).href;

        discovered++;
        uniqueBookUrls.add(absoluteUrl);
      }
    );

    // Follow the site's own Next link
    const nextHref = $("li.next a").attr("href");

    if (nextHref && cataloguePages < 3) {
      currentPageUrl = new URL(
        nextHref,
        currentPageUrl
      ).href;
    } else {
      currentPageUrl = null;
    }
  }

  console.log(`catalogue_pages=${cataloguePages}`);
  console.log(`discovered=${discovered}`);
  console.log(`unique_urls=${uniqueBookUrls.size}`);

  return [...uniqueBookUrls];
}

async function main() {
  try {
    await discoverBookUrls();
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
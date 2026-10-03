const fs = require("fs");
const path = require("path");

const PAGE_URL = "https://books.toscrape.com/catalogue/page-1.html";

const CACHE_DIR = path.join(__dirname, "..", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "catalogue-page-1.html");

const USER_AGENT =
  "FlyRankInternship-A9/1.0 (+https://github.com/Kimi-G/Build-your-first-CRUD-API)";

const TIMEOUT_MS = 5000;

async function getCataloguePage() {
  // Use the cached copy if it already exists
  if (fs.existsSync(CACHE_FILE)) {
    const html = fs.readFileSync(CACHE_FILE, "utf8");
    const size = Buffer.byteLength(html, "utf8");

    console.log(`CACHE HIT ${PAGE_URL}`);
    console.log(`response_size=${size} bytes`);

    return html;
  }

  console.log(`FETCH ${PAGE_URL}`);

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const response = await fetch(PAGE_URL, {
      headers: {
        "User-Agent": USER_AGENT
      },
      signal: controller.signal
    });

    // Only 200 is treated as a successful page fetch
    if (response.status !== 200) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const html = await response.text();

    // Create cache directory if it does not exist
    fs.mkdirSync(CACHE_DIR, { recursive: true });

    // Save the HTML for later development runs
    fs.writeFileSync(CACHE_FILE, html, "utf8");

    const size = Buffer.byteLength(html, "utf8");

    console.log(`status=${response.status}`);
    console.log(`response_size=${size} bytes`);
    console.log(`cached=${CACHE_FILE}`);

    return html;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  try {
    await getCataloguePage();
  } catch (error) {
    if (error.name === "AbortError") {
      console.error(`Request timed out after ${TIMEOUT_MS} ms`);
    } else {
      console.error(error.message);
    }

    process.exitCode = 1;
  }
}

main();
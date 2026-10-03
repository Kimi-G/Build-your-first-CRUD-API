# The Polite Scraper

A Node.js scraping pipeline that collects structured book data from the Books to Scrape practice sandbox.

The scraper processes exactly the first three catalogue pages, discovers 60 unique books, caches fetched HTML, extracts raw fields, normalizes prices, validates records with Zod, survives individual page failures, and writes an honest run report.

## Target Classification

**Target:** https://books.toscrape.com/

**Classification:** Books to Scrape is a public web-scraping sandbox created for learning and testing scraping tools.

**Scope:** Only the first 3 catalogue pages are processed, containing 60 books.

**Data collected:** title, product URL, price, availability, rating, description, source catalogue page, and fetch timestamp.

**robots.txt result:** No robots file found. A request to `https://books.toscrape.com/robots.txt` returned `404 Not Found`. A missing robots file is not treated as permission; this project uses Books to Scrape because it is explicitly provided as a scraping practice sandbox.

I will not reuse this code on another site without checking its rules and terms first.

## JavaScript Lane

This project uses:

- Node.js
- Built-in `fetch`
- Cheerio for HTML parsing
- Zod for schema validation
- Node.js `fs` for JSON output

## Installation

Install dependencies:

```bash
npm install
```

## Run the Scraper

```bash
npm run scrape
```

The scraper writes:

```text
scraper/output/books.json
scraper/output/errors.json
scraper/output/run-report.json
```

## Pipeline

```text
Classify
→ Fetch
→ Cache
→ Extract
→ Normalize
→ Validate
→ Store
→ Report
```

## Record Schema

Each validated book record contains:

| Field | Type | Description |
| --- | --- | --- |
| `title` | string | Book title |
| `product_url` | HTTPS URL | Canonical identity of the book |
| `price_text` | string | Original scraped price such as `£51.77` |
| `price_gbp` | number | Normalized numeric price |
| `availability_text` | string | Availability text from the page |
| `rating_text` | string | Rating such as `Three` |
| `description` | string or null | Book description when available |
| `source_page` | HTTPS URL | Catalogue page where the book was discovered |
| `fetched_at` | ISO timestamp | Time the detail page was fetched |

Invalid records are excluded from `books.json` and written to `errors.json` with a validation reason.

## Politeness Rules

Every real HTTP request:

- sends an identifying User-Agent
- uses a 5-second timeout
- checks the HTTP status before parsing
- waits at least 500 ms between real requests
- is cached locally so development runs do not repeatedly request the same page

Cached pages do not require a delay because no network request is made.

A timeout or `5xx` response is retried once. `403` and `404` responses are not retried.

## Caching and Idempotency

Fetched HTML is stored under `scraper/cache/`, which is excluded from Git.

A second run reads primarily from the cache.

`product_url` is used as the canonical identity for a record, and `books.json` is rewritten rather than appended. Therefore repeated runs still produce exactly 60 unique records instead of creating duplicates.

## Failure Handling

Each book page is processed independently. A failed detail page is logged and skipped so one broken page does not terminate the entire run.

For the Stage 5 test, one deliberately fake book URL returned `404`. The scraper still completed with all 60 real records and reported one failed page.

## Example Failure-Test Run Report

The following real report was produced during the Stage 5 failure-handling test, where one deliberately invalid book URL was injected. The scraper still preserved all 60 valid records and reported one failed page.

```json
{
  "start_time": "2026-10-03T19:31:43.274Z",
  "duration_ms": 1620,
  "network_requests": 1,
  "pages_fetched": 0,
  "cache_hits": 63,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 1,
  "failed_page_details": [
    {
      "url": "https://books.toscrape.com/catalogue/definitely-not-a-real-book-stage-5/index.html",
      "status": 404,
      "reason": "Fetch failed with status 404: https://books.toscrape.com/catalogue/definitely-not-a-real-book-stage-5/index.html"
    }
  ]
}
```
## Why No Browser Is Needed

The data required by this assignment is already present in the HTML returned by the server, so using a browser automation tool would add additional time, memory, and complexity without providing useful data for the core scraper.

## Ethics

When an official API exists, it should generally be preferred over scraping. I would not use this scraper to bypass authentication, paywalls, access controls, or blocking mechanisms. I would also limit collection to the data actually required for the task and check a site's rules and terms before automating it.

## Limitation

This scraper depends on the current HTML structure and CSS selectors used by Books to Scrape. If the site's markup changes, the selectors may need to be updated even though the underlying information still exists.
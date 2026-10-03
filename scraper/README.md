# The Polite Scraper

A Node.js scraping project for the FlyRank Backend Track. This project collects structured book data from the Books to Scrape practice sandbox while following polite fetching, caching, validation, and failure-handling practices.

## Target Classification

**Target:** https://books.toscrape.com/

**Classification:** Books to Scrape is a public web-scraping sandbox created for learning and testing scraping tools. The parent ToScrape site explicitly describes it as a safe practice environment for beginners and developers validating scraping technology.

**Scope:** This project will process only the first 3 catalogue pages, which contain 60 books in total.

**Data collected:** For each book, the scraper will eventually collect the title, product URL, price, availability, rating, description, source catalogue page, and fetch timestamp.

**Why this is appropriate:** The target is explicitly provided as a scraping sandbox, the collection scope is small and predetermined, and the project will use polite request behavior rather than attempting to bypass authentication, access controls, or other restrictions.

**robots.txt result:**  No robots file found. A request to `https://books.toscrape.com/robots.txt` returned `404 Not Found`. A missing robots file is not treated as permission; this project is limited to Books to Scrape because it is explicitly provided as a scraping practice sandbox.

I will not reuse this code on another site without checking its rules and terms first.
# PDF Report Generator

FlyRank Backend Track — Assignment A8.

This project will query book data from SQLite, render the data into PDF reports using Playwright, store generated reports on disk, and serve them through API links.

## Run

Install dependencies:

```bash
npm install

## Stage 4 Observation

PDF generation currently runs inside the request, which is acceptable for a small report, but I would move it to a background job once generation becomes slow enough to make users wait several seconds or when many reports may be requested concurrently.
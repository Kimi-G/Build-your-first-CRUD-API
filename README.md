# Task API with Authentication

A Node.js and Express REST API that provides SQLite-backed CRUD operations, Supabase authentication, and LLM-powered book enrichment.

The API supports task management, user signup and login, JWT verification, reusable authentication middleware, protected routes, Swagger UI documentation with Bearer authentication, and a narrow AI endpoint that enriches scraped book records using a locally hosted Ollama model.

## Features

- Create tasks
- Read all tasks
- Read a single task by ID
- Update tasks
- Delete tasks
- Input validation
- Swagger UI documentation
- Persistent SQLite storage
- Supabase authentication
- JWT-protected routes
- Reusable authentication middleware
- Swagger Bearer authentication
- LLM-powered book enrichment
- Strict structured-output validation with Zod
- One-attempt LLM output repair
- Failed-output quarantine logging
- LLM request timeout and retry controls
- LLM emergency kill switch
- Structured token and usage logging
- Automated 8-case LLM evaluation

## Installation

Install dependencies:

```bash
npm install
```

## Run the Server

```bash
node server.js
```

The API runs at:

```text
http://localhost:3000
```

## Swagger UI

Interactive API documentation is available at:

```text
http://localhost:3000/docs
```

## Swagger Authentication

Swagger UI supports Bearer authentication for protected routes.

Use the **Authorize** button to provide a valid Supabase access token.

![Swagger UI with Bearer Authentication](docs/swagger-auth.png)

## Environment Setup

Create a `.env` file in the project root using `.env.example` as a template.

Example:

```env
SUPABASE_URL=your_project_url
SUPABASE_KEY=your_publishable_or_anon_key
PORT=3000

LLM_BASE_URL=http://localhost:11434/v1/
LLM_API_KEY=ollama
LLM_MODEL=gemma3:1b
LLM_STUB=0
LLM_ENABLED=true
```

The real `.env` file is excluded from Git and must never be committed.

For this practice project, email confirmation is disabled in Supabase so newly registered users can log in immediately.

### LLM Environment Variables

| Variable | Purpose |
| --- | --- |
| `LLM_BASE_URL` | OpenAI-compatible LLM API base URL |
| `LLM_API_KEY` | API key required by the configured provider |
| `LLM_MODEL` | Model name used for enrichment |
| `LLM_STUB` | Set to `1` to return deterministic stub responses without calling the model |
| `LLM_ENABLED` | Set to `false` to immediately disable the LLM feature |

The current configuration uses Ollama locally with `gemma3:1b`.

Because the application uses an OpenAI-compatible client, another compatible provider can be substituted by changing the environment variables rather than hard-coding a provider in the application.

## Authentication Flow

1. Create an account with `POST /auth/signup`.
2. Log in with `POST /auth/login`.
3. Copy the returned `access_token`.
4. Send the token to protected routes using:

```text
Authorization: Bearer <access_token>
```

5. The API verifies the access token with Supabase before allowing access to protected routes.

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/` | API information |
| GET | `/health` | Health check |
| GET | `/tasks` | Get all tasks |
| GET | `/tasks/:id` | Get a task by ID |
| POST | `/tasks` | Create a new task |
| PUT | `/tasks/:id` | Update a task |
| DELETE | `/tasks/:id` | Delete a task |
| POST | `/enrich` | Enrich one book record using the configured LLM |

## Authentication API

| Method | Endpoint | Description | Authentication |
| --- | --- | --- | --- |
| POST | `/auth/signup` | Create a new user account | No |
| POST | `/auth/login` | Log in and receive access and refresh tokens | No |
| POST | `/auth/logout` | Log out the authenticated user | Bearer token |
| GET | `/protected/profile` | Get authenticated user profile | Bearer token |
| GET | `/public/info` | Get public information | No |
| GET | `/protected/dashboard` | Example second protected route | Bearer token |

## Authentication Status Codes

| Status | Meaning |
| --- | --- |
| `200` | Successful login or protected read |
| `201` | User successfully created |
| `204` | Successful logout |
| `400` | Missing or invalid request body |
| `401` | Missing, malformed, invalid, or expired access token |

## Task API Example

```bash
curl -i http://localhost:3000/tasks/1
```

Example output:

```text
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Learn Express","done":false}
```

## Data Storage

This project uses SQLite for persistent task storage.

SQLite was chosen because it is lightweight, requires no separate database server, stores data in a single file, and allows task data to survive application restarts.

The database is stored locally in:

```text
tasks.db
```

The database file and the `tasks` table are created automatically when the application starts if they do not already exist.

Three example tasks are inserted only when the `tasks` table is empty. This prevents seed data from being duplicated when the server restarts.

The `tasks.db` file is excluded from Git using `.gitignore`.

When the repository is cloned and the application is started, a new database is created automatically.

## Database Screenshot

The SQLite database can be inspected using DB Browser for SQLite.

![SQLite Database in DB Browser](docs/sqlite-db-browser.png)

## SQLite Query Example

During the database exploration, I ran:

```sql
SELECT * FROM tasks WHERE done = 1;
```

This query returned all completed tasks, demonstrating how SQL can filter rows directly in the SQLite database.

# LLM Book Enrichment

The `POST /enrich` endpoint uses an LLM to enrich one scraped book record at a time.

It accepts a book title and optional description, then returns a fixed JSON structure containing:

- category
- short summary
- confidence score
- quality flags

The endpoint is intentionally narrow rather than conversational.

Model output is treated as untrusted data. It is parsed, validated with Zod, repaired at most once if invalid, and quarantined if it still fails validation.

The complete behavior contract is documented in:

```text
JOB-CARD.md
```

The versioned prompt is stored in:

```text
prompts/enrich-v1.md
```

## Book Enrichment Request

```bash
curl -i -X POST http://localhost:3000/enrich \
-H "Content-Type: application/json" \
-d '{"title":"A Light in the Attic","description":"A collection of poems and drawings for readers of different ages."}'
```

Example response:

```json
{
  "category": "poetry",
  "summary": "A collection of poems and drawings for readers of different ages.",
  "confidence": 0.9,
  "quality_flags": []
}
```

## Book Enrichment Input

```json
{
  "title": "string, 1-200 characters",
  "description": "string or null, maximum 4000 characters"
}
```

## Book Enrichment Output

```json
{
  "category": "fiction | nonfiction | poetry | children | other",
  "summary": "one short sentence",
  "confidence": "number from 0 to 1",
  "quality_flags": [
    "missing_description | ambiguous_category | possible_prompt_injection"
  ]
}
```

Allowed categories are:

- `fiction`
- `nonfiction`
- `poetry`
- `children`
- `other`

Allowed quality flags are:

- `missing_description`
- `ambiguous_category`
- `possible_prompt_injection`

## Invalid Book Enrichment Request

Example of a request with a missing required `title`:

```bash
curl -i -X POST http://localhost:3000/enrich \
-H "Content-Type: application/json" \
-d '{"description":"Some description"}'
```

The endpoint returns `400 Bad Request` and identifies the invalid field before making any LLM call.

## Stub Mode

When:

```env
LLM_STUB=1
```

the endpoint validates the request and response contract without calling the model.

This allows the API contract to be tested independently of the LLM provider.

## Provider and Model

Current provider:

- Ollama running locally
- Model: `gemma3:1b`
- Prompt version: `enrich-v1`

The application uses an OpenAI-compatible client.

A different compatible provider can be substituted by changing:

- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`

Secrets and local provider configuration belong in `.env`.

The repository contains only `.env.example`.

## Prompt Safety

Trusted instructions are loaded from:

```text
prompts/enrich-v1.md
```

Book titles and descriptions are sent separately as user content rather than being concatenated into the system prompt.

The prompt instructs the model not to follow instructions embedded inside book data.

Possible prompt-injection attempts can be reported using:

```text
possible_prompt_injection
```

## Reliability Controls

The LLM integration includes:

- Zod input validation before any model call
- strict Zod validation of model output
- Markdown/code-fence removal before JSON parsing
- exact JSON parsing before API output
- exactly one repair attempt for invalid model output
- quarantine logging after a second validation failure
- 30-second model request timeout
- bounded retry behavior
- exponential backoff
- retry jitter
- retries for transient connection failures
- retries for HTTP `429`
- retries for HTTP `5xx`
- no retries for HTTP `400`
- no retries for HTTP `401`
- no retries for HTTP `403`
- emergency `LLM_ENABLED=false` kill switch
- structured token and usage logging

Raw model output is never returned directly to the API caller after validation was introduced.

## Repair and Quarantine

Model responses are parsed and validated against the expected Zod schema.

The flow is:

```text
Model response
    ↓
Extract JSON
    ↓
Parse JSON
    ↓
Validate with Zod
    ↓
Valid → return structured response
    ↓
Invalid → repair exactly once
    ↓
Validate repaired response
    ↓
Valid → return structured response
    ↓
Invalid → return 422 and quarantine failure
```

Quarantine entries are written locally to:

```text
logs/quarantine.jsonl
```

The runtime quarantine log is excluded from Git because it may contain user input and raw model output.

## Retry Policy

Retryable failures include:

- connection failures
- request timeouts
- HTTP `429`
- HTTP `5xx`

Non-retryable failures include:

- HTTP `400`
- HTTP `401`
- HTTP `403`

Transient failures use bounded retries with exponential backoff and jitter.

A simulated `401` provider test confirmed that authentication errors stop after the first request.

A simulated connection failure confirmed three total attempts with two retries.

## Kill Switch

The LLM feature can be disabled immediately with:

```env
LLM_ENABLED=false
```

When disabled, `/enrich` returns:

```text
503 Service Unavailable
```

without making a model request.

## Structured Usage Logging

Each successful model call produces a structured usage event.

Example:

```json
{
  "event": "llm_usage",
  "prompt_version": "enrich-v1",
  "model": "gemma3:1b",
  "input_tokens": 701,
  "output_tokens": 53,
  "total_tokens": 754,
  "duration_ms": 12336,
  "repair_count": 0,
  "estimated_cost_usd": 0
}
```

## Stage 2 Model Observations

Three real requests were manually tested against the local `gemma3:1b` model using `prompts/enrich-v1.md`.

Observations:

- A normal poetry example was classified correctly as `poetry`, but the model initially added `missing_description` even though a description was provided.
- A record with no description returned `other` with low confidence, but initially omitted the expected `ambiguous_category` flag.
- A prompt-injection-style input was handled correctly: the model ignored the embedded instruction, returned structured output, and included `possible_prompt_injection`.

These results demonstrate why model output must be treated as untrusted input and validated before it is returned by the API.

# LLM Evaluation

An 8-case hand-labelled evaluation set is stored in:

```text
evals/cases.json
```

Run the evaluation with:

```bash
node evals/run-eval.js
```

The evaluation checks the key classification field:

```text
category
```

The evaluation includes:

- fiction examples
- nonfiction examples
- poetry
- children's content
- an uncertain record with no description
- a prompt-injection-style input

## Evaluation Result

- Date: `2026-10-04`
- Prompt version: `enrich-v1`
- Model: `gemma3:1b`
- Key field evaluated: `category`
- Score: **8/8 (100%)**

Detailed results from the run are stored in:

```text
evals/last-run.json
```

# Usage and Cost

A real local model call produced a usage log similar to:

```json
{
  "event": "llm_usage",
  "prompt_version": "enrich-v1",
  "model": "gemma3:1b",
  "input_tokens": 701,
  "output_tokens": 53,
  "total_tokens": 754,
  "duration_ms": 12336,
  "repair_count": 0,
  "estimated_cost_usd": 0
}
```

Because the current model runs locally through Ollama, there is no per-token provider API charge.

Estimated provider API cost for 10,000 requests per day:

```text
$0/day
```

This estimate excludes:

- local hardware costs
- electricity
- maintenance
- hosting or infrastructure costs

# What I Would Improve With Another Day

I would add semantic validation between the original input and the returned `quality_flags`.

During manual testing, the model occasionally returned `missing_description` even when a description was supplied.

The current Zod schema correctly verifies that `missing_description` is an allowed flag, but structural validation alone cannot determine whether the flag is logically consistent with the original request.

A deterministic post-model rule could verify conditions such as:

```text
description exists
→ missing_description must not be present
```

This would reduce reliance on the model for rules that can be enforced reliably in application code.

# Technologies

- Node.js
- Express
- SQLite
- better-sqlite3
- Supabase Auth
- `@supabase/supabase-js`
- Zod
- OpenAI-compatible JavaScript SDK
- Ollama
- Gemma 3 1B
- dotenv
- Swagger UI
- OpenAPI
- Git
- GitHub
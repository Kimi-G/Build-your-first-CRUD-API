# Build Your First CRUD API

A simple in-memory CRUD API built with Node.js and Express.

## Features

- Create tasks
- Read all tasks
- Read a single task by ID
- Update tasks
- Delete tasks
- Input validation
- Swagger UI documentation
- In-memory storage

## Installation

Clone the repository and install dependencies:

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

The API can be tested interactively using Swagger UI at:

```text
http://localhost:3000/docs
```

![Swagger UI](docs/swagger-ui.png)

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

## Example Request

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

This project uses in-memory storage. Tasks are stored in a JavaScript array and are reset when the server restarts.

## Technologies

- Node.js
- Express
- Swagger UI
- OpenAPI
- Git
- GitHub
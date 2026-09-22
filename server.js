require("dotenv").config();

const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./openapi.json");
const Database = require("better-sqlite3");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Open or create the SQLite database
const db = new Database("tasks.db");

// Create the tasks table if it does not exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )
`).run();

// Seed example tasks only if the table is empty
const row = db.prepare("SELECT COUNT(*) AS count FROM tasks").get();

if (row.count === 0) {
  const insert = db.prepare(
    "INSERT INTO tasks (title, done) VALUES (?, ?)"
  );

  insert.run("Learn Express", 0);
  insert.run("Build CRUD API", 0);
  insert.run("Test API", 1);

  console.log("Seeded 3 example tasks.");
}

app.get("/", (req, res) => {
  res.json({
    name: "Task API",
    version: "1.0",
    endpoints: ["/tasks"]
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

// Get all tasks from the database
app.get("/tasks", (req, res) => {
  const tasks = db.prepare("SELECT * FROM tasks").all();

  const formattedTasks = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    done: Boolean(task.done)
  }));

  res.status(200).json(formattedTasks);
});

// Get one task by ID from the database
app.get("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);

  const task = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(id);

  if (!task) {
    return res.status(404).json({
      error: "Task not found"
    });
  }

  res.status(200).json({
    id: task.id,
    title: task.title,
    done: Boolean(task.done)
  });
});

// Create a new task in the database
app.post("/tasks", (req, res) => {
  const { title } = req.body;

  // Validate title
  if (
    title === undefined ||
    typeof title !== "string" ||
    title.trim() === ""
  ) {
    return res.status(400).json({
      error: "Title is required"
    });
  }

  // Insert the task into SQLite
  const result = db
    .prepare("INSERT INTO tasks (title, done) VALUES (?, ?)")
    .run(title.trim(), 0);

  // Retrieve the newly created task
  const newTask = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(result.lastInsertRowid);

  // Return the task using the same response shape as Assignment 1
  res.status(201).json({
    id: newTask.id,
    title: newTask.title,
    done: Boolean(newTask.done)
  });
});

// Update a task in the database
app.put("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);

  // Check whether the task exists
  const existingTask = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(id);

  if (!existingTask) {
    return res.status(404).json({
      error: "Task not found"
    });
  }

  const { title, done } = req.body;

  // Validate title
  if (
    title === undefined ||
    typeof title !== "string" ||
    title.trim() === ""
  ) {
    return res.status(400).json({
      error: "Title is required"
    });
  }

  // Validate done if provided
  if (done !== undefined && typeof done !== "boolean") {
    return res.status(400).json({
      error: "Done must be true or false"
    });
  }

  // Keep the existing done value if none was provided
  const updatedDone =
    done !== undefined ? (done ? 1 : 0) : existingTask.done;

  // Update the task using a parameterized SQL query
  db.prepare(
    "UPDATE tasks SET title = ?, done = ? WHERE id = ?"
  ).run(title.trim(), updatedDone, id);

  // Read the updated task
  const updatedTask = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(id);

  res.status(200).json({
    id: updatedTask.id,
    title: updatedTask.title,
    done: Boolean(updatedTask.done)
  });
});

// Delete a task from the database
app.delete("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);

  const result = db
    .prepare("DELETE FROM tasks WHERE id = ?")
    .run(id);

  if (result.changes === 0) {
    return res.status(404).json({
      error: "Task not found"
    });
  }

  res.status(204).send();
});

// Sign up a new user
app.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      error: "Email and password are required"
    });
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password
  });

  if (error) {
    return res.status(400).json({
      error: error.message
    });
  }

  return res.status(201).json({
    user: data.user
  });
});

// Log in an existing user
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      error: "Email and password are required"
    });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });

  if (error) {
    return res.status(401).json({
      error: "Invalid login credentials"
    });
  }

  return res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Supabase client initialized.");
});
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./openapi.json");


const app = express();
const PORT = 3000;

app.use(express.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// In-memory task list
const tasks = [
  { id: 1, title: "Learn Express", done: false },
  { id: 2, title: "Build CRUD API", done: false },
  { id: 3, title: "Test API", done: true }
];

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

// Get all tasks
app.get("/tasks", (req, res) => {
  res.json(tasks);
});

// Get one task by ID
app.get("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);

  const task = tasks.find((task) => task.id === id);

  if (!task) {
    return res.status(404).json({
      error: `Task ${id} not found`
    });
  }

  res.json(task);
});

// Create a new task
app.post("/tasks", (req, res) => {
  const { title } = req.body;

  // Validate title
  if (!title || title.trim() === "") {
    return res.status(400).json({
      error: "Title is required"
    });
  }

  // Find the next available ID
  const nextId =
    tasks.length > 0
      ? Math.max(...tasks.map((task) => task.id)) + 1
      : 1;

  const newTask = {
    id: nextId,
    title: title.trim(),
    done: false
  };

  tasks.push(newTask);

  res.status(201).json(newTask);
});


// Update a task
app.put("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);

  const task = tasks.find((task) => task.id === id);

  // Check whether the task exists
  if (!task) {
    return res.status(404).json({
      error: `Task ${id} not found`
    });
  }

  const { title, done } = req.body;

  // Title is required and cannot be empty
  if (
    title === undefined ||
    typeof title !== "string" ||
    title.trim() === ""
  ) {
    return res.status(400).json({
      error: "Title is required"
    });
  }

  // If done is provided, it must be a boolean
  if (done !== undefined && typeof done !== "boolean") {
    return res.status(400).json({
      error: "Done must be true or false"
    });
  }

  // Update the task
  task.title = title.trim();

  if (done !== undefined) {
    task.done = done;
  }

  // Return the updated task
  res.status(200).json(task);
});

// Delete a task
app.delete("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);

  const index = tasks.findIndex((task) => task.id === id);

  if (index === -1) {
    return res.status(404).json({
      error: `Task ${id} not found`
    });
  }

  tasks.splice(index, 1);

  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
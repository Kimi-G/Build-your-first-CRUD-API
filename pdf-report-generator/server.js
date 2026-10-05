const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

app.listen(PORT, () => {
  console.log(
    `PDF Report Generator API running at http://localhost:${PORT}`
  );
});
import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2";

const app = express();
const PORT = 5000;

app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect(err => {
  if (err) console.error("DB connection failed:", err);
  else console.log("Connected to MySQL");
});

// 1. GET /
app.get("/", (req, res) => {
  res.send("Backend is running...");
});

// 2. GET all users
app.get("/users", (req, res) => {
  db.query("SELECT * FROM users", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 3. POST create user
app.post("/users", (req, res) => {
  const { name, email } = req.body;
  db.query(
    "INSERT INTO users (name, email) VALUES (?, ?)",
    [name, email],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: result.insertId, name, email });
    }
  );
});

// 4. POST create post + fanout notifications
app.post("/posts", (req, res) => {
  const { authorId, content } = req.body;
  db.query(
    "INSERT INTO posts (author_id, content) VALUES (?, ?)",
    [authorId, content],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      const postId = result.insertId;

      // fanout to all other users
      db.query(
        "INSERT INTO feeds (user_id, post_id) SELECT id, ? FROM users WHERE id != ?",
        [postId, authorId],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.status(201).json({ postId });
        }
      );
    }
  );
});

// 5. GET notifications for a user
app.get("/feeds/:userId", (req, res) => {
  const { userId } = req.params;
  db.query(
    `SELECT f.id AS feedId, p.content, u.name AS author
     FROM feeds f
     JOIN posts p ON f.post_id = p.id
     JOIN users u ON p.author_id = u.id
     WHERE f.user_id = ? AND f.seen = FALSE`,
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// 6. Mark notification as seen
app.post("/feeds/:feedId/seen", (req, res) => {
  const { feedId } = req.params;
  db.query(
    "UPDATE feeds SET seen = TRUE WHERE id = ?",
    [feedId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Marked as seen" });
    }
  );
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

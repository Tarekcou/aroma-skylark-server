const express = require("express");
const router = express.Router();
const connectDB = require("../db");
const { ObjectId } = require("mongodb"); // Add this at the top if not already

// POST: Create new book
router.post("/books", async (req, res) => {
  try {
    const db = await connectDB();
    const { name } = req.body;

    const newBook = {
      name,
      entries: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("books").insertOne(newBook);
    res.status(201).json({ success: true, data: result.ops?.[0] || newBook });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ success: false, message: "Failed to create book" });
  }
});

// GET: All books
// GET /api/books
router.get("/", async (req, res) => {
  try {
    const db = await connectDB();
    const books = await db
      .collection("books")
      .find()
      .sort({ updatedAt: -1 })
      .toArray();

    // ✅ Return only the array
    res.status(200).json(books);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch books" });
  }
});

// PUT update book
router.put("/:id", async (req, res) => {
  try {
    const db = await connectDB();
    const { name } = req.body;

    const result = await db.collection("books").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { name, updatedAt: new Date() } }
    );

    res.json({ success: true, message: "Updated", result });
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ success: false, message: "Update failed" });
  }
});

// DELETE book
router.delete("/:id", async (req, res) => {
  try {
    const db = await connectDB();
    const result = await db.collection("books").deleteOne({
      _id: new ObjectId(req.params.id),
    });

    res.json({ success: true, message: "Deleted", result });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

module.exports = router;

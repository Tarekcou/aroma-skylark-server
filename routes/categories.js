const express = require("express");
const router = express.Router();
const connectDB = require("../db");

router.post("/categories", async (req, res) => {
    const { bookName } = req.params;
    

  try {
    const db = await connectDB();
    const { name } = req.body;
    const result = await db
      .collection(`categories`)
      .insertOne({ name });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: "Category add failed" });
  }
});

router.get("/categories", async (req, res) => {
    const { bookName } = req.params;

  try {
    const db = await connectDB();
    const cats = await db.collection(`categories`).find().toArray();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

module.exports = router;

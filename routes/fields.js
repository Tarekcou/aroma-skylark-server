const express = require("express");
const router = express.Router();
const connectDB = require("../db");

router.post("/fields", async (req, res) => {
    const { bookName } = req.params;

  try {
    const db = await connectDB();
    const { name } = req.body;
    const result = await db
      .collection(`fields`)
      .insertOne({ name });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: "Field add failed" });
  }
});

router.get("/fields", async (req, res) => {
    const { bookName } = req.params;

  try {
    const db = await connectDB();
    const fields = await db
      .collection(`fields`)
      .find()
      .toArray();
    res.json(fields);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch fields" });
  }
});

module.exports = router;

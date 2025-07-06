const express = require("express");
const { ObjectId } = require("mongodb");
const connectDB = require("../db");
const router = express.Router();

// POST: Add entry to bookName collection
router.post("/:bookName/entries", async (req, res) => {
  const { bookName } = req.params;
  console.log("Adding entry to:", bookName);
  try {
    const db = await connectDB();
    const {
      date,
      time,
      amount,
      contact,
      remarks,
      category,
      mode,
      extraField,
      type,
      createdAt,
    } = req.body;

    const entry = {
      date,
      time,
      amount: parseFloat(amount),
      contact,
      remarks,
      category,
      mode,
      extraField,
      type,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
    };

    const result = await db.collection(`${bookName}_entries`).insertOne(entry);
    res.status(201).json(result);
  } catch (err) {
    console.error("Entry add error:", err);
    res.status(500).json({ message: "Failed to add entry" });
  }
});

// GET: Fetch all entries from a bookName collection
router.get("/:bookName/entries", async (req, res) => {
  const { bookName } = req.params;

  try {
    const db = await connectDB();
    const entries = await db
      .collection(`${bookName}_entries`)
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch entries" });
  }
});


// GET: Fetch single entry by ID from bookName collection
router.get("/:bookName/entries/:id", async (req, res) => {
  const { bookName, id } = req.params;
  try {
    const db = await connectDB();
    const entry = await db
      .collection(`${bookName}_entries`)
      .findOne({ _id: new ObjectId(id) });

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    res.json(entry);
  } catch (err) {
    console.error("Error fetching entry:", err);
    res.status(500).json({ message: "Failed to fetch entry" });
  }
});

module.exports = router;

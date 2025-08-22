// POST: Add entry to bookName collection
const express = require("express");
const { ObjectId } = require("mongodb");
const connectDB = require("../db"); // Adjust path as needed
const router = express.Router();

// Add global entry (for dashboard use)
router.post("/entries", async (req, res) => {
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
      division,
      type,
      createdAt,
      balance,
      details
    } = req.body;

    const entry = {
      date: date || new Date().toISOString().slice(0, 10),
      time: time || new Date().toISOString().slice(11, 16),
      amount: parseFloat(amount),
      contact,
      remarks,
      category,
      mode,
      division,
      type,
      balance,
      details,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
    };
    // console.log("Adding entry:", entry);
    const result = await db.collection("entries").insertOne(entry);
    res.status(201).json({ success: true, data: result.ops?.[0] || entry });
  } catch (err) {
    console.error("Entry add error:", err);
    res.status(500).json({ success: false, message: "Failed to add entry" });
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
// GET /entries
router.get("/entries", async (req, res) => {
  try {
    const db = await connectDB();
    const entries = await db
      .collection("entries")
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, entries });
  } catch (err) {
    console.error("Failed to fetch entries:", err);
    res.status(500).json({ success: false, message: "Failed to fetch entries" });
  }
});
router.patch("/entries/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const db = await connectDB();
    await db
      .collection("entries")
      .updateOne({ _id: new ObjectId(id) }, { $set: updates });

    res.json({ success: true, message: "Entry updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Update error" });
  }
});
router.delete("/entries/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const db = await connectDB();
    await db.collection("entries").deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, message: "Entry deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Delete error" });
  }
});

// specific quuery based on category
router.get("/entries/category/:categoryName", async (req, res) => {
  try {
    const db = await connectDB();
    const { categoryName } = req.params;

    const entries = await db
      .collection("entries")
      .find({ category: categoryName })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, entries });
  } catch (err) {
    console.error("Failed to fetch entries:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch entries" });
  }
});



module.exports = router;

const express = require("express");
const { ObjectId } = require("mongodb");
const connectDB = require("../db");

const router = express.Router();

// Get all members for a book
router.get("/members", async (req, res) => {
  const { bookName } = req.params;
  try {
    const db = await connectDB();
    const members = await db
      .collection(`members`)
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch members" });
  }
});

// Add a new member
router.post("/members", async (req, res) => {
  const { bookName } = req.params;
  const member = {
    ...req.body,
    createdAt: new Date(),
  };

  try {
    const db = await connectDB();
    const result = await db.collection(`members`).insertOne(member);
    res.json({ insertedId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add member" });
  }
});

// Update a member
router.put("/members/:id", async (req, res) => {
  const { bookName, id } = req.params;
  console.log("Updating member with ID:", id);
  try {
    const db = await connectDB();
    const result = await db.collection(`members`).updateOne(
      { _id: new ObjectId(id) },
      { $set: req.body }
    );
    res.json({ modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update member" });
  }
});

// Delete a member
router.delete("/members/:id", async (req, res) => {
  const { bookName, id } = req.params;
  try {
    const db = await connectDB();
    const result = await db
      .collection(`members`)
      .deleteOne({ _id: new ObjectId(id) });
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete member" });
  }
});
router.patch("/members/:id", async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };

  try {
    const db = await connectDB();

    // ✅ Remove _id if exists in update payload
    if ("_id" in updates) {
      delete updates._id;
    }

    await db
      .collection("members")
      .updateOne({ _id: new ObjectId(id) }, { $set: updates });

    res.json({ success: true, message: "Member updated" });
  } catch (err) {
    console.error("Update failed:", err);
    res.status(500).json({ success: false, message: "Update error" });
  }
});



module.exports = router;

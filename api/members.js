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
// PATCH /members/:id
router.patch("/members/:id", async (req, res) => {
  try {
    const db = await connectDB();
    const memberId = req.params.id;
    const updateData = req.body;

    // Dynamically calculate total of payment1Amount + payment2Amount + ...
    // Dynamically calculate total of all paymentXAmount fields
let total = 0;
for (const key in updateData) {
  if (key.startsWith("payment") && key.endsWith("Amount")) {
    total += Number(updateData[key]) || 0;
  }
}
updateData.installmentTotal = total;


    await db.collection("members").updateOne(
      { _id: new ObjectId(memberId) },
      { $set: updateData }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating member:", error);
    res.status(500).json({ success: false, message: "Update failed" });
  }
});
router.patch("/members/:id/update-total", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, transactionType } = req.body;

    const member = await membersCollection.findOne({ _id: new ObjectId(id) });
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    let newTotal = member.total || 0;
    if (transactionType === "cash-in") {
      newTotal += amount;
    } else if (transactionType === "cash-out") {
      newTotal -= amount;
    }

    const result = await membersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { total: newTotal } }
    );

    res.json({ modifiedCount: result.modifiedCount, newTotal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});




module.exports = router;

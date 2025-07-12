const express = require("express");
const { ObjectId } = require("mongodb");
const connectDB = require("../db"); // Adjust path as needed
const router = express.Router();


router.get("/products", async (req, res) => {
  try {
    const db = await connectDB();
    const entries = await db
      .collection("products")
      .find()
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

// POST /product-entries
router.post("/products", async (req, res) => {
  try {
    const db = await connectDB();
    const newEntry = req.body;
    newEntry.createdAt = new Date();

    const result = await db.collection("products").insertOne(newEntry);
    res.status(201).json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error("Failed to add product entry:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// PUT /products/:id
router.put("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { type, quantity } = req.body;
    const qty = Number(quantity);

    if (!["in", "out"].includes(type) || isNaN(qty) || qty <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request" });
    }

    const db = await connectDB();
    const collection = db.collection("products");

    const existing = await collection.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const newTotalIn =
      type === "in" ? (existing.totalIn || 0) + qty : existing.totalIn || 0;
    const newTotalOut =
      type === "out" ? (existing.totalOut || 0) + qty : existing.totalOut || 0;
    const newStock = newTotalIn - newTotalOut;

    const updated = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          totalIn: newTotalIn,
          totalOut: newTotalOut,
          stock: newStock,
        },
      },
      { returnDocument: "after" }
    );

    return res.status(200).json({ success: true, product: updated.value });
  } catch (err) {
    console.error("❌ Update stock error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectDB();
    const collection = db.collection("products");

    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    console.error("❌ Delete product error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
})





module.exports = router;

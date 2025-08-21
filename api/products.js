// api/products.js
const express = require("express");
const { ObjectId } = require("mongodb");
const connectDB = require("../db");

const router = express.Router();
let productsCollection;

// ensure app.js has: app.use(express.json());
connectDB()
  .then((db) => {
    productsCollection = db.collection("products");
    console.log("✅ Products collection ready");
  })
  .catch((err) => console.error(err));

// Create product
router.post("/products", async (req, res) => {
  try {
    const { name, unit = "", remarks = "" } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const product = {
      name,
      unit,
      remarks,
      stock: 0,
      totalIn: 0,
      totalOut: 0,
      logs: [],
      createdAt: new Date(),
    };

    const result = await productsCollection.insertOne(product);
    res.status(201).json({ _id: result.insertedId, ...product });
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get all products (summary)
router.get("/products", async (req, res) => {
  try {
    const products = await productsCollection
      .find({})
      .project({
        name: 1,
        unit: 1,
        remarks: 1,
        stock: 1,
        totalIn: 1,
        totalOut: 1,
      })
      .toArray();
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get single product with optional date filter
// GET /products/:id?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const product = await productsCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).json({ error: "Product not found" });

    let logs = product.logs || [];

    if (from || to) {
      const fromDate = from ? new Date(from) : new Date("1970-01-01");
      const toDate = to ? new Date(to) : new Date("9999-12-31");
      logs = logs.filter((log) => {
        // log.date is YYYY-MM-DD; compare using Date
        const logDate = log.date ? new Date(log.date) : null;
        return logDate && logDate >= fromDate && logDate <= toDate;
      });
    }

    res.json({
      _id: product._id,
      name: product.name,
      unit: product.unit || "",
      remarks: product.remarks || "",
      stock: product.stock || 0,
      totalIn: product.totalIn || 0,
      totalOut: product.totalOut || 0,
      createdAt: product.createdAt,
      logs,
    });
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update product meta (name/unit/remarks)
router.patch("/products/:id", async (req, res) => {
  try {
    const { name, unit, remarks } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (unit !== undefined) update.unit = unit;
    if (remarks !== undefined) update.remarks = remarks;

    const result = await productsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update }
    );
    if (!result.matchedCount)
      return res.status(404).json({ error: "Product not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete product
router.delete("/products/:id", async (req, res) => {
  try {
    const result = await productsCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Helper to apply/remap stock/totals based on a log
function effectFromLog(log) {
  const qty = Number(log.quantity) || 0;
  if (log.type === "in") {
    return { stockDelta: +qty, inDelta: +qty, outDelta: 0 };
  }
  if (log.type === "out") {
    return { stockDelta: -qty, inDelta: 0, outDelta: +qty };
  }
  return { stockDelta: 0, inDelta: 0, outDelta: 0 };
}

// Add log (uses index-less logs; edit/delete by index)
router.post("/products/:id/logs", async (req, res) => {
  try {
    const { id } = req.params;
    let { type, quantity, remarks = "", date } = req.body;

    if (type !== "in" && type !== "out")
      return res.status(400).json({ error: "type must be 'in' or 'out'" });

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0)
      return res
        .status(400)
        .json({ error: "quantity must be positive number" });

    // normalize date to YYYY-MM-DD
    const logDate = date ? new Date(date) : new Date();
    const yyyyMmDd = logDate.toISOString().slice(0, 10);

    const log = { date: yyyyMmDd, type, quantity: qty, remarks };

    const eff = effectFromLog(log);

    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $push: { logs: log },
        $inc: {
          stock: eff.stockDelta,
          totalIn: eff.inDelta,
          totalOut: eff.outDelta,
        },
      }
    );

    if (!result.matchedCount)
      return res.status(404).json({ error: "Product not found" });
    res.status(201).json(log);
  } catch (err) {
    console.error("Error adding log:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update a log by index
router.patch("/products/:id/logs/:index", async (req, res) => {
  try {
    const { id, index } = req.params;
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0)
      return res.status(400).json({ error: "Invalid index" });

    const product = await productsCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const oldLog = (product.logs || [])[idx];
    if (!oldLog)
      return res.status(400).json({ error: "Log not found at index" });

    // Build new log
    const newLog = {
      date: req.body.date
        ? new Date(req.body.date).toISOString().slice(0, 10)
        : oldLog.date,
      type: req.body.type || oldLog.type,
      quantity:
        req.body.quantity != null
          ? Number(req.body.quantity)
          : Number(oldLog.quantity),
      remarks:
        req.body.remarks != null ? req.body.remarks : oldLog.remarks || "",
    };

    if (newLog.type !== "in" && newLog.type !== "out")
      return res.status(400).json({ error: "type must be 'in' or 'out'" });
    if (!Number.isFinite(newLog.quantity) || newLog.quantity <= 0)
      return res
        .status(400)
        .json({ error: "quantity must be positive number" });

    // Compute deltas: remove old effect, add new effect
    const oldEff = effectFromLog(oldLog);
    const newEff = effectFromLog(newLog);

    product.logs[idx] = newLog;

    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: { logs: product.logs },
        $inc: {
          stock: -oldEff.stockDelta + newEff.stockDelta,
          totalIn: -oldEff.inDelta + newEff.inDelta,
          totalOut: -oldEff.outDelta + newEff.outDelta,
        },
      }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Error updating log:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete a log by index
router.delete("/products/:id/logs/:index", async (req, res) => {
  try {
    const { id, index } = req.params;
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0)
      return res.status(400).json({ error: "Invalid index" });

    const product = await productsCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const log = (product.logs || [])[idx];
    if (!log) return res.status(400).json({ error: "Log not found at index" });

    const eff = effectFromLog(log);
    product.logs.splice(idx, 1);

    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: { logs: product.logs },
        $inc: {
          stock: -eff.stockDelta,
          totalIn: -eff.inDelta,
          totalOut: -eff.outDelta,
        },
      }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting log:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

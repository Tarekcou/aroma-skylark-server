// api/products.js
const express = require("express");
const { ObjectId } = require("mongodb");
const connectDB = require("../db");

const router = express.Router();
let productsCollection;

// IMPORTANT in your main app.js/server.js:
//  app.use(express.json());

connectDB()
  .then((db) => {
    productsCollection = db.collection("products");
    console.log("✅ Products collection ready");
  })
  .catch((err) => console.error(err));

// ---------- Helpers ----------
function effectFromLog(log) {
  const qty = Number(log.quantity) || 0;
  if (log.type === "in")
    return { stockDelta: +qty, inDelta: +qty, outDelta: 0 };
  if (log.type === "out")
    return { stockDelta: -qty, inDelta: 0, outDelta: +qty };
  return { stockDelta: 0, inDelta: 0, outDelta: 0 };
}

/**
 * Recompute:
 * - per-log balance (running stock after each transaction)
 * - product totals (stock, totalIn, totalOut)
 * Validates that balance never goes negative.
 * Returns { logs: recomputedLogs, stock, totalIn, totalOut }
 */
function recomputeFromLogs(rawLogs) {
  let stock = 0;
  let totalIn = 0;
  let totalOut = 0;

  const logs = (rawLogs || []).map((l) => ({
    date: l.date, // "YYYY-MM-DD"
    type: l.type, // "in"|"out"
    quantity: Number(l.quantity),
    remarks: l.remarks || "",
    // keep any unknown fields out
  }));

  const recomputed = [];
  for (const log of logs) {
    const eff = effectFromLog(log);
    const nextStock = stock + eff.stockDelta;
    if (nextStock < 0) {
      const info = `${log.type} ${log.quantity} on ${log.date}`;
      const err = new Error(
        `Insufficient stock; balance would go negative at "${info}"`
      );
      err.code = "NEGATIVE_STOCK";
      throw err;
    }
    stock = nextStock;
    totalIn += eff.inDelta;
    totalOut += eff.outDelta;

    recomputed.push({ ...log, balance: stock });
  }

  return { logs: recomputed, stock, totalIn, totalOut };
}

// ---------- Routes ----------

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
router.get("/products", async (_req, res) => {
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
        createdAt: 1,
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

    // logs already have balance stored; we can filter subset for display
    let logs = product.logs || [];
    if (from || to) {
      const fromDate = from ? new Date(from) : new Date("1970-01-01");
      const toDate = to ? new Date(to) : new Date("9999-12-31");
      logs = logs.filter((log) => {
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
// Update product
router.patch("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, unit, remarks } = req.body;

    const updateDoc = {};
    if (name) updateDoc.name = name;
    if (unit) updateDoc.unit = unit;
    // if (remarks !== undefined) updateDoc.remarks = remarks;

    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ ok: true, updatedCount: result.modifiedCount });
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

// Add log (append; compute/stash balance; recompute totals)
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

    const yyyyMmDd = (date ? new Date(date) : new Date())
      .toISOString()
      .slice(0, 10);

    const product = await productsCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const newLogs = [
      ...(product.logs || []),
      { date: yyyyMmDd, type, quantity: qty, remarks },
    ];

    // Recompute & validate (no negative balance)
    let recomputed;
    try {
      recomputed = recomputeFromLogs(newLogs);
    } catch (e) {
      if (e.code === "NEGATIVE_STOCK")
        return res.status(400).json({ error: e.message });
      throw e;
    }

    await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          logs: recomputed.logs,
          stock: recomputed.stock,
          totalIn: recomputed.totalIn,
          totalOut: recomputed.totalOut,
        },
      }
    );

    // Return the newly added log (with balance) for convenience
    res.status(201).json(recomputed.logs[recomputed.logs.length - 1]);
  } catch (err) {
    console.error("Error adding log:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update a log by index (recompute balances & totals)
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

    const updated = {
      date: req.body.date
        ? new Date(req.body.date).toISOString().slice(0, 10)
        : oldLog.date,
      type: req.body.type ?? oldLog.type,
      quantity:
        req.body.quantity != null
          ? Number(req.body.quantity)
          : Number(oldLog.quantity),
      remarks:
        req.body.remarks != null ? req.body.remarks : oldLog.remarks || "",
    };

    if (updated.type !== "in" && updated.type !== "out")
      return res.status(400).json({ error: "type must be 'in' or 'out'" });
    if (!Number.isFinite(updated.quantity) || updated.quantity <= 0)
      return res
        .status(400)
        .json({ error: "quantity must be positive number" });

    const newLogs = [...(product.logs || [])];
    newLogs[idx] = {
      date: updated.date,
      type: updated.type,
      quantity: updated.quantity,
      remarks: updated.remarks,
    };

    // Recompute & validate
    let recomputed;
    try {
      recomputed = recomputeFromLogs(newLogs);
    } catch (e) {
      if (e.code === "NEGATIVE_STOCK")
        return res.status(400).json({ error: e.message });
      throw e;
    }

    await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          logs: recomputed.logs,
          stock: recomputed.stock,
          totalIn: recomputed.totalIn,
          totalOut: recomputed.totalOut,
        },
      }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Error updating log:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete a log by index (recompute balances & totals)
router.delete("/products/:id/logs/:index", async (req, res) => {
  try {
    const { id, index } = req.params;
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0)
      return res.status(400).json({ error: "Invalid index" });

    const product = await productsCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const logs = [...(product.logs || [])];
    if (!logs[idx])
      return res.status(400).json({ error: "Log not found at index" });

    logs.splice(idx, 1);

    // Recompute (deleting cannot create negative balance, but we keep the same flow)
    const recomputed = recomputeFromLogs(logs);

    await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          logs: recomputed.logs,
          stock: recomputed.stock,
          totalIn: recomputed.totalIn,
          totalOut: recomputed.totalOut,
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

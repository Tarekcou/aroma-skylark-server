const express = require("express");
const router = express.Router();
const connectDB = require("../db");
const { ObjectId } = require("mongodb");

router.get("/:id", async (req, res) => {
  const db = await connectDB();
  const book = await db.collection("books").findOne({
    _id: new ObjectId(req.params.id),
  });
  res.json(book);
});
module.exports = router;

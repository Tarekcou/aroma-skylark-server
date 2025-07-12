const express = require("express");
const cors = require("cors");
require("dotenv").config();

const entries = require("./api/entries");

const members = require("./api/members");
const products = require("./api/products");

const app = express();

app.use(cors());
app.use(express.json());


app.use("/api", entries);
app.use("/api", members);
app.use("/api", products);


const PORT = process.env.PORT || 5005;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

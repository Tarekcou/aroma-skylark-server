const express = require("express");
const cors = require("cors");
require("dotenv").config();

const entries = require("./routes/entries");

const members = require("./routes/members");

const app = express();

app.use(cors());
app.use(express.json());


app.use("/api", entries);
app.use("/api", members);


const PORT = process.env.PORT || 5005;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

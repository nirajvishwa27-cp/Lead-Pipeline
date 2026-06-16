import "dotenv/config";
import express from "express";
import connectDB from "./config/db.js";
import leadsRouter from "./routes/leads.js";
import { startRetryJob } from "./jobs/retryFailed.js";

const app = express();

app.use(express.json());

connectDB();
startRetryJob();

app.use("/api/leads", leadsRouter);

app.get("/", (req, res) => {
  res.send("Lead pipeline API is running.");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
import mongoose from "mongoose";

const RETRY_DELAY_MS = 10000;

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("MongoDB connected");
    return true;
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    console.log(`Retrying MongoDB connection in ${RETRY_DELAY_MS / 1000}s`);
    setTimeout(connectDB, RETRY_DELAY_MS);
    return false;
  }
}

export default connectDB;

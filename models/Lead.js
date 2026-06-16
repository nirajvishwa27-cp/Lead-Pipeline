import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema(
  {
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,
      enum: ["received", "scored", "failed", "dead_letter", "synced"],
      default: "received",
      required: true,
    },

    score: {
      type: Number,
      default: null,
    },

    summary: {
      type: String,
      default: null,
    },

    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Lead", LeadSchema);
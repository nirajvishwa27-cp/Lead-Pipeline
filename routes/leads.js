import express from "express";
import Lead from "../models/Lead.js";
import { checkGroqConnection, scoreLead } from "../services/scoringService.js";
import { MAX_RETRIES, retryFailedLeads } from "../jobs/retryFailed.js";
import { sendDeadLetterAlert } from "../services/slackService.js";

const router = express.Router();

router.post("/intake", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({ error: "Request body is empty." });
    }

    const lead = await Lead.create({
      rawPayload: payload,
      status: "received",
    });

    return res.status(200).json({
      message: "Lead captured successfully.",
      leadId: lead._id,
      status: lead.status,
    });
  } catch (err) {
    console.error("Error in /intake:", err.message);
    return res.status(500).json({ error: "Failed to capture lead." });
  }
});


router.post("/score/:id", async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: "Lead not found." });
    }

    try {
      const { score, summary } = await scoreLead(lead.rawPayload);

      lead.status = "scored";
      lead.score = score;
      lead.summary = summary;
      await lead.save();

      return res.status(200).json({
        message: "Lead scored successfully.",
        leadId: lead._id,
        status: lead.status,
        score: lead.score,
        summary: lead.summary,
      });
    } catch (scoringErr) {
      console.error(
        `Scoring failed for lead ${lead._id}:`,
        scoringErr.message
      );

      lead.status = "failed";
      lead.retryCount += 1;
      if (lead.retryCount >= MAX_RETRIES) {
        lead.status = "dead_letter";
      }
      await lead.save();

      if (lead.status === "dead_letter") {
        await sendDeadLetterAlert(lead);
      }

      return res.status(502).json({
        message:
          lead.status === "dead_letter"
            ? "Scoring failed, lead moved to dead letter."
            : "Scoring failed, lead marked for retry.",
        error: scoringErr.message,
        leadId: lead._id,
        status: lead.status,
        retryCount: lead.retryCount,
      });
    }
  } catch (err) {
    console.error("Error in /score/:id:", err.message);
    return res.status(500).json({ error: "Unexpected server error." });
  }
});

router.get("/groq-health", async (req, res) => {
  try {
    const result = await checkGroqConnection();
    return res.status(200).json({
      message: "Groq connection ok.",
      ...result,
    });
  } catch (err) {
    console.error("Groq health check failed:", err.message);
    return res.status(502).json({
      message: "Groq connection failed.",
      error: err.message,
    });
  }
});

router.post("/retry-now", async (req, res) => {
  try {
    await retryFailedLeads();
    return res.status(200).json({ message: "Retry job executed manually." });
  } catch (err) {
    console.error("Error in /retry-now:", err.message);
    return res.status(500).json({ error: "Retry job failed to run." });
  }
});

export default router;

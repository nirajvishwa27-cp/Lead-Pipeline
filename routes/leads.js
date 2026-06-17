import express from "express";
import Lead from "../models/Lead.js";
import { scoreLead } from "../services/scoringService.js";
import { retryFailedLeads } from "../jobs/retryFailed.js";
import { syncToAirtable } from "../services/airtableService.js";
import { sendHotLeadAlert } from "../services/slackService.js";

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

      let airtableRecordId = null;
      let hotLeadNotified = false;

      try {
        const airtableResult = await syncToAirtable(lead);
        airtableRecordId = airtableResult.id;
        lead.status = "synced";
        await lead.save();
console.log("DEBUG hot lead check:", lead.score, typeof lead.score, lead.score >= 7);
        if (lead.score >= 7) {
          await sendHotLeadAlert(lead);
          hotLeadNotified = true;
        }
      } catch (crmErr) {
  console.error(`Airtable sync failed for lead ${lead._id}:`, crmErr.message);
}

      return res.status(200).json({
        message: "Lead scored successfully.",
        leadId: lead._id,
        status: lead.status,
        score: lead.score,
        summary: lead.summary,
        airtableRecordId,
        hotLeadNotified,
      });
    } catch (scoringErr) {
      
      console.error(
        `Scoring failed for lead ${lead._id}:`,
        scoringErr.message
      );

      lead.status = "failed";
      lead.retryCount += 1;
      await lead.save();

      return res.status(502).json({
        message: "Scoring failed, lead marked for retry.",
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
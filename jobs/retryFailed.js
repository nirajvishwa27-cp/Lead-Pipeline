import cron from "node-cron";
import Lead from "../models/Lead.js";
import { scoreLead } from "../services/scoringService.js";
import { sendDeadLetterAlert } from "../services/slackService.js";

export const MAX_RETRIES = 3;

async function retryFailedLeads() {
  const failedLeads = await Lead.find({
    status: "failed",
  });

  if (failedLeads.length === 0) {
    console.log("[retry job] No failed leads to retry.");
    return;
  }

  console.log(`[retry job] Retrying ${failedLeads.length} failed lead(s)...`);

  for (const lead of failedLeads) {
    if (lead.retryCount >= MAX_RETRIES) {
      lead.status = "dead_letter";
      await lead.save();
      await sendDeadLetterAlert(lead);
      console.log(`[retry job] Lead ${lead._id} moved to dead_letter after ${lead.retryCount} attempts.`);
      continue;
    }

    try {
      const { score, summary } = await scoreLead(lead.rawPayload);

      lead.status = "scored";
      lead.score = score;
      lead.summary = summary;
      await lead.save();

      console.log(`[retry job] Lead ${lead._id} scored successfully on retry.`);
    } catch (err) {
      lead.retryCount += 1;

      if (lead.retryCount >= MAX_RETRIES) {
        lead.status = "dead_letter";
        await lead.save();
        await sendDeadLetterAlert(lead);
        console.log(`[retry job] Lead ${lead._id} moved to dead_letter after ${lead.retryCount} attempts.`);
      } else {
        lead.status = "failed";
        await lead.save();
        console.log(`[retry job] Lead ${lead._id} failed again (attempt ${lead.retryCount}).`);
      }
    }
  }
}

export function startRetryJob() {
  cron.schedule("*/5 * * * *", () => {
    retryFailedLeads().catch((err) => {
      console.error("[retry job] Unexpected error:", err.message);
    });
  });

  console.log("Retry job scheduled (every 5 minutes).");
}

export { retryFailedLeads };

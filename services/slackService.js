import axios from "axios";


export async function sendDeadLetterAlert(lead) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("SLACK_WEBHOOK_URL not set — skipping Slack alert.");
    return;
  }

  const name = lead.rawPayload?.name || "Unknown";
  const email = lead.rawPayload?.email || "Unknown";

  const text = `🚨 *Lead needs manual review*\nLead ID: ${lead._id}\nName: ${name}\nEmail: ${email}\nFailed scoring ${lead.retryCount} times and has been moved to dead_letter.`;

  try {
    await axios.post(webhookUrl, { text });
  } catch (err) {
    console.error("Failed to send Slack alert:", err.message);
  }
}
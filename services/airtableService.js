import axios from "axios";

const AIRTABLE_API_URL = "https://api.airtable.com/v0";
const DEFAULT_TABLE_NAME = "Leads";

function getAirtableConfig() {
  const token = process.env.AIRTABLE_API_KEY?.trim() || process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const tableName = process.env.AIRTABLE_TABLE_NAME?.trim() || DEFAULT_TABLE_NAME;

  if (!token) {
    throw new Error("AIRTABLE_API_KEY or AIRTABLE_TOKEN is not configured.");
  }

  if (!baseId) {
    throw new Error("AIRTABLE_BASE_ID is not configured.");
  }

  return { token, baseId, tableName };
}

function formatAirtableError(err) {
  if (err.response) {
    const status = err.response.status;
    const message =
      err.response.data?.error?.message ||
      err.response.data?.error?.type ||
      JSON.stringify(err.response.data);

    return `Airtable request failed: ${status} ${message}`;
  }

  return `Airtable request failed: ${err.message}`;
}


export async function syncToAirtable(lead) {
  const { token, baseId, tableName } = getAirtableConfig();
  const airtableUrl = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(tableName)}`;
  const { name, email, company, message } = lead.rawPayload || {};

  const payload = {
    fields: {
      "Lead ID": lead._id.toString(),
      Name: name || "Unknown",
      Email: email || "",
      Company: company || "",
      Message: message || "",
      Score: lead.score,
      Summary: lead.summary,
      Status: lead.status === "scored" ? "synced" : lead.status,
    },
    typecast: true,
  };

  console.log("DEBUG Airtable payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(airtableUrl, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    return response.data;
  } catch (err) {
    throw new Error(formatAirtableError(err));
  }
}

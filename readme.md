# AI Lead Qualification & Routing Pipeline

## What this does

A lead comes in (via webhook or form), gets scored by AI for sales-readiness,
and is automatically routed into a CRM. Hot leads trigger an instant Slack
alert. If the AI scoring call fails or times out, the lead is never lost —
it's automatically retried, and if it keeps failing, a human gets notified
instead of the lead silently disappearing.



```mermaid
flowchart TD
    A[Customer fills form] --> B[MongoDB<br/>Status: received]
    B --> C[AI Scoring - Groq]

    C --> D{Scoring Successful?}

    D -->|Yes| E[Airtable CRM<br/>Status: synced]
    D -->|No| F[Status: failed]

    F --> G[Retry every 5 min]
    G --> H{Retry Count < 3 ?}

    H -->|Yes| C
    H -->|No| I[Dead Letter]

    I --> J[Slack Alert<br/>Human Review]

    E --> K{Score >= 7 ?}
    K -->|Yes| L[Slack Hot Lead Alert]
```



     
## Stack

- **n8n** — webhook entry point and visual workflow orchestration
- **Node.js / Express** — core API (intake, scoring, retry logic)
- **MongoDB** — durable lead storage and the "queue" that makes this fault-tolerant
- **Groq (Llama 3.1)** — AI scoring, OpenAI-compatible API
- **Airtable** — mock CRM (same integration pattern as HubSpot/Salesforce)
- **Slack** — real-time alerts for hot leads and failures needing review

## The core design decision: capture before processing

The single most important choice in this system is that receiving a lead
and scoring a lead are two separate steps, not one. The moment a lead
arrives, it's saved to MongoDB with status `received` — before any AI call
happens. This means even if the AI provider is completely down, the lead
data is already safe. Nothing depends on the AI call succeeding in order
to not lose data.

## What happens when the AI call fails or times out

1. The lead is already saved (see above), so there's nothing to lose.
2. The scoring attempt fails (timeout, rate limit, bad response) — the lead
   is marked `failed` and a retry counter increments.
3. A scheduled job runs every 5 minutes, finds any `failed` leads, and
   retries them automatically.
4. If a lead fails 3 times total, it's marked `dead_letter` and a Slack
   alert fires so a human can step in. It never just disappears.

## Status lifecycle

`received` → `scored` → `synced` (success path)
`received` → `failed` → (retried) → `scored` → `synced`
`received` → `failed` → `failed` → `failed` → `dead_letter` (after 3 attempts)

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in real credentials (MongoDB,
   Groq, Airtable, Slack webhook)
3. `npm run dev`
4. Send a POST request to `/api/leads/intake` with `{name, email, company, message}`
5. Score it via `POST /api/leads/score/:leadId`

## Folder structure

- `models/` — MongoDB schema
- `routes/` — API endpoints (intake, score, manual retry trigger)
- `services/` — isolated integrations (Groq scoring, Airtable sync, Slack alerts)
- `jobs/` — the scheduled retry job
- `config/` — database connection

## n8n workflow

The included n8n workflow (`n8n/lead-pipeline-workflow.json`) provides the
public-facing webhook entry point and a visual representation of the
success/failure routing. The actual scoring, retry, and escalation logic
lives in the Express API above — n8n orchestrates and visualizes it.





## Setup 
Setup Instructions
1. Clone the Repository
git clone <your-repo-url>
cd Lead-Pipeline
2. Install Dependencies
npm install
3. Create Environment Variables

Create a .env file in the project root:

PORT=5001

MONGO_URI=your_mongodb_atlas_connection_string

GROQ_API_KEY=your_groq_api_key

AIRTABLE_API_KEY=your_airtable_personal_access_token
AIRTABLE_BASE_ID=your_airtable_base_id

SLACK_WEBHOOK_URL=your_slack_webhook_url
4. MongoDB Atlas Setup
Create Cluster
Create a free MongoDB Atlas cluster
Create a database user
Add your IP address to Network Access
Copy the connection string

Example:

MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/lead_pipeline
5. Groq Setup
Create API Key
Sign up at https://console.groq.com
Create an API key
Add it to .env

Example:

GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxx
6. Airtable Setup
Create CRM Base

Create a base named:

CRM_Mock

Create a table named:

Leads

Required columns:

Field	Type
Lead ID	Single Line Text
Name	Single Line Text
Email	Single Line Text
Company	Single Line Text
Message	Long Text
Score	Number
Summary	Long Text
Status	Single Select
Create Personal Access Token

Permissions:

data.records:read
data.records:write

Add to .env:

AIRTABLE_API_KEY=pat_xxxxxxxxx
AIRTABLE_BASE_ID=appxxxxxxxxx
7. Slack Webhook Setup
Create Incoming Webhook
Open Slack Apps
Install Incoming Webhooks
Select a channel
Copy the webhook URL

Add to .env

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx
8. Run the Server

Development:

npm run dev

Production:

npm start

Expected output:

MongoDB connected
Retry job scheduled (every 5 minutes)
Server running on port 5001
9. Test Lead Intake

Create a lead:

curl -X POST http://localhost:5001/api/leads/intake \
-H "Content-Type: application/json" \
-d '{
  "name":"Aarav Mehta",
  "email":"aarav@techverse.ai",
  "company":"TechVerse AI",
  "message":"Budget approved. Need AI automation within 30 days."
}'

Response:

{
  "message": "Lead captured successfully.",
  "leadId": "...",
  "status": "received"
}
10. Score the Lead
curl -X POST http://localhost:5001/api/leads/score/<LEAD_ID>

Expected response:

{
  "message": "Lead scored successfully.",
  "status": "synced",
  "score": 9,
  "summary": "...",
  "airtableRecordId": "...",
  "hotLeadNotified": true
}
6. (Optional) Start n8n:

```bash
docker run -it --rm -p 5678:5678 n8nio/n8n
```

Open:

```text
http://localhost:5678
```

Import the provided workflow and start testing.


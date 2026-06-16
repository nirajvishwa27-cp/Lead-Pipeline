import axios from "axios";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 25000;

function getGroqApiKey() {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured in the running server process.");
  }

  return apiKey;
}

function formatGroqError(err) {
  if (err.response) {
    const status = err.response.status;
    const groqMessage =
      err.response.data?.error?.message ||
      err.response.data?.message ||
      JSON.stringify(err.response.data);

    return `Groq request failed: ${status} ${groqMessage}`;
  }

  if (err.code === "ECONNABORTED") {
    return `Groq request timed out after ${TIMEOUT_MS}ms.`;
  }

  return `Groq request failed: ${err.message}`;
}

async function createGroqChatCompletion(messages, options = {}) {
  try {
    return await axios.post(
      GROQ_URL,
      {
        model: "llama-3.1-8b-instant",
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${getGroqApiKey()}`,
          "Content-Type": "application/json",
        },
        timeout: options.timeoutMs ?? TIMEOUT_MS,
      }
    );
  } catch (err) {
    throw new Error(formatGroqError(err));
  }
}

export async function scoreLead(rawPayload) {
  const { name, email, company, message } = rawPayload;

  const prompt = `You are a sales lead qualification assistant.
Score the following lead from 1-10 on sales-readiness, and give a one-line reason.

Name: ${name || "N/A"}
Email: ${email || "N/A"}
Company: ${company || "N/A"}
Message: ${message || "N/A"}

Respond ONLY in this exact JSON format, no extra text:
{"score": <number 1-10>, "summary": "<one line reason>"}`;

  const response = await createGroqChatCompletion([
    { role: "user", content: prompt },
  ]);

  const rawText = response.data.choices[0].message.content.trim();

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse scoring response as JSON.");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (typeof parsed.score !== "number" || !parsed.summary) {
    throw new Error("Scoring response missing required fields.");
  }

  return { score: parsed.score, summary: parsed.summary };
}

export async function checkGroqConnection() {
  const response = await createGroqChatCompletion(
    [
      {
        role: "user",
        content: 'Reply ONLY with this JSON: {"ok":true}',
      },
    ],
    {
      maxTokens: 20,
      timeoutMs: 10000,
      temperature: 0,
    }
  );

  return {
    ok: true,
    model: response.data.model,
  };
}

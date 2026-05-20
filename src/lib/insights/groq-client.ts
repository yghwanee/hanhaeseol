const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqCallOptions {
  apiKey: string;
  prompt: string;
  timeoutMs?: number;
}

export class GroqError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "GroqError";
  }
}

export async function callGroq({
  apiKey,
  prompt,
  timeoutMs = 60_000,
}: GroqCallOptions): Promise<string> {
  const body = {
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new GroqError(
        `Groq API ${res.status}: ${errText.slice(0, 500)}`,
        res.status,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new GroqError("Empty response from Groq");
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export { GROQ_MODEL };

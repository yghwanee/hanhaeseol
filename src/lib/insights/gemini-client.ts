const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface GeminiCallOptions {
  apiKey: string;
  prompt: string;
  enableSearchGrounding?: boolean;
  timeoutMs?: number;
}

export class GeminiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "GeminiError";
  }
}

export async function callGemini({
  apiKey,
  prompt,
  enableSearchGrounding = true,
  timeoutMs = 60_000,
}: GeminiCallOptions): Promise<string> {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
    },
    ...(enableSearchGrounding ? { tools: [{ googleSearch: {} }] } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new GeminiError(
        `Gemini API ${res.status}: ${errText.slice(0, 200)}`,
        res.status,
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new GeminiError("Empty response from Gemini");
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export { GEMINI_MODEL };

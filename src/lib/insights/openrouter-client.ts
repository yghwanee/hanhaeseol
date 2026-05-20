// DeepSeek V3 0324 free 모델. OpenRouter 무료 한도: 일 200 req, 분당 10 req.
const OPENROUTER_MODEL = "deepseek/deepseek-chat-v3-0324:free";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterCallOptions {
  apiKey: string;
  prompt: string;
  timeoutMs?: number;
}

export class OpenRouterError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export async function callOpenRouter({
  apiKey,
  prompt,
  timeoutMs = 90_000,
}: OpenRouterCallOptions): Promise<string> {
  const body = {
    model: OPENROUTER_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        // OpenRouter 리더보드용 (선택). HTTP 헤더는 ASCII만 허용 → 영문 표기.
        "HTTP-Referer": "https://haeseol.com",
        "X-Title": "Haeseol Match Insights",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new OpenRouterError(
        `OpenRouter API ${res.status}: ${errText.slice(0, 500)}`,
        res.status,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new OpenRouterError("Empty response from OpenRouter");
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export { OPENROUTER_MODEL };

import type { MatchInsight, MatchInsightSections } from "@/types/match-insight";
import { buildInsightContext, type ContextInputs } from "./build-context";
import { buildPrompt } from "./prompt";
import { callGroq, GROQ_MODEL, GroqError } from "./groq-client";
import { containsBettingTerms } from "./safety-filter";
import { writeInsight, readInsight } from "./storage";

export type GenerateOutcome =
  | { status: "created"; insight: MatchInsight }
  | { status: "skipped"; matchId: string; reason: string };

const MIN_TOTAL_LENGTH = 300;
const MAX_RETRIES = 1;

export async function generateInsightForMatch(
  inputs: ContextInputs,
  apiKey: string,
  options: { force?: boolean } = {},
): Promise<GenerateOutcome> {
  const ctx = buildInsightContext(inputs);

  if (!options.force && readInsight(ctx.matchId)) {
    return { status: "skipped", matchId: ctx.matchId, reason: "already-exists" };
  }

  const prompt = buildPrompt(ctx);
  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await callGroq({ apiKey, prompt });
      const sections = parseSections(raw);
      if (!sections) {
        lastError = "json-parse-failed";
        continue;
      }
      const fullText = [
        sections.headline,
        sections.recentForm,
        sections.keyMatchup,
        ...sections.watchPoints,
        sections.viewingInfo,
      ].join(" ");

      if (fullText.length < MIN_TOTAL_LENGTH) {
        lastError = "too-short";
        continue;
      }
      if (containsBettingTerms(fullText)) {
        lastError = "betting-terms-detected";
        continue;
      }

      const insight: MatchInsight = {
        matchId: ctx.matchId,
        generatedAt: new Date().toISOString(),
        model: GROQ_MODEL,
        sections,
      };
      writeInsight(insight);
      return { status: "created", insight };
    } catch (err) {
      if (err instanceof GroqError) {
        lastError = `groq-${err.status ?? "err"}`;
        console.warn(`[groq-error] ${err.message}`);
      } else {
        lastError = `unexpected-${(err as Error).message ?? "err"}`;
        console.warn(`[unexpected-error] ${(err as Error).message}`);
      }
    }
  }

  return { status: "skipped", matchId: ctx.matchId, reason: lastError || "unknown" };
}

function parseSections(raw: string): MatchInsightSections | null {
  // LLM이 JSON을 코드펜스로 감싸 보낼 수 있어 strip. response_format=json_object여도 일부 모델은 펜스 포함.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!isValidSections(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isValidSections(v: unknown): v is MatchInsightSections {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.headline === "string" &&
    typeof o.recentForm === "string" &&
    typeof o.keyMatchup === "string" &&
    Array.isArray(o.watchPoints) &&
    o.watchPoints.every((x) => typeof x === "string") &&
    typeof o.viewingInfo === "string"
  );
}

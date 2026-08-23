import type { MatchInsight, MatchInsightSections } from "@/types/match-insight";
import { buildInsightContext, type ContextInputs } from "./build-context";
import { buildPrompt } from "./prompt";
import { callGemini, GEMINI_MODEL, GeminiError } from "./gemini-client";
import { containsBettingTerms } from "./safety-filter";
import { findFormContradictions } from "./form-claim";
import { writeInsight, readInsight } from "./storage";

export type GenerateOutcome =
  | { status: "created"; insight: MatchInsight }
  | { status: "skipped"; matchId: string; reason: string };

const MIN_TOTAL_LENGTH = 300;
// 흐름 검사에 걸리면 한 번 더 기회를 준다(무료 티어라 호출 수를 늘리진 않는다 — 상한 3회).
const MAX_RETRIES = 2;

export async function generateInsightForMatch(
  inputs: ContextInputs,
  apiKey: string,
  options: { force?: boolean; disableGrounding?: boolean } = {},
): Promise<GenerateOutcome> {
  const ctx = buildInsightContext(inputs);

  if (!options.force && readInsight(ctx.matchId)) {
    return { status: "skipped", matchId: ctx.matchId, reason: "already-exists" };
  }

  const prompt = buildPrompt(ctx);
  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await callGemini({
        apiKey,
        prompt,
        enableSearchGrounding: !options.disableGrounding,
      });
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
      ].join(" ");

      if (fullText.length < MIN_TOTAL_LENGTH) {
        lastError = "too-short";
        continue;
      }
      if (containsBettingTerms(fullText)) {
        lastError = "betting-terms-detected";
        continue;
      }
      // 🔴 흐름 주장이 전적과 반대면 버린다. 프롬프트로 부탁만 해서는 안 막혔다
      // (2026-08-23: 2연승 팀에 "연패를 기록하며"라고 쓴 글이 실제로 게시돼 있었다).
      const contradictions = findFormContradictions(fullText, [
        { name: ctx.homeTeam, flow: ctx.homeFlow },
        { name: ctx.awayTeam, flow: ctx.awayFlow },
      ]);
      if (contradictions.length > 0) {
        lastError = "form-claim-contradiction";
        for (const c of contradictions) {
          console.warn(
            `[form-claim] ${ctx.matchId} ${c.team}: 실제 ${c.actual} ↔ 주장 ${c.claimed} — "${c.sentence}"`,
          );
        }
        continue;
      }

      const insight: MatchInsight = {
        matchId: ctx.matchId,
        generatedAt: new Date().toISOString(),
        model: GEMINI_MODEL,
        sections,
      };
      writeInsight(insight);
      return { status: "created", insight };
    } catch (err) {
      if (err instanceof GeminiError) {
        lastError = `gemini-${err.status ?? "err"}`;
        console.warn(`[gemini-error] ${err.message}`);
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
    o.watchPoints.every((x) => typeof x === "string")
  );
}

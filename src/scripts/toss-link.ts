/**
 * 쉐어링크 1건 발급(수동 확인용).
 *
 *   npm run toss:link -- 12345
 *
 * 🔴 같은 (tacaItemId, publisherId) 는 항상 같은 링크를 돌려준다. 발급 결과는 저장해
 * 재사용할 것 — 매번 부르면 일일 쿼터(10,000건)만 태운다.
 */
import "dotenv/config";
import { createShareLink } from "@/lib/toss/api";
import { TossApiFailure, explainError } from "@/lib/toss/client";

async function main() {
  const raw = process.argv[2];
  const tacaItemId = Number(raw);
  if (!raw || !Number.isFinite(tacaItemId)) {
    console.error("사용: npm run toss:link -- <tacaItemId>");
    process.exit(1);
  }
  try {
    const link = await createShareLink(tacaItemId);
    console.log(JSON.stringify(link, null, 2));
  } catch (e) {
    const msg = e instanceof TossApiFailure ? `${e.errorCode} — ${explainError(e.errorCode)}` : (e as Error).message;
    console.error("발급 실패:", msg);
    process.exit(1);
  }
}

main();

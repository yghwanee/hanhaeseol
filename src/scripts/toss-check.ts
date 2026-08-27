/**
 * 토스쇼핑 쉐어링크 Open API 연동 점검.
 *
 * 셋업이 어디서 막혔는지 한 번에 알려 준다. 순서대로 검사하고, 실패하면
 * **다음에 뭘 해야 하는지**까지 출력한다(코드만 던지면 문서를 다시 뒤지게 된다).
 *
 *   npm run toss:check
 */
import "dotenv/config";
import {
  getAccessToken,
  hasTossEnv,
  tossEnv,
  TossApiFailure,
  explainError,
  TOSS_API_BASE,
  TOSS_TOKEN_CACHE_PATH,
} from "@/lib/toss/client";
import { getCategories, getBestSelling } from "@/lib/toss/api";

const OK = "✅";
const NO = "❌";
const WARN = "⚠️ ";

async function publicIp(): Promise<string> {
  try {
    // fetch-cache-ok: 스크립트 전용. 지금 이 순간의 나가는 IP 를 알아야 한다.
    const r = await fetch("https://api.ipify.org", { signal: AbortSignal.timeout(10_000) });
    return (await r.text()).trim();
  } catch {
    return "(조회 실패)";
  }
}

async function main() {
  let failed = false;
  console.log("토스쇼핑 쉐어링크 Open API 연동 점검\n");
  console.log(`  API base      : ${TOSS_API_BASE}`);
  console.log(`  토큰 캐시     : ${TOSS_TOKEN_CACHE_PATH}`);
  console.log(`  이 서버 IP    : ${await publicIp()}  ← 관리자에 등록된 IP 와 같아야 한다\n`);

  // 1. 자격증명
  if (!hasTossEnv()) {
    console.log(`${NO} 1. 자격증명 — 환경변수가 비어 있다.`);
    console.log("      .env.local 에 아래 3개를 넣을 것(쉐어링크 크리에이터 관리자에서 발급):");
    console.log("        TOSS_SHARELINK_ACCESS_KEY=");
    console.log("        TOSS_SHARELINK_SECRET_KEY=");
    console.log("        TOSS_SHARELINK_PUBLISHER_ID=");
    console.log("\n      🔴 Secret Key 는 발급 직후 한 번만 보인다.");
    process.exit(1);
  }
  const env = tossEnv();
  console.log(`${OK} 1. 자격증명 — Access Key ${env.accessKey.slice(0, 6)}… / publisherId ${env.publisherId}`);

  // 2. 토큰 발급
  let token: string;
  try {
    token = await getAccessToken();
    console.log(`${OK} 2. 토큰 발급 — ${token.slice(0, 12)}… (캐시에 저장, 약 1년 유효)`);
  } catch (e) {
    console.log(`${NO} 2. 토큰 발급 실패 — ${(e as Error).message}`);
    console.log("      Access/Secret Key 오타이거나 아직 Open API 승인 전일 수 있다(심사 영업일 5일).");
    process.exit(1);
  }

  // 3. 읽기 스코프 + IP 등록 (카테고리 조회)
  try {
    const { categories } = await getCategories();
    console.log(`${OK} 3. 읽기 호출 — 카테고리 ${categories.length}개 (예: ${categories.slice(0, 3).map((c) => c.displayName).join(", ")})`);
  } catch (e) {
    failed = true;
    if (e instanceof TossApiFailure) {
      console.log(`${NO} 3. 읽기 호출 실패 — ${e.errorCode}`);
      console.log(`      ${explainError(e.errorCode)}`);
    } else {
      console.log(`${NO} 3. 읽기 호출 실패 — ${(e as Error).message}`);
      console.log("      404 라면 API base 가 틀린 것이다. TOSS_SHARELINK_API_BASE=https://sharelink.toss.im/openapi 로 다시 시도할 것");
      console.log("      (문서가 base 와 경로 양쪽에 /openapi 를 적어 놔 어느 쪽인지 호출 전엔 못 가린다).");
    }
  }

  // 4. 상품 조회 (쿼터 소모 확인용 최소 호출)
  try {
    const best = await getBestSelling({ size: 3 });
    console.log(`${OK} 4. 상품 조회 — 베스트 ${best.items.length}건`);
    for (const p of best.items) {
      console.log(`      · ${p.displayName} ${p.displayPrice.toLocaleString()}원 (tacaItemId ${p.tacaItemId})`);
    }
  } catch (e) {
    failed = true;
    const msg = e instanceof TossApiFailure ? `${e.errorCode} — ${explainError(e.errorCode)}` : (e as Error).message;
    console.log(`${NO} 4. 상품 조회 실패 — ${msg}`);
  }

  // 5. 쓰기 스코프는 링크를 실제로 발급해야 확인된다 → 쿼터를 태우므로 여기서 하지 않는다.
  console.log(`${WARN}5. 쓰기 스코프(링크 발급)는 이 점검에서 호출하지 않는다 — 실제 발급이 일일 쿼터를 쓴다.`);
  console.log("      확인하려면: npm run toss:link -- <tacaItemId>");

  console.log(failed ? `\n${NO} 점검 실패 — 위 항목을 먼저 해결할 것.` : `\n${OK} 연동 준비 완료.`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("점검 중 예외:", e);
  process.exit(1);
});

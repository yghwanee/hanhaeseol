import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { join } from "path";

async function captureToken() {
  console.log("쿠팡플레이 로그인 브라우저를 엽니다...");
  console.log("로그인 완료 후 자동으로 토큰이 저장됩니다.\n");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // 로그인 페이지로 이동
  await page.goto("https://www.coupangplay.com/oauth2/login?rtnUrl=https%3A%2F%2Fwww.coupangplay.com%2Fhome", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  console.log("브라우저에서 쿠팡 계정으로 로그인해주세요...");
  console.log("로그인 완료되면 자동으로 토큰을 추출합니다.\n");

  // 로그인 완료 대기: member_srl 쿠키가 생길 때까지
  while (true) {
    await page.waitForTimeout(2000);
    const cookies = await context.cookies();
    const hasMemberSrl = cookies.some((c) => c.name === "member_srl");
    const hasToken = cookies.some((c) => c.name === "token");
    if (hasMemberSrl || hasToken) {
      break;
    }
    // /home으로 리다이렉트되면 로그인 완료
    const url = page.url();
    if (url.includes("/home") || url.includes("/browse")) {
      break;
    }
  }

  console.log("로그인 감지됨! 쿠키 추출 중...\n");

  // /home 으로 이동하여 P_AT 등 추가 쿠키 획득
  await page.goto("https://www.coupangplay.com/home", {
    waitUntil: "networkidle",
    timeout: 20000,
  });
  await page.waitForTimeout(3000);

  // 스포츠 스케줄 페이지로 이동하여 추가 쿠키 획득
  await page.goto("https://www.coupangplay.com/schedule", {
    waitUntil: "networkidle",
    timeout: 20000,
  });
  await page.waitForTimeout(3000);

  // 모든 쿠키 저장
  const cookies = await context.cookies();
  const cookiePath = join(process.cwd(), ".coupang-cookies.json");
  writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));

  console.log(`쿠키 저장 완료: ${cookiePath}`);
  console.log(`쿠키 수: ${cookies.length}개\n`);

  // 핵심 토큰 확인
  const keyNames = ["CT_LSID", "member_srl", "token", "device_id", "P_AT", "PCID"];
  console.log("=== 핵심 토큰 ===");
  for (const name of keyNames) {
    const c = cookies.find((c) => c.name === name);
    if (c) {
      console.log(`  ✓ ${name}: ${c.value.substring(0, 20)}...`);
    } else {
      console.log(`  ✗ ${name}: 없음`);
    }
  }
  console.log("");

  // 실제 API 테스트
  const today = new Date().toISOString().split("T")[0];
  const apiResult = await page.evaluate(async (date: string) => {
    try {
      const r = await fetch(
        `/api-discover/v1/sports/curated-schedule/events?base_date=${date}&unit=day&locale=ko&region=KR&scope=all&includeHighlights=false&includeSportsChannelContents=true`
      );
      const json = await r.json();
      return { status: r.status, count: json.data?.length ?? 0, sample: json.data?.[0] };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, today);

  console.log("API 테스트 결과:", JSON.stringify(apiResult, null, 2));

  await browser.close();
  console.log("\n완료! 브라우저를 닫았습니다.");
}

captureToken().catch(console.error);

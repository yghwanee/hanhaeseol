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

  await page.goto("https://www.coupangplay.com/", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  // 로그인 완료 대기 (sports 페이지 접근 가능해질 때까지)
  console.log("브라우저에서 로그인해주세요...");
  console.log("로그인 후 자동으로 스포츠 페이지로 이동합니다.\n");

  // 로그인 완료 감지: URL이 coupangplay.com으로 돌아오고 쿠키에 토큰이 있을 때
  while (true) {
    await page.waitForTimeout(2000);
    const cookies = await context.cookies();
    const hasAuth = cookies.some(
      (c) =>
        c.name.includes("token") ||
        c.name.includes("Token") ||
        c.name.includes("auth") ||
        c.name.includes("sid")
    );
    const url = page.url();
    if (hasAuth || url.includes("/browse") || url.includes("/sports")) {
      break;
    }
    // 메인 페이지에 돌아왔는지 확인
    if (
      url === "https://www.coupangplay.com/" ||
      url === "https://www.coupangplay.com"
    ) {
      const bodyText = await page.textContent("body").catch(() => "");
      if (bodyText?.includes("마이페이지") || bodyText?.includes("프로필")) {
        break;
      }
    }
  }

  console.log("로그인 감지됨! 토큰 추출 중...\n");

  // 스포츠 스케줄 API 호출해서 동작 확인
  await page.goto("https://www.coupangplay.com/sports", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.waitForTimeout(3000);

  // 모든 쿠키 저장
  const cookies = await context.cookies();
  const cookiePath = join(process.cwd(), ".coupang-cookies.json");
  writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
  console.log(`쿠키 저장 완료: ${cookiePath}`);
  console.log(`쿠키 수: ${cookies.length}개\n`);

  // API 테스트
  const apiResult = await page.evaluate(async () => {
    try {
      const r = await fetch("/api/sports/schedule");
      const text = await r.text();
      return { status: r.status, body: text.substring(0, 500) };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });

  console.log("API 테스트 결과:", JSON.stringify(apiResult, null, 2));

  await browser.close();
  console.log("\n완료! 브라우저를 닫았습니다.");
}

captureToken().catch(console.error);

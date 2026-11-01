// 네이버 스포츠 API 를 실제 Chromium 안에서 부르는 프리로드.
// 워크플로가 NODE_OPTIONS=--import=./tools/naver-browser-preload.mjs 로 켠다(lib/naver-fetch.ts 가 쓴다).
//
// 🔴 왜 있는가: 2026-10-26 부터 이 API 는 curl·Node 요청에 응답하지 않는다. 같은 GH 러너에서
// Chromium 은 200 이고, 브라우저 헤더·HTTP/2 를 넣은 curl·Node 는 무응답이다(2026-11-01 실측).
//
// 브라우저를 열어 두면 프로세스가 안 끝나므로, 요청이 멈추면 닫고 다음 요청 때 다시 연다.
const IDLE_CLOSE_MS = 10_000;
const REQUEST_TIMEOUT_MS = 12_000;

let browser = null;
let pagePromise = null;
let inflight = 0;
let idleTimer = null;

async function openPage() {
  const { chromium } = await import("playwright");
  browser = await chromium.launch();
  const context = await browser.newContext({
    locale: "ko-KR",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  // CORS 를 맞추려면 이 출처의 문서가 필요하다. 가장 가벼운 문서를 연다.
  await page.goto("https://m.sports.naver.com/robots.txt", { waitUntil: "domcontentloaded", timeout: 30_000 });
  return page;
}

async function closeBrowser() {
  const b = browser;
  browser = null;
  pagePromise = null;
  await b?.close().catch(() => {});
}

globalThis.__naverBrowserFetch = async (url) => {
  clearTimeout(idleTimer);
  inflight += 1;
  try {
    pagePromise ??= openPage();
    const page = await pagePromise;
    return await page.evaluate(
      async ({ url, ms }) => {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), ms);
        try {
          const r = await fetch(url, { signal: c.signal });
          return { status: r.status, body: await r.text() };
        } finally {
          clearTimeout(t);
        }
      },
      { url, ms: REQUEST_TIMEOUT_MS },
    );
  } finally {
    inflight -= 1;
    if (inflight === 0) idleTimer = setTimeout(closeBrowser, IDLE_CLOSE_MS);
  }
};

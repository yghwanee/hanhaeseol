/**
 * 쿠팡 파트너스 단축링크에서 og:image, og:title, 가격을 추출해
 * src/data/coupang-products.json 의 각 항목에 image/price 필드를 보강.
 *
 * 쿠팡은 봇 차단이 강하므로 두 단계로 시도:
 *  1) 단순 fetch + User-Agent 위장
 *  2) 실패 시 playwright (Chromium) 로 실제 브라우저 렌더링
 *
 * 사용:
 *   npx tsx src/scripts/fetch-coupang-meta.ts
 *   npx tsx src/scripts/fetch-coupang-meta.ts --force   (이미 채워진 항목도 갱신)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Product = {
  id: string;
  name: string;
  shortLink: string;
  category: string;
  image?: string;
  price?: string;
};

type ProductFile = {
  _comment?: string;
  lastUpdated: string;
  products: Product[];
};

const DATA_PATH = resolve(process.cwd(), "src/data/coupang-products.json");
const FORCE = process.argv.includes("--force");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function resolveShortLink(shortLink: string): Promise<string | null> {
  // link.coupang.com/a/XXX → www.coupang.com/vp/products/... 로 리다이렉트.
  // fetch 의 redirect=manual 로 헤더만 받아서 Location 추출.
  try {
    const res = await fetch(shortLink, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": UA, "Accept-Language": "ko-KR" },
    });
    const loc = res.headers.get("location");
    if (loc) return loc;
    // 일부는 본문 안에서 meta refresh / JS redirect 로 처리될 수 있음.
    return null;
  } catch {
    return null;
  }
}

function extractOgImage(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1] : null;
}

function extractPrice(html: string): string | null {
  // 쿠팡 상품 페이지: <span class="total-price"><strong>12,900</strong>원</span>
  // 또는 .prod-sale-price, .total-price strong 등. 안정적이지 않으니 best-effort.
  const m =
    html.match(/class=["']total-price["'][^>]*>\s*<strong>([\d,]+)<\/strong>/i) ||
    html.match(/"salePrice"\s*:\s*(\d+)/i) ||
    html.match(/itemprop=["']price["'][^>]*content=["'](\d+)["']/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? `${n.toLocaleString("ko-KR")}원` : null;
}

async function fetchProductPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "ko-KR,ko;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchWithPlaywright(url: string): Promise<string | null> {
  try {
    // 동적 import — playwright 가 없는 환경에서도 fetch 모드만 동작하도록.
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ userAgent: UA, locale: "ko-KR" });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    const html = await page.content();
    await browser.close();
    return html;
  } catch (e) {
    console.warn("    playwright 실패:", (e as Error).message);
    return null;
  }
}

async function enrichOne(p: Product): Promise<{ image?: string; price?: string }> {
  if (!FORCE && p.image && p.price) {
    return { image: p.image, price: p.price };
  }

  console.log(`→ ${p.id} ${p.name.slice(0, 30)}...`);

  const resolved = await resolveShortLink(p.shortLink);
  const targetUrl = resolved ?? p.shortLink;
  console.log(`  resolved: ${targetUrl.slice(0, 80)}...`);

  // 1) 단순 fetch 시도
  let html = await fetchProductPage(targetUrl);
  let image = html ? extractOgImage(html) : null;
  let price = html ? extractPrice(html) : null;

  // 2) 이미지 추출 실패하면 playwright fallback
  if (!image) {
    console.log("  fetch 모드 og:image 추출 실패. playwright 재시도...");
    html = await fetchWithPlaywright(targetUrl);
    if (html) {
      image = extractOgImage(html);
      price = price || extractPrice(html);
    }
  }

  if (image) console.log(`  ✓ image: ${image.slice(0, 80)}`);
  else console.log(`  ✗ image 추출 실패`);
  if (price) console.log(`  ✓ price: ${price}`);

  return {
    image: image ?? p.image,
    price: price ?? p.price,
  };
}

async function main() {
  const raw = readFileSync(DATA_PATH, "utf-8");
  const data = JSON.parse(raw) as ProductFile;

  for (const p of data.products) {
    const { image, price } = await enrichOne(p);
    if (image) p.image = image;
    if (price) p.price = price;
    // 봇 차단 회피: 항목 사이 짧게 대기
    await new Promise((r) => setTimeout(r, 500));
  }

  data.lastUpdated = new Date().toISOString().slice(0, 10);
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");

  const withImg = data.products.filter((p) => p.image).length;
  const withPrice = data.products.filter((p) => p.price).length;
  console.log(
    `\n완료: 총 ${data.products.length}개 중 이미지 ${withImg}개, 가격 ${withPrice}개`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

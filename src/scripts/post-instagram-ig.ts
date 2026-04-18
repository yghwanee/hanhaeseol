import fs from "node:fs";
import path from "node:path";

const IG_API = "https://graph.facebook.com/v21.0";
const IG_ID = process.env.IG_BUSINESS_ACCOUNT_ID!;
const TOKEN = process.env.IG_PAGE_ACCESS_TOKEN!;
const REPO = process.env.GITHUB_REPOSITORY || "yghwanee/hanhaeseol";
const BRANCH = "insta-media";
const MAX_CAROUSEL = 10;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function kstToday() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return { mm, dd };
}

function buildCaption(mm: string, dd: string) {
  return [
    `📺 ${mm}/${dd} 오늘의 한국어 중계 편성표`,
    ``,
    `⚽️ 축구  ⚾️ 야구  🏀 농구  🏐 배구`,
    `한국어 해설이 있는 모든 경기를 한곳에.`,
    ``,
    `#한해설 #한국어해설 #한국어중계 #스포츠 #스포츠중계 #편성표 #중계편성표 #축구중계 #야구중계 #농구중계 #배구중계 #스포티비 #쿠팡플레이 #티빙 #MBC #SBS #KBS #애플티비 #tvN #EPL #프리미어리그 #KBO #국야 #MLB #믈브 #분데스리가 #라리가 #월드컵 #프로야구`,
  ].join("\n");
}

async function createItemContainer(imageUrl: string, isCarousel: boolean) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    access_token: TOKEN,
  });
  if (isCarousel) params.set("is_carousel_item", "true");

  const res = await fetch(`${IG_API}/${IG_ID}/media`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(`아이템 컨테이너 생성 실패: ${JSON.stringify(data)}`);
  }
  return data.id as string;
}

async function waitForFinished(containerId: string) {
  for (let i = 0; i < 15; i++) {
    const res = await fetch(
      `${IG_API}/${containerId}?fields=status_code&access_token=${TOKEN}`,
    );
    const data = await res.json();
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`컨테이너 ${containerId} 처리 실패: ${data.status_code}`);
    }
    await sleep(3000);
  }
  throw new Error(`컨테이너 ${containerId} 처리 시간 초과`);
}

async function createCarouselContainer(childrenIds: string[], caption: string) {
  const params = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childrenIds.join(","),
    caption,
    access_token: TOKEN,
  });
  const res = await fetch(`${IG_API}/${IG_ID}/media`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(`캐러셀 컨테이너 생성 실패: ${JSON.stringify(data)}`);
  }
  return data.id as string;
}

async function publish(creationId: string) {
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: TOKEN,
  });
  const res = await fetch(`${IG_API}/${IG_ID}/media_publish`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(`게시 실패: ${JSON.stringify(data)}`);
  }
  return data.id as string;
}

async function main() {
  if (!IG_ID || !TOKEN) {
    throw new Error("IG_BUSINESS_ACCOUNT_ID, IG_PAGE_ACCESS_TOKEN 환경변수가 필요합니다.");
  }

  const manifestPath = path.resolve("generated/instagram/manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`매니페스트 없음: ${manifestPath} — 먼저 npm run post:all 실행 필요`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    date: string;
    files: string[];
  };

  let files = manifest.files;
  if (files.length === 0) throw new Error("매니페스트에 파일이 없습니다.");

  if (files.length > MAX_CAROUSEL) {
    console.warn(`⚠️  ${files.length}장 → 인스타 캐러셀 최대 ${MAX_CAROUSEL}장으로 잘라서 업로드`);
    files = files.slice(0, MAX_CAROUSEL);
  }

  const baseUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
  const urls = files.map((f) => `${baseUrl}/${f}`);

  console.log(`📸 ${urls.length}장 게시 시작`);
  urls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));

  console.log(`\n🔄 1/3 각 이미지 컨테이너 생성`);
  const itemIds: string[] = [];
  for (const url of urls) {
    const id = await createItemContainer(url, true);
    itemIds.push(id);
    console.log(`  ✅ ${id}`);
  }

  console.log(`\n🔄 2/3 각 컨테이너 FINISHED 대기`);
  for (const id of itemIds) {
    await waitForFinished(id);
    console.log(`  ✅ ${id}`);
  }

  console.log(`\n🔄 3/3 캐러셀 생성 & 게시`);
  const { mm, dd } = kstToday();
  const carouselId = await createCarouselContainer(itemIds, buildCaption(mm, dd));
  console.log(`  캐러셀 컨테이너: ${carouselId}`);
  await waitForFinished(carouselId);
  const mediaId = await publish(carouselId);
  console.log(`\n✅ 게시 완료. Media ID: ${mediaId}`);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});

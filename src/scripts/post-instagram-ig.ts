import fs from "node:fs";
import path from "node:path";
import { getKstToday } from "@/lib/instagram";

const IG_API = "https://graph.facebook.com/v21.0";
const IG_ID = process.env.IG_BUSINESS_ACCOUNT_ID!;
const TOKEN = process.env.IG_PAGE_ACCESS_TOKEN!;
const REPO = process.env.GITHUB_REPOSITORY || "yghwanee/hanhaeseol";
const BRANCH = "insta-media";
const MAX_CAROUSEL = 10;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildCaption(mm: string, dd: string) {
  return [
    `📺 ${mm}/${dd} 오늘의 한국어 중계 편성표`,
    ``,
    `⚽️ 축구  ⚾️ 야구  🏀 농구  🏐 배구`,
    `한국어 해설이 있는 모든 경기를 한곳에.`,
    ``,
    `https://haeseol.com/`,
    ``,
    `#한해설 #한국어해설 #한국어중계 #스포츠 #스포츠중계 #편성표 #중계편성표 #축구중계 #야구중계 #농구중계 #배구중계 #스포티비 #쿠팡플레이 #티빙 #MBC #SBS #KBS #애플티비 #tvN #EPL #프리미어리그 #KBO #국야 #MLB #믈브 #분데스리가 #라리가 #월드컵 #프로야구`,
  ].join("\n");
}

async function postMedia(params: Record<string, string>): Promise<string> {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(`${IG_API}/${IG_ID}/media`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(`미디어 생성 실패: ${JSON.stringify(data)}`);
  return data.id as string;
}

async function waitForFinished(containerId: string) {
  for (let i = 0; i < 15; i++) {
    const res = await fetch(`${IG_API}/${containerId}?fields=status_code&access_token=${TOKEN}`);
    const data = await res.json();
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`컨테이너 ${containerId} 처리 실패: ${data.status_code}`);
    }
    await sleep(3000);
  }
  throw new Error(`컨테이너 ${containerId} 처리 시간 초과`);
}

async function publish(creationId: string): Promise<string> {
  const body = new URLSearchParams({ creation_id: creationId, access_token: TOKEN });
  const res = await fetch(`${IG_API}/${IG_ID}/media_publish`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(`게시 실패: ${JSON.stringify(data)}`);
  return data.id as string;
}

async function main() {
  if (!IG_ID || !TOKEN) throw new Error("IG_BUSINESS_ACCOUNT_ID, IG_PAGE_ACCESS_TOKEN 환경변수 필요");

  const manifestPath = path.resolve("generated/instagram/manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`매니페스트 없음: 먼저 npm run post:all 실행 필요`);
  }
  const { files } = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { files: string[] };
  if (files.length === 0) throw new Error("매니페스트에 파일이 없습니다.");

  const selected = files.length > MAX_CAROUSEL
    ? (console.warn(`⚠️  ${files.length}장 → 최대 ${MAX_CAROUSEL}장으로 자름`), files.slice(0, MAX_CAROUSEL))
    : files;

  const baseUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
  const urls = selected.map((f) => `${baseUrl}/${f}`);

  console.log(`📸 ${urls.length}장 게시 시작`);

  const itemIds = await Promise.all(
    urls.map((image_url) => postMedia({ image_url, is_carousel_item: "true" })),
  );
  console.log(`✅ 아이템 컨테이너 ${itemIds.length}개 생성`);

  await Promise.all(itemIds.map(waitForFinished));
  console.log(`✅ 모든 아이템 FINISHED`);

  const { mm, dd } = getKstToday();
  const carouselId = await postMedia({
    media_type: "CAROUSEL",
    children: itemIds.join(","),
    caption: buildCaption(mm, dd),
  });
  await waitForFinished(carouselId);

  const mediaId = await publish(carouselId);
  console.log(`✅ 게시 완료. Media ID: ${mediaId}`);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});

/**
 * 소셜 3채널 실적 조회.
 *
 * 인스타·유튜브 쇼츠·틱톡에 하루 두 번씩 자동 게시하면서 정작 조회수를 한 번도 안 봤다.
 * 새 채널을 파기 전에 이미 돌아가는 것부터 숫자로 확인한다.
 *
 * 채널마다 권한이 달라서, 막힌 건 막혔다고 그대로 출력한다(빈 값으로 얼버무리지 않는다).
 * 실행: GitHub Actions의 social-stats.yml (토큰이 레포 시크릿에 있다)
 */
import { getAccessToken as ytAccessToken } from "../lib/youtube-api";

const IG_API = "https://graph.facebook.com/v21.0";
const YT_API = "https://www.googleapis.com/youtube/v3";
/** 최근 몇 개까지 볼지 */
const LIMIT = 15;

type Row = { when: string; title: string; views?: number; likes?: number; comments?: number };

function fmt(n: number | undefined): string {
  if (n === undefined) return "-";
  return n.toLocaleString("ko-KR");
}

function table(rows: Row[]): string {
  return rows
    .map(
      (r) =>
        `  ${r.when}  조회 ${fmt(r.views).padStart(7)}  좋아요 ${fmt(r.likes).padStart(5)}  댓글 ${fmt(
          r.comments,
        ).padStart(4)}  ${r.title.slice(0, 40)}`,
    )
    .join("\n");
}

async function youtube(): Promise<string> {
  const token = await ytAccessToken();
  const auth = { Authorization: `Bearer ${token}` };

  const chRes = await fetch(
    `${YT_API}/channels?part=contentDetails,statistics&mine=true`,
    { headers: auth },
  );
  if (!chRes.ok) return `유튜브: 채널 조회 실패 (${chRes.status}) ${await chRes.text()}`;
  const ch = await chRes.json();
  const channel = ch.items?.[0];
  if (!channel) return "유튜브: 채널이 없습니다.";

  const uploads = channel.contentDetails.relatedPlaylists.uploads;
  const stats = channel.statistics;

  const plRes = await fetch(
    `${YT_API}/playlistItems?part=contentDetails,snippet&playlistId=${uploads}&maxResults=${LIMIT}`,
    { headers: auth },
  );
  const pl = (await plRes.json()) as {
    items?: { contentDetails: { videoId: string } }[];
  };
  const ids: string[] = (pl.items ?? []).map((i) => i.contentDetails.videoId);
  if (ids.length === 0) return "유튜브: 업로드된 영상이 없습니다.";

  const vRes = await fetch(
    `${YT_API}/videos?part=statistics,snippet&id=${ids.join(",")}`,
    { headers: auth },
  );
  const v = (await vRes.json()) as {
    items?: {
      snippet: { publishedAt: string; title: string };
      statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
    }[];
  };
  const rows: Row[] = (v.items ?? []).map((it) => ({
    when: it.snippet.publishedAt.slice(0, 10),
    title: it.snippet.title,
    views: Number(it.statistics.viewCount ?? 0),
    likes: Number(it.statistics.likeCount ?? 0),
    comments: Number(it.statistics.commentCount ?? 0),
  }));

  const total = rows.reduce((a, r) => a + (r.views ?? 0), 0);
  const median = [...rows.map((r) => r.views ?? 0)].sort((a, b) => a - b)[
    Math.floor(rows.length / 2)
  ];

  return [
    `유튜브 (구독자 ${fmt(Number(stats.subscriberCount))} · 총 조회 ${fmt(Number(stats.viewCount))} · 영상 ${fmt(Number(stats.videoCount))})`,
    `  최근 ${rows.length}개 합계 ${fmt(total)} · 중앙값 ${fmt(median)}`,
    table(rows),
  ].join("\n");
}

async function instagram(): Promise<string> {
  const id = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = process.env.IG_PAGE_ACCESS_TOKEN;
  if (!id || !token) return "인스타: IG_BUSINESS_ACCOUNT_ID / IG_PAGE_ACCESS_TOKEN 없음";

  const acc = await fetch(
    `${IG_API}/${id}?fields=username,followers_count,media_count&access_token=${token}`,
  ).then((r) => r.json());

  const media = await fetch(
    `${IG_API}/${id}/media?fields=id,caption,media_type,media_product_type,timestamp,like_count,comments_count&limit=${LIMIT}&access_token=${token}`,
  ).then((r) => r.json());

  if (media.error) return `인스타: 미디어 조회 실패 — ${media.error.message}`;

  const rows: Row[] = [];
  let insightsBlocked = "";
  for (const m of media.data ?? []) {
    const row: Row = {
      when: (m.timestamp ?? "").slice(0, 10),
      title: `[${m.media_product_type ?? m.media_type}] ${(m.caption ?? "").replace(/\n/g, " ")}`,
      likes: m.like_count,
      comments: m.comments_count,
    };

    // 조회수는 insights 권한(instagram_manage_insights)이 있어야 나온다.
    // 없으면 좋아요·댓글만 나오고, 그 사실을 숨기지 않고 알린다.
    const ins = await fetch(
      `${IG_API}/${m.id}/insights?metric=views&access_token=${token}`,
    ).then((r) => r.json());
    if (ins.error) insightsBlocked = ins.error.message;
    else row.views = ins.data?.[0]?.values?.[0]?.value;

    rows.push(row);
  }

  const lines = [
    `인스타 (@${acc.username ?? "?"} · 팔로워 ${fmt(acc.followers_count)} · 게시물 ${fmt(acc.media_count)})`,
  ];
  if (insightsBlocked) lines.push(`  ※ 조회수 못 가져옴: ${insightsBlocked}`);
  lines.push(table(rows));
  return lines.join("\n");
}

async function tiktok(): Promise<string> {
  // 우리 토큰 스코프는 user.info.basic / video.publish / video.upload 뿐이다.
  // 조회수를 읽으려면 video.list 스코프로 다시 인증해야 한다(get-tiktok-token.ts 수정 + 재승인).
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) return "틱톡: TIKTOK_CLIENT_KEY 없음";
  return [
    "틱톡: 조회수 조회 불가 (video.list 스코프 없음)",
    "  지금 토큰은 게시 전용이다. 숫자를 보려면 스코프를 추가해 재인증해야 한다.",
    "  앱에서 직접 확인: 프로필 > 각 영상 > 조회수, 설정 > 계정 상태",
  ].join("\n");
}

async function main() {
  const sections: string[] = [];
  for (const [name, fn] of [
    ["유튜브", youtube],
    ["인스타", instagram],
    ["틱톡", tiktok],
  ] as const) {
    try {
      sections.push(await fn());
    } catch (err) {
      sections.push(`${name}: 실패 — ${(err as Error).message}`);
    }
    sections.push("");
  }
  console.log(sections.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { ImageResponse } from "next/og";
import { getAllGuideSlugs, getGuide } from "@/lib/guides";
import { loadOgAssets } from "@/lib/og-assets";

export const runtime = "nodejs";
export const alt = "한해설 Topic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * 🔴 빌드 때 전부 굽는다 (2026-11-14, 이슈 #96). 종전엔 날짜 게이트도 정적 생성도 없어
 * 공유·크롤 요청마다 satori 렌더가 돌았다(Hobby Active CPU 초과로 계정 잠김).
 * 가이드는 파일로 관리하는 고정 집합이라 페이지와 같은 목록을 쓰고 나머지는 404 다.
 */
export function generateStaticParams(): { slug: string }[] {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = false;

/** "2026-07-16" → "2026년 7월 16일" */
function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

export default async function Image({ params }: { params: { slug: string } }) {
  const { bold, regular, logo } = await loadOgAssets();
  const guide = getGuide(params.slug);

  const title = guide?.title ?? "한해설 Topic";
  const category = guide?.category ?? "";
  const date = guide ? formatDate(guide.updated ?? guide.date) : "";
  // 제목이 길면 글자를 줄여 두 줄 안에 들어오게 한다.
  const titleSize = title.length > 34 ? 60 : title.length > 24 ? 70 : 80;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#0a0a0a",
          // satori는 radial-gradient에서 `circle at <pos>` 형태만 파싱한다.
          backgroundImage:
            "radial-gradient(circle at 78% 12%, #1e1b3a 0%, #0a0a0a 58%, #000000 100%)",
          fontFamily: "Pretendard",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={64} height={64} alt="" />
            <span style={{ marginLeft: 18, fontSize: 36, fontWeight: 700 }}>한해설 Topic</span>
          </div>
          {category !== "" && (
            <div
              style={{
                display: "flex",
                fontSize: 30,
                fontWeight: 700,
                color: "#c4b5fd",
                backgroundColor: "rgba(139,92,246,0.16)",
                border: "3px solid #8b5cf6",
                borderRadius: 9999,
                padding: "12px 30px",
              }}
            >
              {category}
            </div>
          )}
        </div>

        <div style={{ display: "flex" }}>
          <span style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.25 }}>{title}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 30, color: "#a1a1aa" }}>{date}</span>
          <span style={{ fontSize: 28, color: "#71717a" }}>haeseol.com</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: regular, weight: 400, style: "normal" },
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}

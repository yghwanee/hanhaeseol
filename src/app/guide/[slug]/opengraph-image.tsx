import { ImageResponse } from "next/og";
import { getGuide } from "@/lib/guides";

export const runtime = "nodejs";
export const alt = "한해설 Topic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BASE = "https://haeseol.com";

// 폰트·로고를 fs로 읽으면 Vercel 서버리스 번들에서 파일이 빠져 500이 난다.
// 배포된 public 자산을 HTTPS로 가져오는 게 match/[slug]/opengraph-image.tsx와 같은 패턴이다.
// Data Cache는 배포 간에도 유지되므로 force-cache 대신 하루로 묶는다(로고 교체가 영구히 안 먹는 걸 방지).
let assetsPromise: Promise<{ bold: ArrayBuffer; regular: ArrayBuffer; logo: string }> | null = null;

function loadAssets() {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      const [bold, regular, logoBuf] = await Promise.all([
        fetch(`${BASE}/fonts/Pretendard-Bold.otf`, { next: { revalidate: 86400 } }).then((r) =>
          r.arrayBuffer(),
        ),
        fetch(`${BASE}/fonts/Pretendard-Regular.otf`, { next: { revalidate: 86400 } }).then((r) =>
          r.arrayBuffer(),
        ),
        fetch(`${BASE}/logo.png`, { next: { revalidate: 86400 } }).then((r) => r.arrayBuffer()),
      ]);
      return {
        bold,
        regular,
        logo: `data:image/png;base64,${Buffer.from(logoBuf).toString("base64")}`,
      };
    })();
  }
  return assetsPromise;
}

/** "2026-07-16" → "2026년 7월 16일" */
function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

export default async function Image({ params }: { params: { slug: string } }) {
  const { bold, regular, logo } = await loadAssets();
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

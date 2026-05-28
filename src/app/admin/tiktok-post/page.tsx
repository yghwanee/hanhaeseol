import type { Metadata } from "next";
import { TikTokPostClient } from "./TikTokPostClient";

export const metadata: Metadata = {
  title: "TikTok 게시 — 운영자 콘솔",
  robots: { index: false, follow: false, nocache: true },
};

/** TikTok Direct Post API audit 통과용 운영자 페이지.
 *  UX Guideline (Point 1~5) 을 모두 시연하는 실 사용 가능한 게시 UI.
 *
 *  접근:
 *  - /admin/tiktok-post?key=<ADMIN_KEY>
 *  - 검색엔진 noindex, 사이트맵 미등록, 환경변수 키 보호.
 *
 *  운영 흐름:
 *  - 백엔드 자동 게시는 src/scripts/post-tiktok.ts 가 담당 (SELF_ONLY 모드).
 *  - 이 페이지는 audit 영상 시연 + 운영자가 명시적으로 게시할 때만 사용. */
export default function Page({
  searchParams,
}: {
  searchParams: { key?: string };
}) {
  const adminKey = searchParams.key ?? "";
  return <TikTokPostClient adminKey={adminKey} />;
}

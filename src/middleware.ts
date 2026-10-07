import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRetiredMatchSlug } from "@/lib/match-retention";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 보존 기간이 지난 매치 페이지는 엣지에서 410 으로 끝낸다(OG 이미지 포함).
  // 근거·수치는 `src/lib/match-retention.ts` 머리 주석.
  if (pathname.startsWith("/match/")) {
    const slug = pathname.slice("/match/".length).split("/")[0];
    if (isRetiredMatchSlug(slug)) {
      return new NextResponse("이 경기 페이지는 보존 기간이 지나 삭제되었습니다. https://haeseol.com/", {
        status: 410,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Robots-Tag": "noindex",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      });
    }
    return;
  }

  if (request.nextUrl.searchParams.has("date")) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("date");
    return NextResponse.redirect(url, 301);
  }
}

export const config = {
  matcher: ["/", "/match/:path*"],
};

import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getCreatorInfo } from "@/lib/tiktok-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** /admin/tiktok-post 페이지가 호출. UX Guideline Point 1 — 크리에이터 정보,
 *  privacy 옵션, 최대 동영상 길이를 받아 UI 에 노출. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-admin-key");
  if (!key || key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { accessToken } = await getAccessToken();
    const info = await getCreatorInfo(accessToken);
    return NextResponse.json({
      ok: true,
      creator: {
        username: info.creatorUsername ?? null,
        nickname: info.creatorNickname ?? null,
        privacyLevelOptions: info.privacyLevelOptions,
        maxVideoPostDurationSec: info.maxVideoPostDurationSec,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

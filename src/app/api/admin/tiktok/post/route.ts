import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getAccessToken,
  postVideoFileUpload,
  type PrivacyLevel,
} from "@/lib/tiktok-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Vercel Function 최대 실행 시간. TikTok 청크 업로드 + publish 상태 폴링까지
 *  포함되어야 하므로 5분으로 설정 (Pro 플랜 기준). */
export const maxDuration = 300;

const ALLOWED_PRIVACY: PrivacyLevel[] = [
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "SELF_ONLY",
];

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** UX Guideline 전체 흐름의 최종 단계. 사용자가 명시적으로 "Post to TikTok"
 *  버튼을 누르면 호출됨. multipart/form-data 로 video file + 폼 필드 받아서
 *  TikTok Content Posting API 의 init → chunk upload → status poll 순서로 게시. */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-admin-key");
  if (!key || key !== process.env.ADMIN_KEY) {
    return bad("unauthorized", 401);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("multipart/form-data 본문이 필요합니다.");
  }

  const file = form.get("video");
  const title = (form.get("title") as string | null)?.trim() ?? "";
  const privacyLevel = form.get("privacy_level") as PrivacyLevel | null;
  const allowComment = form.get("allow_comment") === "true";
  const allowDuet = form.get("allow_duet") === "true";
  const allowStitch = form.get("allow_stitch") === "true";
  const isCommercial = form.get("is_commercial") === "true";
  const isYourBrand = form.get("is_your_brand") === "true";
  const isBrandedContent = form.get("is_branded_content") === "true";
  const policyAccepted = form.get("policy_accepted") === "true";

  if (!(file instanceof File)) return bad("video 파일이 필요합니다.");
  if (!title) return bad("제목(title)이 필요합니다.");
  if (!privacyLevel || !ALLOWED_PRIVACY.includes(privacyLevel)) {
    return bad("privacy_level 을 선택해야 합니다.");
  }
  if (!policyAccepted) {
    return bad("음악/브랜드 정책 동의가 필요합니다.");
  }
  if (isCommercial && !isYourBrand && !isBrandedContent) {
    return bad("상업용 콘텐츠는 본인 브랜드 또는 브랜드 콘텐츠 중 하나 이상을 선택해야 합니다.");
  }
  // 정책: SELF_ONLY 가 아니면서 branded content 인 경우 PUBLIC 만 허용 (TikTok 규정).
  if (isBrandedContent && privacyLevel === "SELF_ONLY") {
    return bad("브랜드 콘텐츠는 공개(PUBLIC) 게시만 가능합니다.");
  }

  // 임시 파일에 저장 (postVideoFileUpload 가 path 기반).
  const buf = Buffer.from(await file.arrayBuffer());
  const tmpPath = join(tmpdir(), `tiktok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`);
  await writeFile(tmpPath, buf);

  try {
    const { accessToken } = await getAccessToken();
    const publishId = await postVideoFileUpload(accessToken, {
      filePath: tmpPath,
      caption: title,
      privacyLevel,
      // TikTok API 는 disable_* 플래그. UI 에서 "허용" 토글을 받았으니 반전.
      disableComment: !allowComment,
      disableDuet: !allowDuet,
      disableStitch: !allowStitch,
    });
    return NextResponse.json({
      ok: true,
      publishId,
      message: "TikTok 게시 요청이 완료되었습니다. 본인 계정에서 확인하세요.",
    });
  } catch (e) {
    return bad((e as Error).message, 500);
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

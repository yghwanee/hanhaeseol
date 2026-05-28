"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PrivacyLevel = "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";

interface CreatorInfo {
  username: string | null;
  nickname: string | null;
  privacyLevelOptions: string[];
  maxVideoPostDurationSec: number;
}

const PRIVACY_LABEL: Record<PrivacyLevel, string> = {
  PUBLIC_TO_EVERYONE: "전체 공개 (Everyone)",
  MUTUAL_FOLLOW_FRIENDS: "친구 공개 (Mutual Follow Friends)",
  SELF_ONLY: "본인만 (Only Me)",
};

type Status =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "success"; publishId: string; message: string }
  | { kind: "error"; message: string };

export function TikTokPostClient({ adminKey }: { adminKey: string }) {
  // ── Point 1: creator info 조회 상태 ────────────────────────────────────
  const [creator, setCreator] = useState<CreatorInfo | null>(null);
  const [creatorError, setCreatorError] = useState<string | null>(null);

  // ── Point 2: 메타데이터 (기본값 없이 사용자가 선택) ────────────────────
  const [title, setTitle] = useState("");
  const [privacy, setPrivacy] = useState<PrivacyLevel | "">("");
  const [allowComment, setAllowComment] = useState(false);
  const [allowDuet, setAllowDuet] = useState(false);
  const [allowStitch, setAllowStitch] = useState(false);

  // ── Point 3: 상업용 콘텐츠 토글 (기본 OFF) ─────────────────────────────
  const [isCommercial, setIsCommercial] = useState(false);
  const [isYourBrand, setIsYourBrand] = useState(false);
  const [isBrandedContent, setIsBrandedContent] = useState(false);

  // ── Point 4: 정책 동의 ────────────────────────────────────────────────
  const [policyAccepted, setPolicyAccepted] = useState(false);

  // ── Point 5: 미리보기 / 파일 ──────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // creator info fetch (mount 시 1회)
  useEffect(() => {
    if (!adminKey) {
      setCreatorError("URL 에 ?key= 로 ADMIN_KEY 를 전달해야 합니다.");
      return;
    }
    let cancelled = false;
    fetch(`/api/admin/tiktok/creator-info?key=${encodeURIComponent(adminKey)}`)
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok || !data.ok) {
          setCreatorError(data.error ?? "creator info 조회 실패");
          return;
        }
        setCreator(data.creator as CreatorInfo);
      })
      .catch((e) => !cancelled && setCreatorError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [adminKey]);

  // file -> object URL 미리보기
  useEffect(() => {
    if (!file) {
      setVideoUrl(null);
      setVideoDuration(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onVideoLoaded = () => {
    if (videoRef.current) {
      setVideoDuration(Math.round(videoRef.current.duration));
    }
  };

  // 게시 가능 조건 (UI 가이드라인의 명시적 동의 — 한 조각이라도 빠지면 비활성)
  const durationOk =
    creator && videoDuration !== null
      ? videoDuration <= creator.maxVideoPostDurationSec
      : true;
  const commercialOk = !isCommercial || isYourBrand || isBrandedContent;
  const brandedPrivacyOk = !isBrandedContent || privacy !== "SELF_ONLY";

  const canSubmit =
    creator &&
    file &&
    title.trim().length > 0 &&
    privacy !== "" &&
    policyAccepted &&
    durationOk &&
    commercialOk &&
    brandedPrivacyOk &&
    status.kind !== "loading";

  const submit = async () => {
    if (!canSubmit || !file || !privacy) return;
    setStatus({ kind: "loading", message: "TikTok 으로 영상 업로드 중..." });
    const fd = new FormData();
    fd.append("video", file);
    fd.append("title", title.trim());
    fd.append("privacy_level", privacy);
    fd.append("allow_comment", String(allowComment));
    fd.append("allow_duet", String(allowDuet));
    fd.append("allow_stitch", String(allowStitch));
    fd.append("is_commercial", String(isCommercial));
    fd.append("is_your_brand", String(isYourBrand));
    fd.append("is_branded_content", String(isBrandedContent));
    fd.append("policy_accepted", String(policyAccepted));

    try {
      const r = await fetch(
        `/api/admin/tiktok/post?key=${encodeURIComponent(adminKey)}`,
        { method: "POST", body: fd },
      );
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setStatus({ kind: "error", message: data.error ?? "게시 실패" });
        return;
      }
      setStatus({
        kind: "success",
        publishId: data.publishId,
        message: data.message,
      });
    } catch (e) {
      setStatus({ kind: "error", message: (e as Error).message });
    }
  };

  const privacyOptions = useMemo<PrivacyLevel[]>(() => {
    if (!creator) return [];
    return creator.privacyLevelOptions.filter(
      (p): p is PrivacyLevel =>
        p === "PUBLIC_TO_EVERYONE" ||
        p === "MUTUAL_FOLLOW_FRIENDS" ||
        p === "SELF_ONLY",
    );
  }, [creator]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            한해설 운영자 콘솔
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            TikTok 영상 게시
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            본인 계정(@hanhaeseol)에 영상을 직접 게시합니다. 모든 단계를
            확인한 뒤 마지막에 명시적으로 게시 버튼을 누르세요.
          </p>
        </header>

        {creatorError && (
          <div className="mb-6 rounded-lg border border-red-700/50 bg-red-950/30 p-4 text-sm text-red-300">
            <strong>접근 오류:</strong> {creatorError}
          </div>
        )}

        {/* ─────────── Step 1: Creator Info ─────────── */}
        <Section step={1} title="게시 대상 계정 확인">
          {!creator ? (
            <p className="text-sm text-zinc-500">크리에이터 정보 로드 중...</p>
          ) : (
            <div className="space-y-1 text-sm text-zinc-300">
              <p>
                <span className="text-zinc-500">닉네임: </span>
                <strong className="text-white">
                  {creator.nickname ?? "(없음)"}
                </strong>
              </p>
              {creator.username && (
                <p>
                  <span className="text-zinc-500">계정: </span>@
                  {creator.username}
                </p>
              )}
              <p>
                <span className="text-zinc-500">최대 동영상 길이: </span>
                {creator.maxVideoPostDurationSec}초
              </p>
              <p>
                <span className="text-zinc-500">게시 가능한 공개 범위: </span>
                {privacyOptions.length > 0
                  ? privacyOptions.map((p) => PRIVACY_LABEL[p]).join(", ")
                  : "(조회 실패)"}
              </p>
            </div>
          )}
        </Section>

        {/* ─────────── Step 2: 메타데이터 (기본값 없음) ─────────── */}
        <Section step={2} title="영상 정보 입력">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="title"
                className="mb-1.5 block text-sm font-medium text-zinc-300"
              >
                제목 <span className="text-red-400">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={2200}
                placeholder="영상 제목을 입력하세요"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-zinc-500">
                {title.length} / 2200
              </p>
            </div>

            <div>
              <label
                htmlFor="privacy"
                className="mb-1.5 block text-sm font-medium text-zinc-300"
              >
                공개 범위 <span className="text-red-400">*</span>
              </label>
              <select
                id="privacy"
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as PrivacyLevel | "")}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
              >
                <option value="" disabled>
                  -- 선택하세요 --
                </option>
                {privacyOptions.map((p) => (
                  <option key={p} value={p}>
                    {PRIVACY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-zinc-300">
                상호작용 허용
              </legend>
              <Checkbox
                label="댓글 허용"
                checked={allowComment}
                onChange={setAllowComment}
              />
              <Checkbox
                label="듀엣 허용"
                checked={allowDuet}
                onChange={setAllowDuet}
              />
              <Checkbox
                label="스티치 허용"
                checked={allowStitch}
                onChange={setAllowStitch}
              />
            </fieldset>
          </div>
        </Section>

        {/* ─────────── Step 3: 상업용 콘텐츠 토글 ─────────── */}
        <Section step={3} title="상업용 콘텐츠 표시">
          <div className="space-y-3">
            <Checkbox
              label="이 영상은 상업용 콘텐츠입니다 (Disclose commercial content)"
              checked={isCommercial}
              onChange={(v) => {
                setIsCommercial(v);
                if (!v) {
                  setIsYourBrand(false);
                  setIsBrandedContent(false);
                }
              }}
            />
            {isCommercial && (
              <div className="ml-6 space-y-2 border-l-2 border-zinc-700 pl-4">
                <Checkbox
                  label="본인 브랜드 (Your Brand) — 본인 사업/제품을 홍보"
                  checked={isYourBrand}
                  onChange={setIsYourBrand}
                />
                <Checkbox
                  label="브랜드 콘텐츠 (Branded Content) — 광고주 협찬"
                  checked={isBrandedContent}
                  onChange={setIsBrandedContent}
                />
                {isBrandedContent && (
                  <p className="text-xs text-amber-400">
                    ⚠️ 브랜드 콘텐츠는 PUBLIC 공개만 허용됩니다 (TikTok 정책).
                  </p>
                )}
                {isCommercial && !isYourBrand && !isBrandedContent && (
                  <p className="text-xs text-red-400">
                    상업용으로 표시한 경우 위 두 가지 중 하나 이상을
                    선택해야 합니다.
                  </p>
                )}
                <p className="text-xs text-zinc-500">
                  선택 시 게시 후 영상에 자동으로 관련 라벨이 표시됩니다.
                </p>
              </div>
            )}
          </div>
        </Section>

        {/* ─────────── Step 4: 정책 동의 ─────────── */}
        <Section step={4} title="정책 동의">
          <div className="space-y-3 text-sm text-zinc-400">
            <p className="leading-relaxed">
              영상에 포함된 음악 사용권을 확인했으며, TikTok 의{" "}
              <a
                href="https://www.tiktok.com/legal/music-usage-confirmation"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 underline underline-offset-2"
              >
                Music Usage Confirmation
              </a>{" "}
              정책을 준수합니다.
            </p>
            {isBrandedContent && (
              <p className="leading-relaxed">
                또한{" "}
                <a
                  href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline underline-offset-2"
                >
                  Branded Content Policy
                </a>{" "}
                를 검토하였고 게시 콘텐츠가 해당 정책을 위반하지 않음을
                확인했습니다.
              </p>
            )}
            <Checkbox
              label="위 정책을 모두 확인했으며 동의합니다."
              checked={policyAccepted}
              onChange={setPolicyAccepted}
            />
          </div>
        </Section>

        {/* ─────────── Step 5: 미리보기 + 게시 ─────────── */}
        <Section step={5} title="영상 업로드 · 미리보기 · 게시">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="video-file"
                className="mb-1.5 block text-sm font-medium text-zinc-300"
              >
                영상 파일 (mp4) <span className="text-red-400">*</span>
              </label>
              <input
                id="video-file"
                type="file"
                accept="video/mp4,video/quicktime"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-zinc-700"
              />
              <p className="mt-1 text-xs text-zinc-500">
                업로드한 영상에 별도의 로고/워터마크가 추가되지 않습니다 (TikTok
                정책). 본인이 명시적으로 게시 버튼을 누른 뒤에만 TikTok 으로
                전송됩니다.
              </p>
            </div>

            {videoUrl && (
              <div>
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  미리보기
                </p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  onLoadedMetadata={onVideoLoaded}
                  className="w-full max-w-xs rounded-lg border border-zinc-800"
                />
                {videoDuration !== null && creator && (
                  <p
                    className={`mt-2 text-xs ${
                      durationOk ? "text-zinc-500" : "text-red-400"
                    }`}
                  >
                    길이: {videoDuration}초 / 허용{" "}
                    {creator.maxVideoPostDurationSec}초
                    {!durationOk && " — 초과되어 게시 불가"}
                  </p>
                )}
              </div>
            )}

            {status.kind === "loading" && (
              <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 text-sm text-zinc-300">
                ⏳ {status.message}
              </div>
            )}
            {status.kind === "success" && (
              <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-3 text-sm text-emerald-300">
                ✅ {status.message}
                <p className="mt-1 text-xs text-emerald-400/80">
                  publish_id: {status.publishId}
                </p>
              </div>
            )}
            {status.kind === "error" && (
              <div className="rounded-lg border border-red-700/50 bg-red-950/30 p-3 text-sm text-red-300">
                ❌ {status.message}
              </div>
            )}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {status.kind === "loading" ? "게시 중..." : "TikTok 에 게시"}
            </button>
            <p className="text-center text-xs text-zinc-500">
              위 버튼을 누르기 전까지 TikTok 으로 어떠한 데이터도 전송되지
              않습니다.
            </p>
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-emerald-400">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-500"
      />
      <span>{label}</span>
    </label>
  );
}

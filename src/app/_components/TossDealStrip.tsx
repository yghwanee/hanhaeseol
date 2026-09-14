import { DISCLOSURE_SHORT, formatWon, getSlotPick, toView, type TossSlot } from "@/lib/affiliate/toss-picks";

/**
 * 홈 편성표 중간에 들어가는 토스쇼핑 한 줄 띠 (시안 A).
 *
 * 🔴 상품은 **한 개만** 건다. 운영정책이 "API 로 받은 가격을 쌓아 이커머스처럼
 * 나열·전시하는 커머스형 웹사이트는 승인되지 않습니다"라고 못 박는다. 한해설은
 * 편성표 사이트고, 여긴 소개 한 줄 자리다. 그리드로 키우지 말 것.
 *
 * 🔴 이미지가 없다. 썸네일을 붙이려면 토스 고객센터 사전 확인이 먼저다
 * (`src/lib/affiliate/toss-picks.ts` 주석 참조). 위반은 수익 정지·계약 해지다.
 *
 * 🔴 `fixed`·`sticky` 를 쓰지 않는다. 본문을 가리며 따라다니는 플로팅 배너는
 * 정책이 전면 금지한다. 문서 흐름 안에 그대로 선다.
 *
 * 데이터가 없으면(=자리 미지정, 마감, 링크 없음) 스스로 `null` 을 돌려준다.
 * 그래서 기본 상태는 "아무것도 안 뜸"이고, 켜는 건 `toss:pick -- <id> --slot=<자리>` 다.
 *
 * 자리는 셋 — `home-top`(필터 아래·상단 광고 위), `home-inline`(오후 경기 구분선 아래),
 * `match`(매치 페이지 중계 안내 문장 아래).
 * 🔴 **같은 화면의 두 자리에 같은 상품을 걸지 말 것**(home-top·home-inline). 매치는 별개 페이지다.
 */
export function TossDealStrip({
  slot = "home-inline",
  className = "",
}: {
  slot?: TossSlot;
  className?: string;
}) {
  const pick = getSlotPick(slot);
  if (!pick) return null;

  const { showPrice } = toView(pick);
  const discounted = showPrice && pick.originalPrice > pick.displayPrice;

  return (
    <div className={className}>
      <a
        href={pick.shortUrl}
        target="_blank"
        // sponsored 를 빼면 유료 링크 미표시로 검색 가이드라인 위반이다.
        rel="nofollow sponsored noopener"
        // 탭 영역 44px 이상 — py-3 + 내용 높이로 확보한다(⭐별 26px 사고와 같은 규칙).
        className="flex min-h-[52px] items-center gap-2.5 rounded-xl border border-line-subtle bg-surface px-3 py-3 transition-colors hover:border-line sm:gap-3 sm:px-4"
      >
        <span className="w-badge w-badge--brand shrink-0 text-caption2">
          토스쇼핑
        </span>
        <span className="min-w-0 flex-1 truncate text-label2 font-medium text-fg-strong sm:text-label1">
          {pick.displayName}
        </span>
        {showPrice && (
          <span className="flex shrink-0 items-baseline gap-1.5">
            {discounted && (
              <span className="text-caption1 font-bold text-fg-danger tabular-nums sm:text-label2">
                {pick.discountRate}%
              </span>
            )}
            <span className="text-label2 font-bold text-fg-strong tabular-nums sm:text-label1">
              {formatWon(pick.displayPrice)}
            </span>
            {discounted && (
              <span className="hidden text-caption2 text-fg-tertiary line-through tabular-nums sm:inline">
                {formatWon(pick.originalPrice)}
              </span>
            )}
          </span>
        )}
        <span className="hidden shrink-0 rounded-md bg-brand px-2.5 py-1.5 text-caption2 font-semibold text-white sm:inline">
          보러 가기
        </span>
      </a>
      {/* 🔴 대가성 문구는 상품 소개와 같은 화면에 붙어 있어야 한다. 접거나 푸터로
          내리면 위반이다. 색은 zinc-400 — zinc-500 은 검정 배경에서 약 4.2:1 이라
          10px 글씨로는 "알아보기 쉽게"(정책 문구)에 못 미친다. */}
      <p className="mt-1.5 px-1 text-caption2 leading-relaxed text-fg-secondary">{DISCLOSURE_SHORT}</p>
    </div>
  );
}

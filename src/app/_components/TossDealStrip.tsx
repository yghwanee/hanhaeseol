import { DISCLOSURE_SHORT, formatWon, getDealPick, toView } from "@/lib/affiliate/toss-picks";

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
 * 데이터가 없으면(=`deal` 미지정, 마감, 링크 없음) 스스로 `null` 을 돌려준다.
 * 그래서 기본 상태는 "아무것도 안 뜸"이고, 켜는 건 `toss:pick -- <id> --deal` 이다.
 */
export function TossDealStrip({ className = "" }: { className?: string }) {
  const pick = getDealPick();
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
        className="flex min-h-[52px] items-center gap-2.5 rounded-xl border border-zinc-800 bg-[#101216] px-3 py-3 transition-colors hover:border-[#3182f6]/40 sm:gap-3 sm:px-4"
      >
        <span className="shrink-0 rounded-md border border-[#3182f6]/40 bg-[#3182f6]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#3182f6]">
          토스쇼핑
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-100 sm:text-sm">
          {pick.displayName}
        </span>
        {showPrice && (
          <span className="flex shrink-0 items-baseline gap-1.5">
            {discounted && (
              <span className="text-[12px] font-bold text-red-400 tabular-nums sm:text-[13px]">
                {pick.discountRate}%
              </span>
            )}
            <span className="text-[13px] font-bold text-zinc-100 tabular-nums sm:text-sm">
              {formatWon(pick.displayPrice)}
            </span>
            {discounted && (
              <span className="hidden text-[11px] text-zinc-500 line-through tabular-nums sm:inline">
                {formatWon(pick.originalPrice)}
              </span>
            )}
          </span>
        )}
        <span className="hidden shrink-0 rounded-md bg-[#3182f6] px-2.5 py-1.5 text-[11px] font-semibold text-[#0b0d10] sm:inline">
          보러 가기
        </span>
      </a>
      {/* 🔴 대가성 문구는 상품 소개와 같은 화면에 붙어 있어야 한다. 접거나 푸터로
          내리면 위반이다. 색은 zinc-400 — zinc-500 은 검정 배경에서 약 4.2:1 이라
          10px 글씨로는 "알아보기 쉽게"(정책 문구)에 못 미친다. */}
      <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-zinc-400">{DISCLOSURE_SHORT}</p>
    </div>
  );
}

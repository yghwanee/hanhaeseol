/**
 * 홈 히어로 — 원티드 마케팅 히어로 해부도.
 *
 *   eyebrow pill(brand-subtle + brand 글자, radius-full)
 *   → display 헤드라인 2줄(700, 네거티브 트래킹)
 *   → 볼드 서브헤드라인
 *   → 본문 단락(핵심어만 brand 색)
 *   → CTA 행: solid + outlined
 *
 * 문구는 화니가 직접 정한 것이다(2026-09-14). 헤드라인·서브헤드라인은 마침표 없이,
 * 본문 두 문장은 마침표를 찍는다(화니가 준 문장 그대로). 줄바꿈은 브라우저에 맡기지
 * 않고 문장 단위로 끊는다(`break-keep` + 문단 분리).
 *
 * 🔴 **그라디언트를 쓰지 않는다.** 원티드가 그라디언트를 허용하는 자리는 심볼·아바타·
 * 썸네일 placeholder·풀블리드 마케팅 배너 네 곳뿐이고, 이 히어로는 흰 캔버스 위
 * 타이포그래피로만 선다. 색은 **CTA 하나와 본문 강조어**에만 쓴다.
 *
 * 🔴 수치는 실제 데이터에서 받는다. 지어내면 그 순간 이 화면이 광고가 된다 —
 * 그리고 `test:answer-lead` 가드가 "기준일 없는 수치 주장"을 막는다. 그래서
 * 문장에 항상 기준일이 함께 들어간다.
 */
export function HomeHero({
  totalGames,
  koreanGames,
  dateLabel,
  onKoreanOnly,
}: {
  /** "한국어 해설만" CTA — 해설 필터를 켜고 편성표로 스크롤 */
  onKoreanOnly: () => void;
  /** 오늘 편성 경기 수 */
  totalGames: number;
  /** 그중 한국어 해설이 확인된 경기 수 */
  koreanGames: number;
  /** 기준일 라벨 (예: "9월 14일") */
  dateLabel: string;
}) {
  return (
    // 🔴 모바일(<640px)에서는 히어로를 안 보인다(2026-09-14 화니 지시) — 첫 화면을
    // 편성표에 내준다. 단 h1 은 sr-only 로 남긴다. 통째로 `hidden` 하면 모바일 우선
    // 색인에서 페이지의 유일한 h1 이 display:none 이 된다.
    <section className="sm:pt-16">
      {/* eyebrow — 형광펜으로 칠한 듯한 파란 하이라이트(2026-09-14 화니 지시).
          테두리·pill 없이 글자 뒤에 반투명 파랑 면만 깐다. 토큰이 var() 라 `bg-brand/40`
          같은 투명도 문법이 안 먹어서 color-mix 로 섞는다. */}
      <span
        className="hidden sm:inline-block rounded-[4px] bg-[color-mix(in_oklch,var(--w-brand)_45%,transparent)] px-2 py-0.5 text-label1 font-bold text-fg-strong"
      >
        흩어져 있는 편성표를 한곳에서
      </span>

      {/* headline — 이 페이지에서 가장 큰 글자. 두 줄로 끊어 읽히게 둔다. */}
      <h1 className="sr-only sm:not-sr-only mt-5 text-[34px] font-bold leading-[1.25] tracking-[-0.028em] text-fg-strong sm:mt-6 sm:text-[48px] sm:leading-[1.22] sm:tracking-[-0.032em]">
        이 경기,
        <br />
        <span className="text-fg-brand-bright">한국어 해설</span> 해주나?
      </h1>

      <p className="hidden sm:block mt-4 text-headline2 font-bold tracking-[-0.01em] text-fg-strong sm:mt-5 sm:text-heading2">
        오늘 중계부터 순위·결과까지, 같은 편성표에서
      </p>

      <div className="hidden sm:block mt-4 max-w-[600px] space-y-1.5 break-keep text-label1 leading-[1.7] text-fg-secondary sm:mt-5 sm:space-y-2 sm:text-body2 sm:leading-[1.75]">
        {/* 아이콘 자리 = 카드 하단의 해설 뱃지 그대로(한국어 흰 채움 / 현지 검은 박스).
            화면에서 뜻을 먼저 익히고 편성표로 내려가게 한다. */}
        <p>
          OTT와 TV에 흩어진 편성을 한곳에 모아,{" "}
          <span className="w-badge w-badge--ko mx-0.5 align-[2px]">한국어</span> 한국어 해설인지{" "}
          <span className="w-badge w-badge--local mx-0.5 align-[2px]">현지</span> 현지 해설인지 골라 볼 수
          있게 합니다.
        </p>
        <p>
          <b className="font-semibold text-fg-strong">{dateLabel}</b> 기준,{" "}
          <b className="font-semibold text-fg-strong">{totalGames}경기</b> 중 한국어 해설은{" "}
          <b className="font-semibold text-fg-brand-bright">{koreanGames}경기</b>입니다.
        </p>
      </div>

      {/* CTA — solid 하나 + outlined 하나. 위계가 분명하게 둘로 끝낸다. */}
      <div className="hidden sm:flex mt-7 flex-wrap items-center gap-2.5 sm:mt-8 sm:gap-3">
        <a href="#schedule" className="w-btn w-btn--solid w-focus">
          오늘 편성 보기
        </a>
        {/* 🔴 같은 경로(`/`)로 가는 <Link> 로 두면 안 된다. 소프트 내비게이션이라
            ScheduleClient 가 다시 마운트되지 않고, `?comm=` 은 마운트 때만 읽으므로
            URL 만 바뀌고 필터는 그대로였다(2026-09-14). 상태를 직접 바꾼다.
            href 는 새 탭·JS 전 클릭용으로 남긴다. */}
        <a
          href="/?comm=korean#schedule"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            onKoreanOnly();
          }}
          className="w-btn w-btn--outlined w-focus"
        >
          한국어 해설만
        </a>
      </div>
    </section>
  );
}

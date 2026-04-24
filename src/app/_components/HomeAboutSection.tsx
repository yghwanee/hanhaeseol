import { StatusBadge } from "./StatusBadge";

const FAQS: { q: string; a: string }[] = [
  {
    q: "한해설은 어떤 서비스인가요?",
    a: "한해설은 국내에서 시청 가능한 스포츠 중계 편성표를 한곳에 모아 한국어 해설 여부를 표시해주는 서비스입니다. SPOTV NOW, 쿠팡플레이, 티빙, Apple TV+ 등 주요 OTT와 SPOTV, tvN SPORTS, KBS N SPORTS, MBC SPORTS+, SBS Sports 등 TV 채널의 편성을 한 페이지에서 비교할 수 있습니다.",
  },
  {
    q: "한국어 해설 여부는 어떻게 판단하나요?",
    a: "각 플랫폼의 공식 편성표에서 제공하는 언어 정보(SPOTV NOW의 language 필드 등)를 기준으로 자동 판별합니다. KBO, K리그, KBL 등 국내 리그는 기본적으로 한국어 해설로 분류하고, 해외 리그는 플랫폼이 제공하는 메타데이터를 따릅니다. 확인이 불가능한 경우에는 \"확인중\" 뱃지로 표시합니다.",
  },
  {
    q: "편성표 데이터는 언제 업데이트되나요?",
    a: "매일 한국 시간(KST) 기준 자동으로 편성표를 갱신합니다. 각 플랫폼의 공식 일정을 기반으로 오늘부터 7일간의 경기를 제공하며, 실시간 편성 변경은 반영이 지연될 수 있습니다.",
  },
  {
    q: "뱃지 색상은 무슨 의미인가요?",
    a: "초록색 \"한국어해설\"은 한국어 해설이 제공되는 경기, 빨간색 \"현지해설\"은 영어 등 현지 언어로만 제공되는 경기, 노란색 \"확인중\"은 해설 정보가 확인되지 않은 경기, 회색 \"경기 종료\"는 예상 경기 시간이 지난 경기를 의미합니다.",
  },
  {
    q: "어떤 종목과 리그를 볼 수 있나요?",
    a: "축구(EPL, 라리가, 분데스리가, 세리에A, 리그1, 챔피언스리그, K리그, AFC 등), 야구(MLB, KBO), 농구(NBA, KBL), 배구(V리그)를 제공합니다. 각 리그는 상단 종목·플랫폼 필터와 함께 날짜별로 정리되어 표시됩니다.",
  },
  {
    q: "중계 링크로 바로 이동하나요?",
    a: "한해설은 편성 정보를 모아 보여주는 서비스이며, 실제 중계는 각 플랫폼의 공식 앱·웹사이트에서 시청해야 합니다. 편성표의 플랫폼 이름을 참고해 해당 서비스로 이동해주세요.",
  },
];

function FaqJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function HomeAboutSection() {
  return (
    <section
      aria-label="한해설 서비스 소개"
      className="mx-auto mt-4 sm:mt-6 max-w-2xl px-3 sm:px-4 text-zinc-300"
    >
      <FaqJsonLd />

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-white">한해설이란?</h2>
        <p className="mt-3 text-sm leading-relaxed">
          한해설은 <strong className="text-zinc-100">스포츠 한국어 해설 중계 편성표</strong>를
          한곳에 모아 보여주는 서비스입니다. 해외축구·MLB·NBA 같은 해외 경기부터 KBO·K리그·KBL 등 국내 리그까지,
          여러 OTT와 TV 채널에 흩어져 있는 중계 일정을 하루 단위로 정리하고,
          각 경기의 <strong className="text-zinc-100">한국어 해설 여부</strong>를 뱃지로 명확히 표시합니다.
          어느 플랫폼에서 한국어 중계가 제공되는지 찾아 헤매는 시간을 줄이기 위해 만들어졌습니다.
        </p>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-base sm:text-lg font-semibold text-white">지원 종목</h2>
            <p className="text-sm text-zinc-100">
              <span className="mr-3">⚽ 축구</span>
              <span className="mr-3">⚾ 야구</span>
              <span className="mr-3">🏀 농구</span>
              <span>🏐 배구</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-base sm:text-lg font-semibold text-white">지원 플랫폼</h2>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            <div>
              <p className="text-xs text-zinc-500 mb-1">OTT</p>
              <ul className="space-y-1">
                <li>SPOTV NOW</li>
                <li>쿠팡플레이</li>
                <li>티빙</li>
                <li>Apple TV+</li>
              </ul>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">TV 채널</p>
              <ul className="space-y-1">
                <li>SPOTV / SPOTV2</li>
                <li>tvN SPORTS</li>
                <li>KBS N SPORTS</li>
                <li>MBC SPORTS+</li>
                <li>SBS Sports</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-white">이용 가이드</h2>
        <p className="mt-3 text-sm leading-relaxed">
          상단에서 종목·플랫폼·해설 여부를 필터링해 원하는 경기를 찾을 수 있습니다.
          날짜 탭을 눌러 오늘부터 최대 7일 뒤까지의 편성을 미리 확인하세요.
          각 경기 카드에는 시작 시간, 리그, 홈·원정 팀, 중계 플랫폼이 함께 표시됩니다.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-center">
            <StatusBadge status={true} finished={false} />
            <span className="text-zinc-400">한국어 해설 제공</span>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-center">
            <StatusBadge status={false} finished={false} />
            <span className="text-zinc-400">영어 등 현지 해설</span>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-center">
            <StatusBadge status="unknown" finished={false} />
            <span className="text-zinc-400">해설 정보 미확인</span>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-center">
            <StatusBadge status={true} finished={true} />
            <span className="text-zinc-400">예상 종료 시간 경과</span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-white">자주 묻는 질문</h2>
        <div className="mt-4 divide-y divide-zinc-800">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group py-3 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-start justify-between gap-3 text-sm font-medium text-zinc-100">
                <span>{q}</span>
                <span className="mt-0.5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <p className="mt-2 pr-6 text-sm leading-relaxed text-zinc-400">{a}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-xs text-zinc-500 leading-relaxed">
        편성표 데이터는 각 플랫폼의 공식 편성 정보를 기반으로 매일 자동 수집되며,
        실시간 편성 변경이나 우천 취소 등은 반영이 지연될 수 있습니다.
        오류 제보·문의는 <a href="mailto:yghwanee@gmail.com" className="text-zinc-300 underline underline-offset-2">yghwanee@gmail.com</a>으로 연락해주세요.
      </div>
    </section>
  );
}

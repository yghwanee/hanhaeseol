import Link from "next/link";

/**
 * 404. Next 기본 화면은 높이 100vh 박스라 상단 GNB 와 44px 겹쳤다(2026-10-22 design:audit rhythm).
 * 지난 경기 매치는 410(미들웨어)이고, 여기는 없는 주소·비시즌 종목 허브 같은 경우다.
 */
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 py-16 text-center sm:px-6 sm:py-24">
      <p className="text-caption1 font-semibold tracking-wider text-fg-tertiary">404</p>
      <h1 className="mt-2 text-heading1 font-bold text-fg-strong sm:text-title3">페이지를 찾을 수 없습니다</h1>
      <p className="mt-3 text-label1 text-fg-secondary">
        주소가 바뀌었거나, 지금은 열려 있지 않은 페이지입니다(비시즌 종목 등).
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="inline-flex items-center rounded-lg bg-fg-strong px-4 py-2 text-label1 font-semibold text-canvas">
          오늘 편성표 보기
        </Link>
        <Link href="/standings" className="inline-flex items-center rounded-lg border border-line bg-muted px-4 py-2 text-label1 text-fg">
          팀 순위
        </Link>
      </div>
    </main>
  );
}

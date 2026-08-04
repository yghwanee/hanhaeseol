import Link from "next/link";
import { PushSubscribeButton } from "./PushSubscribeButton";

/**
 * 전역 푸터 — 사이트에서 유일한 푸터다.
 *
 * 종전엔 푸터가 **두 개**였다: layout 의 전역 푸터(홈·해설·Topic·순위·소개·FAQ)와
 * `app/page.tsx` 안의 홈 전용 푸터(팀 순위·한해설 소개·자주 묻는 질문·개인정보·이용약관).
 * 홈에서는 둘 다 렌더돼 같은 곳으로 가는 링크가 이름만 다르게 두 번 나왔고
 * (순위/팀 순위, 소개/한해설 소개, FAQ/자주 묻는 질문), 반대로 개인정보처리방침·이용약관은
 * 홈에만 있어 나머지 페이지에서는 닿을 수 없었다. 하나로 합치면서 정책 링크를 전역으로 올렸다.
 *
 * 🔴 **허브 칩(리그 13·플랫폼 10·팀 85)은 넣지 않는다.** 홈 본문(`HomeAboutSection`)에
 * 있던 것이라 잠깐 푸터로 옮겼다가 걷어냈다. 전역 푸터에 두면 매치 페이지 1,600여 장을
 * 포함한 전 페이지에 같은 칩이 실리는데, 정작 그 링크는 이미 문맥이 맞는 자리에 다 있다:
 *   - 플랫폼 → 경기 카드의 `PlatformBadge` 가 전부 `/platform/{slug}` 링크다.
 *     빌드된 홈 HTML 기준 본문 9개 / 푸터 10개로 사실상 중복이었다. `/commentary` 에도 있다.
 *   - 리그 → 매치 페이지(브레드크럼·컨텍스트)·순위표·팀 페이지에서 링크한다.
 *     리그당 매치 페이지 수백 장이 걸려 있어 홈 링크가 빠져도 고아가 되지 않는다.
 *   - 팀 → 순위표(`/standings/*`)의 팀 링크와 매치 페이지의 팀 태그.
 * 셋 다 사이트맵·IndexNow 에도 들어 있다. 다시 넣고 싶어지면 이 문단을 먼저 읽을 것.
 */

const MENU: { href: string; label: string }[] = [
  { href: "/", label: "홈" },
  { href: "/commentary", label: "한국어 해설" },
  { href: "/guide", label: "한해설 Topic" },
  { href: "/standings", label: "팀 순위" },
  { href: "/about", label: "소개" },
  { href: "/faq", label: "자주 묻는 질문" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "이용약관" },
];

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-zinc-800 bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <nav
          aria-label="사이트 메뉴"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-zinc-400"
        >
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} className="hover:text-white">
              {m.label}
            </Link>
          ))}
          <PushSubscribeButton />
        </nav>

        {/* 🔴 자매 사이트 링크는 **여기(서버 렌더 푸터)** 에 있어야 한다.
         *  좌측 `ChaeunSideBanner` 는 `SideBanners` 가 "use client" + `useAdsReady()`
         *  게이트라 서버 HTML 에 아예 안 실리고, 그나마도 `hidden xl:flex`(≥1280px)라
         *  모바일 우선 색인을 하는 구글에는 렌더 후에도 보이지 않는다. 그래서 채운은
         *  외부 인바운드 링크가 사실상 0 이었고 색인이 잡히지 않았다(2026-08-04 실측:
         *  haeseol.com 라이브 HTML 에 "chaeun" 문자열 0회). 이 줄이 유일한 발견 경로다.
         *  배너를 손보더라도 이 링크는 지우지 말 것.
         *  fadeby 도 같은 이유로 여기 있다 — 그쪽은 배너조차 없었다. */}
        <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
          <a
            href="https://chaeun.haeseol.com"
            className="text-zinc-400 underline underline-offset-2 hover:text-white"
          >
            채운 彩運
          </a>
          {" — 사주 오행으로 보는 배경화면."}
          <br />
          <a
            href="https://fadeby.haeseol.com"
            className="text-zinc-400 underline underline-offset-2 hover:text-white"
          >
            fadeby
          </a>
          {" — 조용한 위로의 시집."}
          <br />
          {"같은 사람이 만든 자매 사이트입니다."}
        </p>

        <p className="mt-6 border-t border-zinc-900 pt-5 text-xs leading-relaxed text-zinc-500">
          편성표 데이터는 각 플랫폼의 공식 편성 정보를 기반으로 매일 자동 수집되며, 실시간 편성
          변경이나 우천 취소 등은 반영이 지연될 수 있습니다. 오류 제보·문의는{" "}
          <a
            href="mailto:yghwanee@gmail.com"
            className="text-zinc-300 underline underline-offset-2"
          >
            yghwanee@gmail.com
          </a>
          으로 연락해주세요.
        </p>
        <p className="mt-3 text-xs text-zinc-500">© 2026 한해설</p>
      </div>
    </footer>
  );
}

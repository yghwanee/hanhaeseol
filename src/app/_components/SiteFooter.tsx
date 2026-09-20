import Link from "next/link";
import { PushFollowsSync } from "./PushFollowsSync";
import { BRAND_SOCIALS } from "@/lib/brand";

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
  // 🔴 앵커는 `홈` 이 아니라 `한해설` 이다. 2026-08-13 실측에서 사이트 전체를 통틀어
  // `/` 로 가는 내부 링크가 이 한 개뿐이었고 앵커가 `홈` 이라, 구글이 "한해설 = 홈"
  // 을 배울 경로가 없었다(브랜드 검색에서 `/about` 이 홈을 이긴 이유 중 하나).
  { href: "/", label: "한해설" },
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
    <footer className="mt-8 border-t border-line-subtle bg-subtle px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <nav
          aria-label="사이트 메뉴"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-label1 text-fg-secondary"
        >
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} className="-my-2 inline-block py-2 hover:text-fg-strong">
              {m.label}
            </Link>
          ))}
        </nav>
        {/* 공식 채널 — `rel="me"` 로 사이트 ↔ 채널을 서로 가리키게 한다. 스키마 `sameAs` 만 있고
         *  보이는 링크가 없어서 「한해설」 검색에 SNS 가 안 묶였다(2026-09-21). 목록 정본 = brand.ts. */}
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 text-caption1 text-fg-tertiary">
          <span>한해설 공식 채널</span>
          {BRAND_SOCIALS.map((c) => (
            <a
              key={c.url}
              href={c.url}
              rel="me noopener"
              target="_blank"
              className="relative text-fg-secondary underline underline-offset-2 after:absolute after:-inset-y-3 after:content-[''] hover:text-fg-strong"
            >
              {c.name}
            </a>
          ))}
        </p>

        {/* 🔴 보이는 것이 없다. 찜 변경을 서버 구독에 반영하는 동기화기이고, 푸터가 아니라
         *  **모든 페이지에 한 번** 있어야 한다. 알림 on/off 컨트롤은 홈의 「내 팀」 섹션에만
         *  둔다(화니 지시, 2026-09-15) — 푸터의 토글은 자리만 차지했다. */}
        <PushFollowsSync />

        {/* 🔴 자매 사이트 링크는 **여기(서버 렌더 푸터)** 에 있어야 한다.
         *  좌측 `ChaeunSideBanner` 는 `SideBanners` 가 "use client" + `useAdsReady()`
         *  게이트라 서버 HTML 에 아예 안 실리고, 그나마도 `hidden xl:flex`(≥1280px)라
         *  모바일 우선 색인을 하는 구글에는 렌더 후에도 보이지 않는다. 그래서 채운은
         *  외부 인바운드 링크가 사실상 0 이었고 색인이 잡히지 않았다(2026-08-04 실측:
         *  haeseol.com 라이브 HTML 에 "chaeun" 문자열 0회). 이 줄이 유일한 발견 경로다.
         *  배너를 손보더라도 이 링크는 지우지 말 것.
         *  fadeby 도 같은 이유로 여기 있다 — 그쪽은 배너조차 없었다. */}
        <p className="mt-6 text-center text-caption1 leading-relaxed text-fg-tertiary">
          <a
            href="https://chaeun.haeseol.com"
            className="-my-2 inline-block py-2 text-fg-secondary underline underline-offset-2 hover:text-fg-strong"
          >
            채운 彩運
          </a>
          {" — 사주 오행으로 보는 배경화면."}
          <br />
          <a
            href="https://fadeby.haeseol.com"
            className="-my-2 inline-block py-2 text-fg-secondary underline underline-offset-2 hover:text-fg-strong"
          >
            fadeby
          </a>
          {" — 조용한 위로의 시집."}
          <br />
          {"같은 사람이 만든 자매 사이트입니다."}
        </p>

        <p className="mt-6 border-t border-line-subtle pt-5 text-caption1 leading-relaxed text-fg-tertiary">
          편성표 데이터는 각 플랫폼의 공식 편성 정보를 기반으로 매일 자동 수집되며, 실시간 편성
          변경이나 우천 취소 등은 반영이 지연될 수 있습니다. 오류 제보·문의는{" "}
          <a
            href="mailto:yghwanee@gmail.com"
            
            className="-my-2 inline-block py-2 text-fg underline underline-offset-2"
          >
            yghwanee@gmail.com
          </a>
          으로 연락해주세요.
        </p>
        <p className="mt-3 text-caption1 text-fg-tertiary">© 2026 한해설</p>
      </div>
    </footer>
  );
}

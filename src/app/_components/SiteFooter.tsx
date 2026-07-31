import Link from "next/link";
import { LEAGUE_SEO, PLATFORM_SEO } from "@/lib/slugs";
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
 * 리그·플랫폼 허브 링크는 원래 홈 본문(`HomeAboutSection`)에 있던 것이다. 본문에서는
 * 걷어냈지만 내부 링크 자체는 색인에 필요하므로 푸터로 옮겼다.
 *
 * 🔴 **팀 링크 85개는 여기에 넣지 않았다.** 홈 본문에 있던 것이지만 전역 푸터에 두면
 * 매치 페이지 1,600여 장을 포함한 전 페이지에 같은 칩 85개가 실린다. 팀 페이지 진입은
 * 순위표(`/standings/*`)의 팀 링크와 매치 페이지의 팀 태그가 이미 담당하고
 * (그쪽이 문맥도 맞다), 사이트맵·IndexNow 에도 전부 들어 있다.
 */

const OTT_SLUGS = ["spotv-now", "coupang-play", "tving", "apple-tv"];
const TV_SLUGS = ["spotv", "spotv2", "tvn-sports", "kbs-n-sports", "mbc-sports-plus", "sbs-sports"];

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

function Chip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100"
    >
      {children}
    </Link>
  );
}

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

        <div className="mt-6 border-t border-zinc-900 pt-5">
          <p className="mb-2 text-xs text-zinc-500">리그별 편성표</p>
          <div className="flex flex-wrap gap-1.5">
            {LEAGUE_SEO.map((l) => (
              <Chip key={l.slug} href={`/league/${l.slug}`}>
                {l.display}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs text-zinc-500">플랫폼별 편성표</p>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORM_SEO.filter((p) => OTT_SLUGS.includes(p.slug) || TV_SLUGS.includes(p.slug)).map(
              (p) => (
                <Chip key={p.slug} href={`/platform/${p.slug}`}>
                  {p.display}
                </Chip>
              ),
            )}
          </div>
        </div>

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

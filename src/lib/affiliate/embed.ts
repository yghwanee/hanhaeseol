/**
 * 가이드 본문(마크다운) 안에 토스 상품 카드를 꽂는 자리.
 *
 * 본문은 `dangerouslySetInnerHTML` 로 들어가는 HTML 문자열이라 React 컴포넌트를
 * 중간에 끼울 수 없다. 그래서 마크다운에 마커 한 줄을 두고, marked 로 변환한 **뒤**
 * 그 문단을 카드 HTML 로 바꾼다.
 *
 *     :::toss stadium-cushion:::
 *
 * 🔴 marked 앞이 아니라 **뒤**에서 치환한다. 앞에서 하면 autolink 가 카드 안의 글자를
 * 다시 링크로 만들고, marked 가 우리 HTML 을 다시 파싱해 문단을 쪼갠다.
 *
 * 🔴 인라인 style 을 쓴다. Tailwind content 스캔 범위가 `src/app`·`src/components`
 * 뿐이라 `src/lib` 에 적은 클래스명은 **빌드에서 제거된다**(화면에서 스타일만 조용히
 * 사라진다). 스캔 설정에 의존하지 않으려고 값으로 박는다.
 */
import { DISCLOSURE_SHORT, formatWon, getPick, toView } from "./toss-picks";

/**
 * 마커 문단. marked 가 `<p>:::toss key:::</p>` 로 만들어 준다.
 *
 * 🔴 키 자리를 형식으로 좁히지 않는다(`[^:\s]+`). 좁히면 오타·한글 키가 **패턴에
 * 안 걸려 `:::toss 어쩌구:::` 가 본문에 그대로 찍힌다** — 독자가 깨진 글을 본다.
 * 일단 전부 잡아내고, 저장소에 없는 키면 아래에서 조용히 빈 문자열로 지운다.
 */
const MARKER = /<p>\s*:::toss\s+([^:\s]+)\s*:::\s*<\/p>/g;
/** 마크다운 원문에서 찾을 때 쓰는 것(가드·린트용). */
export const MARKER_SOURCE = /^:::toss\s+([a-z0-9][a-z0-9-]*)\s*:::$/m;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 상품 카드 HTML 한 장.
 *
 * 색·모양은 본문과 확실히 구분되게 둔다 — 광고가 본문인 척하면 그게 더 나쁘다.
 * 왼쪽 파란 띠 + 어두운 판 + 맨 위 대가성 문구 순서다(문구가 상품명보다 위에 온다).
 */
export function renderTossPickHtml(key: string, now: Date = new Date()): string {
  const pick = getPick(key, now);
  // 🔴 없는 키·마감된 상품이면 **아무것도 그리지 않는다.** 마커 문자열이 본문에
  // 그대로 남으면 독자가 깨진 글을 본다.
  if (!pick) return "";

  const { showPrice } = toView(pick);
  const discounted = showPrice && pick.originalPrice > pick.displayPrice;

  const priceRow = showPrice
    ? `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:4px">` +
      (discounted
        ? `<span style="font-size:13px;font-weight:700;color:#ff6b6b">${pick.discountRate}%</span>`
        : "") +
      `<span style="font-size:15px;font-weight:700;color:#fafafa;font-variant-numeric:tabular-nums">${formatWon(pick.displayPrice)}</span>` +
      (discounted
        ? `<span style="font-size:12px;color:#71717a;text-decoration:line-through;font-variant-numeric:tabular-nums">${formatWon(pick.originalPrice)}</span>`
        : "") +
      `</div>`
    : "";

  const note = pick.note
    ? `<p style="margin:6px 0 0;font-size:13px;line-height:1.7;color:#a1a1aa">${esc(pick.note)}</p>`
    : "";

  // rel 에 sponsored 를 반드시 넣는다 — 유료 링크를 표시하지 않으면 검색엔진 가이드라인
  // 위반이고, 한해설은 색인이 유일한 유입원이다.
  return (
    `<aside data-toss-pick="${esc(key)}" style="border:1px solid rgba(49,130,246,0.25);border-left:3px solid #3182f6;border-radius:0 10px 10px 0;background:#0e1319;padding:14px 16px;margin:24px 0">` +
    `<p style="margin:0 0 8px;font-size:11px;line-height:1.6;color:#8ab4f8">${DISCLOSURE_SHORT}</p>` +
    `<p style="margin:0;font-size:15px;font-weight:600;color:#fafafa;line-height:1.5">${esc(pick.displayName)}</p>` +
    note +
    priceRow +
    `<a href="${esc(pick.shortUrl)}" target="_blank" rel="nofollow sponsored noopener" style="display:inline-block;margin-top:12px;padding:8px 14px;border-radius:7px;background:#3182f6;color:#0b0d10;font-size:13px;font-weight:600;text-decoration:none">토스쇼핑에서 보기</a>` +
    `</aside>`
  );
}

/** 본문 HTML 의 모든 마커를 카드로 바꾼다. 가이드 로더가 마지막 단계에서 부른다. */
export function embedTossPicks(bodyHtml: string, now: Date = new Date()): string {
  return bodyHtml.replace(MARKER, (_all, key: string) => renderTossPickHtml(key, now));
}

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 홈 카드·「내 팀」 판의 레이아웃 규칙 가드 (2026-09-15 화니 지시).
 *
 * 둘 다 **눈으로는 잘 안 잡히는 종류**다. 폭 하나(모바일)에서만 나거나, 흰 판 위에서
 * 흰 글자가 사라지는 식이라 PC 한 폭만 보면 정상으로 보인다.
 */

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf-8");

/**
 * 🔴 [플랫폼][해설][상태] 묶음은 **PC 상단 우측 · 모바일 카드 맨 아래 가운데** 두 자리다.
 *
 * 폰에서 이 묶음이 상단 줄의 절반을 먹어 리그명이 `K..` 로 잘리고 시간·종목까지 눌렸다
 * (2026-09-15 실측 캡처). 한 마크업을 두 자리에 쓰되 폭으로 하나만 보이게 한다 —
 * 양쪽을 다 보이게 두면 같은 정보가 카드에 두 번 나온다.
 */
test("🔴 카드 뱃지 묶음은 PC 상단·모바일 하단으로 갈린다", () => {
  const src = read("src/app/_components/ScheduleCard.tsx");

  // 마크업이 한 곳에만 있어야 한다(두 벌로 갈리면 한쪽만 고쳐진다).
  assert.equal(
    (src.match(/w-badge--ko/g) ?? []).length,
    1,
    "뱃지 마크업이 두 벌이다 — MetaBadges 하나로 두고 className 만 바꿀 것",
  );
  assert.equal(
    (src.match(/<MetaBadges/g) ?? []).length,
    2,
    "자리가 둘이 아니다 — PC 상단 우측 + 모바일 하단 가운데",
  );
  // PC 전용 자리: sm 이상에서만 보인다.
  assert.match(src, /className="hidden items-center gap-1\.5 sm:flex"/,
    "상단 우측 플랫폼·해설이 모바일에서도 보인다 — 리그명이 잘린다");
  /**
   * 🔴 상태(LIVE·종료)는 **폭과 무관하게 상단 우측**이다(화니 지시, 2026-09-15).
   * 지금 열려 있는 경기인지가 가장 먼저 읽혀야 하는 정보라 스코어 아래로 내리면 늦다.
   */
  const top = src.slice(src.indexOf("상단 우측."), src.indexOf("{schedule.awayTeam ? ("));
  assert.match(top, /<StatusBadge/, "상태 뱃지가 상단 우측에 없다");
  assert.ok(
    !/sm:hidden|hidden[^"]*sm:flex/.test(top.slice(top.indexOf("<StatusBadge"))),
    "상태 뱃지를 폭으로 숨긴다 — LIVE·종료는 두 폭 다 상단에 있어야 한다",
  );
  // 모바일 전용 자리: 가운데 정렬 + PC 에서는 숨는다 + 하이라이트 **위**.
  const mobile = src.match(/className="pointer-events-none relative z-10 mt-6 flex items-center justify-center gap-1\.5 sm:hidden"/);
  assert.ok(mobile, "모바일 하단 자리가 mt-6·가운데 정렬·sm:hidden 이 아니다 — 12px 면 최근전적 줄에 붙어 한 묶음으로 읽힌다");
  /**
   * 🔴 순서는 최근전적 → 뱃지 → **하이라이트(맨 아래)** 다(화니 지시, 2026-09-15).
   * 하이라이트는 누르는 것이라 카드 끝에 있어야 손이 간다.
   */
  assert.ok(
    src.lastIndexOf("<MetaBadges") < src.indexOf("showHighlight && ("),
    "뱃지가 하이라이트 아래로 내려갔다 — 하이라이트가 카드 맨 아래여야 한다",
  );
});

/**
 * 🔴 흰 판은 **토큰을 뒤집어** 만든다.
 *
 * `bg-fg-strong` 만 얹으면 그 안의 `text-fg-secondary` 글자와 흰 채움 뱃지
 * (`w-badge--ko`)가 흰 바탕에서 사라진다 — 실제로 「알림 차단됨」 한 줄이 그랬다.
 * 자식들이 전부 `--w-*` 를 읽으므로 스코프에서 값만 갈아 주면 한 번에 맞는다.
 */
test("🔴 「내 팀」 판은 .w-invert-surface 로 뒤집는다", () => {
  const css = read("src/app/globals.css");
  const sec = read("src/app/_components/MyTeamsSection.tsx");

  assert.match(css, /\.w-invert-surface \{/, "반전 스코프가 없다");
  // 뒤집어야 하는 토큰이 다 들어 있는지. 하나라도 빠지면 그 자리만 다크로 남는다.
  for (const token of [
    "--w-canvas",
    "--w-surface",
    "--w-muted",
    "--w-fg-strong",
    "--w-fg-secondary",
    "--w-fg-tertiary",
    "--w-brand",
    "--w-brand-fg-bright",
    "--w-danger",
    "--w-line",
    "--w-line-subtle",
  ]) {
    const block = css.slice(css.indexOf(".w-invert-surface {"));
    assert.ok(
      block.slice(0, block.indexOf("\n}")).includes(token + ":"),
      "반전 스코프에 " + token + " 이 없다 — 그 자리만 다크로 남는다",
    );
  }

  // 판 둘(찜 0개 한 줄 · 목록)에 다 걸려 있어야 한다.
  assert.equal(
    (sec.match(/className="w-invert-surface/g) ?? []).length,
    2,
    "「내 팀」 판 두 갈래(찜 0개 안내 · 목록) 중 하나가 회색으로 남았다",
  );
  // 🔴 흰 판 위에서 행 배경이 같은 흰색이면 목록이 사라진다.
  assert.ok(
    !/rounded-lg border border-line-subtle bg-surface px-2\.5/.test(sec),
    "행이 bg-surface 다 — 반전 스코프에서는 판과 같은 흰색이라 행이 안 보인다",
  );
  assert.match(sec, /bg-muted px-2\.5/, "행 배경이 한 단 낮은 회색이 아니다");
});

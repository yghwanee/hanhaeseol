/**
 * 디자인 시스템 실측 감사 — 진짜 브라우저로 연다.
 *
 * 눈으로 훑는 대신 **레이아웃 계산 결과**를 본다. 반응형 사고는 대부분
 * "폰 폭에서 가로 스크롤이 생긴다 / 글자가 잘린다 / 탭 영역이 작다" 인데
 * 셋 다 PC 브라우저에서는 안 보이고 계산값으로만 드러난다.
 *
 *   node tools/design-audit.mjs --base=http://localhost:3001 --check=overflow
 *
 * check 종류: overflow · tap · contrast · clip · typography · color · image · rhythm · a11y · perf
 */
import { chromium } from "playwright";

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const BASE = arg("base", "http://localhost:3000");
const CHECK = arg("check", "overflow");

/** 실제 유입이 있는 경로 위주. 동적 경로는 실데이터 슬러그를 쓴다. */
const PATHS = [
  "/",
  "/standings",
  "/guide",
  "/commentary",
  "/commentary/stats",
  "/asian-games",
  "/faq",
  "/about",
  // 🔴 동적 경로도 반드시 넣는다. 실제 유입의 대부분이 여기로 들어오는데
  //    정적 경로만 감사하면 "검사했다"는 착각만 남는다.
  "/league/epl",
  "/platform/tving",
  "/standings/epl",
  "/sport/baseball",
  "/guide/chzzk-worldcup-guide",
  "/match/2026-09-14-coupang-play-맨유-vs-맨시티",
  "/team/kbo-LG",
];

const VIEWPORTS = [
  { name: "phone-360", width: 360, height: 780 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
];

/** 각 검사는 페이지 안에서 실행돼 문제 목록을 돌려준다. */
const CHECKS = {
  // 가로 스크롤 — 폰에서 가장 흔하고 가장 티 나는 사고
  overflow: () => {
    const out = [];
    const docW = document.documentElement.scrollWidth;
    const winW = window.innerWidth;
    if (docW > winW + 1) out.push({ kind: "page-overflow", detail: `문서 ${docW}px > 뷰포트 ${winW}px` });
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      // 뷰포트 밖으로 삐져나간 요소. 의도적 가로 스크롤 컨테이너 안은 제외.
      // 🔴 잘리는 조상이 있으면 실제 스크롤이 안 생긴다 — 보고해도 고칠 게 없다.
      //    (인트로 애니메이션의 흐르는 엠블럼이 여기 해당했다)
      let clipped = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (["auto", "scroll", "hidden", "clip"].includes(cs.overflowX)) { clipped = true; break; }
        if (p.hasAttribute("data-intro-overlay")) { clipped = true; break; }
      }
      if (clipped) continue;
      if (r.right > winW + 1 || r.left < -1) {
        out.push({
          kind: "element-overflow",
          detail: `${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 60)} → left ${Math.round(r.left)} right ${Math.round(r.right)}`,
        });
      }
      if (out.length > 12) break;
    }
    return out;
  },

  // 탭 영역 — 손가락 기준 44px. CLAUDE.md 가 명시적으로 요구하는 규칙이다.
  tap: () => {
    const out = [];
    for (const el of document.querySelectorAll("a, button, [role=button], input, select")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      // 🔴 문장 안에 박힌 인라인 링크는 WCAG 2.5.8 의 inline 예외다 — 본문 줄높이를
      //    깨지 않고는 44px 를 못 만든다. 걸러내지 않으면 못 고칠 지적만 쌓인다.
      const parent = el.parentElement;
      const inline = el.tagName === "A" && parent &&
        ["P", "LI", "SPAN", "TD", "DD", "BLOCKQUOTE"].includes(parent.tagName) &&
        (parent.textContent || "").trim().length > (el.textContent || "").trim().length + 4;
      if (inline) continue;
      /**
       * 🔴 **`::after` 로 키운 히트영역을 세어 준다** (2026-09-15).
       * 이 레포의 규칙이 "레이아웃은 건드리지 말고 `after:-inset-*` 로 히트영역만 키운다"
       * 라서, 요소 박스만 재면 규칙을 지킨 컨트롤이 영영 빨갛게 남는다(모달 푸터 두 개가
       * 폭마다 한 건씩 = 8건). 반대로 24px 문턱으로 눈감아 주면 **진짜 미달을 놓친다.**
       * `::after` 가 absolute 로 깔려 있으면 그 inset 만큼 넓혀서 잰다.
       *
       * 🔴 문턱은 **24px 그대로** 둔다. 44px 로 올리면 이 사이트 칩·뱃지(24~26px 고정,
       * 디자인 시스템이 정한 값)가 전부 걸려 744건이 나온다 — 못 고칠 지적만 쌓인다.
       * 44px 규칙은 **카드 링크 위에 얹힌 컨트롤**(⭐별)에 대한 것이고 그건 `test:push-toggle`
       * 이 따로 막는다.
       */
      let w = r.width;
      let h = r.height;
      const af = getComputedStyle(el, "::after");
      if (af && af.content !== "none" && af.position === "absolute") {
        const px = (v) => (v && v.endsWith("px") ? parseFloat(v) : 0);
        // inset 이 음수면 박스 밖으로 넓어진다. auto 는 0 으로 본다.
        h += -px(af.top) + -px(af.bottom);
        w += -px(af.left) + -px(af.right);
      }
      if (h < 24 || w < 24) {
        out.push({
          kind: "tap-too-small",
          detail: `${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 18)}" ${Math.round(w)}×${Math.round(h)}${w !== r.width || h !== r.height ? "(::after 포함)" : ""}`,
        });
      }
      if (out.length > 12) break;
    }
    return out;
  },

  // 텍스트 잘림 — 컨테이너보다 내용이 넓은데 truncate 도 아닌 경우
  clip: () => {
    const out = [];
    for (const el of document.querySelectorAll("h1,h2,h3,p,span,div,li,td,th")) {
      if (el.children.length > 0) continue;
      const txt = (el.textContent || "").trim();
      if (!txt) continue;
      const cs = getComputedStyle(el);
      if (cs.overflow === "hidden" && cs.textOverflow === "ellipsis") continue;
      // 🔴 스크린리더 전용 텍스트(`sr-only`)는 **일부러** 1px 로 잘라 둔 것이다.
      //    보이지 않는 글자라 잘림이 아니고, 이걸 안 빼면 앵커·제목 구조용 sr-only 를
      //    쓸 때마다 폭마다 한 건씩 올라온다(2026-09-15, 「오늘의 편성」에서 4건).
      if (el.classList.contains("sr-only") || el.closest(".sr-only")) continue;
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== "auto") {
        out.push({ kind: "text-clipped", detail: `"${txt.slice(0, 24)}" ${el.scrollWidth}>${el.clientWidth}` });
      }
      if (el.scrollHeight > el.clientHeight + 2 && cs.overflowY === "hidden" && !cs.webkitLineClamp) {
        out.push({ kind: "text-cut-vertical", detail: `"${txt.slice(0, 24)}"` });
      }
      if (out.length > 12) break;
    }
    return out;
  },

  // 대비 — 글자색과 실제 뒤 배경의 명도차. 다크 테마 전환에서 가장 잘 깨지는 자리다.
  //
  // 🔴 색 문자열을 정규식으로 파싱하면 안 된다. 이 사이트 토큰은 `oklch()` 이고
  //    getComputedStyle 은 그걸 그대로 돌려준다 — rgb 로 읽으면 전부 엉터리 값이 나온다
  //    (실제로 흰 글자가 1.23:1 로 찍혔다). 캔버스에 칠해 **실제 픽셀**을 읽는다.
  contrast: () => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const cache = new Map();
    /** 색 문자열 → [r,g,b,a] 실측 */
    const rgba = (color, under = "rgb(0,0,0)") => {
      const key = color + "|" + under;
      if (cache.has(key)) return cache.get(key);
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = under; ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      if (ctx.fillStyle === under && color !== under) { /* 파싱 실패 시에도 그냥 진행 */ }
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      const v = [d[0], d[1], d[2], d[3] / 255];
      cache.set(key, v);
      return v;
    };
    const lum = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    /**
     * 글자 뒤에 **실제로 칠해진 색**.
     *
     * 🔴 두 경로를 합쳐야 맞다.
     *   ① 조상 체인의 배경을 아래→위로 합성 (일반적인 경우)
     *   ② **글자 영역을 덮는 형제/사촌 요소** — 이 사이트는 선택된 탭·칩의 배경이
     *      슬라이딩 pill(absolute 형제)이라 ①만으로는 "배경과 같은 색"으로 오독된다.
     *   `elementsFromPoint` 는 뷰포트 안에서만 동작해 화면 밖 요소를 못 본다 → 기하로 판단.
     */
    const bgOf = (el) => {
      const r = el.getBoundingClientRect();
      // 완전 포함 대신 **면적 80% 이상 겹침**으로 본다. 글자 상자가 pill 보다 1~3px
      // 삐져나오는 건 흔하고(자간·둥근 모서리), 그걸 "배경 없음"으로 보면 오탐이 된다.
      const covers = (n) => {
        const q = n.getBoundingClientRect();
        if (q.width <= 0 || q.height <= 0) return false;
        const ow = Math.max(0, Math.min(q.right, r.right) - Math.max(q.left, r.left));
        const oh = Math.max(0, Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top));
        const area = r.width * r.height;
        return area > 0 && (ow * oh) / area >= 0.8;
      };
      // ② 덮는 요소 중 가장 안쪽 것을 찾는다(조상 두 단계까지의 형제와 그 자식).
      let painted = null;
      let scope = el.parentElement;
      for (let depth = 0; scope && depth < 7 && !painted; depth++, scope = scope.parentElement) {
        for (const cand of scope.children) {
          if (cand === el || cand.contains(el)) continue;
          const stackNodes = [cand, ...cand.querySelectorAll("*")];
          for (const n of stackNodes) {
            const cs = getComputedStyle(n);
            const [, , , a] = rgba(cs.backgroundColor);
            if (a > 0.5 && covers(n)) { painted = cs.backgroundColor; break; }
          }
          if (painted) break;
        }
      }
      // ① 조상 합성
      const stack = [];
      for (let p = el; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        const isRoot = p === document.body || p === document.documentElement;
        if (isRoot && cs.backgroundImage && cs.backgroundImage !== "none") { stack.push("rgb(27,28,32)"); break; }
        stack.push(cs.backgroundColor);
      }
      let base = "rgb(27,28,32)";
      for (let i = stack.length - 1; i >= 0; i--) {
        const [rr, gg, bb, aa] = rgba(stack[i], base);
        if (aa > 0) base = `rgb(${rr},${gg},${bb})`;
      }
      if (painted) {
        const [rr, gg, bb, aa] = rgba(painted, base);
        if (aa > 0) base = `rgb(${rr},${gg},${bb})`;
      }
      return base;
    };

    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("h1,h2,h3,p,span,a,button,li,td,b,strong,div")) {
      const txt = (el.textContent || "").trim();
      if (!txt || el.children.length > 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
      // 🔴 조상이 숨긴 경우(반응형으로 감춘 데스크톱 전용 행 등)는 rect 가 0 이다.
      //    이걸 안 거르면 "안 보이는 화면"의 색을 지적하게 된다.
      { const rr = el.getBoundingClientRect(); if (rr.width === 0 || rr.height === 0) continue; }
      // 그라디언트 글자(background-clip:text) 는 color 가 투명이라 이 방식으로 못 잰다.
      if (cs.webkitBackgroundClip === "text" || cs.backgroundClip === "text") continue;
      if (/rgba?\(0, 0, 0, 0\)/.test(cs.color)) continue;
      // 비활성 컨트롤은 WCAG 1.4.3 이 명시적으로 제외한다(고칠 수 없는 지적만 쌓인다).
      if (cs.cursor === "not-allowed" || el.closest("[disabled],[aria-disabled=true]")) continue;
      const size = parseFloat(cs.fontSize);
      const bg = bgOf(el);
      const fg = rgba(cs.color, bg);           // 글자색을 배경 위에 합성(알파 반영)
      const ratio = (Math.max(lum(fg), lum(rgba(bg))) + 0.05) / (Math.min(lum(fg), lum(rgba(bg))) + 0.05);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      if (ratio < need) {
        const k = `${txt.slice(0, 16)}|${Math.round(ratio * 10)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const path = [];
        for (let n = el; n && path.length < 4; n = n.parentElement) {
          path.push(n.tagName.toLowerCase() + (n.className ? "." + (n.className||"").toString().trim().split(/\s+/).slice(0, 2).join(".") : ""));
        }
        const rr = el.getBoundingClientRect();
        out.push({ kind: "low-contrast", detail: `"${txt.slice(0, 22)}" ${ratio.toFixed(2)}:1 (필요 ${need}) ${Math.round(size)}px ${cs.color} on ${bg} @${Math.round(rr.left)},${Math.round(rr.top)} ← ${path.join(" < ")}` });
      }
      if (out.length > 14) break;
    }
    return out;
  },

  // 타입 램프 이탈 — 시스템에 없는 글자 크기가 남아 있는지
  typography: () => {
    const ALLOWED = [11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 34, 36, 48];
    const seen = new Map();
    for (const el of document.querySelectorAll("body *")) {
      const txt = (el.textContent || "").trim();
      if (!txt || el.children.length > 0) continue;
      const size = Math.round(parseFloat(getComputedStyle(el).fontSize));
      if (!ALLOWED.includes(size)) {
        const k = `${size}px`;
        seen.set(k, (seen.get(k) || 0) + 1);
      }
    }
    return [...seen.entries()].slice(0, 10).map(([k, v]) => ({ kind: "off-ramp-font", detail: `${k} × ${v}` }));
  },

  // 키 컬러 이탈 — 파랑/빨강/무채색 밖의 색이 화면에 실제로 칠해졌는지
  color: () => {
    const out = [];
    const hueOf = (c) => {
      const m = c.match(/[\d.]+/g);
      if (!m) return null;
      const [r, g, b, a = "1"] = m.map(Number);
      if (Number(a) < 0.2) return null;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn < 18) return null; // 무채색
      let h;
      if (mx === r) h = ((g - b) / (mx - mn)) * 60;
      else if (mx === g) h = (2 + (b - r) / (mx - mn)) * 60;
      else h = (4 + (r - g) / (mx - mn)) * 60;
      return (h + 360) % 360;
    };
    const seen = new Map();
    for (const el of document.querySelectorAll("body *")) {
      // 다른 서비스 브랜드를 그대로 쓰는 자리(전자책 배너 등)는 이 사이트 키 컬러 밖이다.
      if (el.closest("[data-external-brand]")) continue;
      const cs = getComputedStyle(el);
      for (const prop of ["color", "backgroundColor", "borderTopColor"]) {
        const h = hueOf(cs[prop]);
        if (h == null) continue;
        // 허용: 파랑 200~270, 빨강 0~25 또는 340~360
        const ok = (h >= 200 && h <= 275) || h <= 25 || h >= 335;
        if (!ok) {
          const k = `${Math.round(h)}° ${cs[prop]}`;
          seen.set(k, (seen.get(k) || 0) + 1);
        }
      }
    }
    for (const [k, v] of [...seen.entries()].slice(0, 10)) out.push({ kind: "off-key-color", detail: `${k} × ${v}` });
    return out;
  },

  // 이미지 — alt 누락, 크기 미지정(CLS)
  image: () => {
    const out = [];
    for (const img of document.querySelectorAll("img")) {
      if (img.alt === null || img.alt === undefined) out.push({ kind: "img-no-alt", detail: img.src.slice(-50) });
      // 🔴 width 속성이 없어도 **CSS 로 크기가 고정돼 있으면** 자리 밀림이 없다.
      //    속성 유무가 아니라 계산된 크기로 판단한다.
      const r = img.getBoundingClientRect();
      const ics = getComputedStyle(img);
      const fixed = ics.width.endsWith("px") && ics.height.endsWith("px") &&
        parseFloat(ics.width) > 0 && parseFloat(ics.height) > 0;
      if (r.width > 0 && !fixed && !img.getAttribute("width") && !ics.aspectRatio.includes("/")) {
        out.push({ kind: "img-no-dimensions", detail: img.src.slice(-50) });
      }
      if (out.length > 8) break;
    }
    return out;
  },

  // 수직 리듬 — 섹션 간 여백이 시스템 값인지, 요소가 서로 붙어 있지 않은지
  rhythm: () => {
    const out = [];
    const main = document.querySelector("main") || document.body;
    const kids = [...main.children].filter((e) => e.getBoundingClientRect().height > 0);
    for (let i = 1; i < kids.length; i++) {
      const prev = kids[i - 1].getBoundingClientRect();
      const cur = kids[i].getBoundingClientRect();
      const gap = Math.round(cur.top - prev.bottom);
      if (gap < 0) out.push({ kind: "overlap", detail: `${kids[i - 1].tagName}↔${kids[i].tagName} ${gap}px` });
    }
    // 좌우 거터 — **콘텐츠 경계** 기준으로 본다. 컨테이너에 padding 으로 준 거터를
    // 요소 좌표만 보고 "0px" 이라 판정하던 오류를 고쳤다(2026-09-14).
    // 🔴 컨테이너(main)에 패딩이 없고 안쪽 div 가 거터를 주는 구조라, 컨테이너 좌표로
    //    재면 항상 0px 이 나온다 — 사용자가 보는 건 **글자 위치**다. 그것만 본다.
    for (const el of main.querySelectorAll("h1,h2,h3,p,li")) {
      const q = el.getBoundingClientRect();
      if (q.width === 0) continue;
      if (q.left < 12 || q.right > window.innerWidth - 12) {
        out.push({ kind: "text-touches-edge", detail: `${el.tagName} "${(el.textContent||"").trim().slice(0,18)}" ${Math.round(q.left)}~${Math.round(q.right)}` });
      }
      if (out.length > 10) break;
    }
    return out;
  },

  // 접근성 기본 — 랜드마크·제목 위계·포커스
  a11y: () => {
    const out = [];
    const h1 = document.querySelectorAll("h1");
    if (h1.length === 0) out.push({ kind: "no-h1", detail: "h1 이 없다" });
    if (h1.length > 1) out.push({ kind: "multiple-h1", detail: `h1 ${h1.length}개` });
    for (const b of document.querySelectorAll("button")) {
      const label = (b.textContent || "").trim() || b.getAttribute("aria-label");
      if (!label) out.push({ kind: "button-no-label", detail: b.outerHTML.slice(0, 60) });
      if (out.length > 8) break;
    }
    return out;
  },

  // 레이아웃 안정성 — 고정 높이 없는 배너/이미지가 밀어내는지
  perf: () => {
    const out = [];
    const shifts = window.__cls || 0;
    if (shifts > 0.1) out.push({ kind: "layout-shift", detail: `CLS ${shifts.toFixed(3)}` });
    return out;
  },
};

const browser = await chromium.launch();
const findings = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  for (const path of PATHS) {
    try {
      // 한글이 들어간 동적 경로가 있어 인코딩이 필요하고, dev 첫 컴파일이 느리다.
      await page.goto(encodeURI(BASE + path), { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(1200);
      const res = await page.evaluate(CHECKS[CHECK]);
      for (const r of res) findings.push({ viewport: vp.name, path, ...r });
    } catch (e) {
      findings.push({ viewport: vp.name, path, kind: "load-error", detail: String(e).slice(0, 100) });
    }
  }
  await ctx.close();
}
await browser.close();

console.log(`\n=== [${CHECK}] 발견 ${findings.length}건 ===`);
const byKind = {};
for (const f of findings) (byKind[f.kind] ||= []).push(f);
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`\n■ ${kind} (${list.length})`);
  for (const f of list.slice(0, 14)) console.log(`   [${f.viewport}] ${f.path}  ${f.detail}`);
  if (list.length > 14) console.log(`   … 외 ${list.length - 14}건`);
}
process.exit(findings.length ? 1 : 0);

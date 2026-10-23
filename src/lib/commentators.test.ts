import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  COMMENTATOR_STALE_DAYS,
  commentatorSentence,
  commentatorsFor,
  parseKbsnRoster,
  type CommentatorsData,
} from "./commentators";

// KBS N 실물 구조(2026-10-23): 한 섹션 안에 머리(title02)가 여럿이다.
const KBSN_HTML = `
<div class="section announcer"><div class="announcer_header"><h3 class="title01">KBS N Sports의</h3>
<div class="title02">아나운서</div></div><ul><li><h5><em>조은지</em><span>아나운서</span></h5></li>
<li><h5><em>양세원</em></h5></li></ul></div>
<div class="section announcer"><div class="title02">배구 해설위원</div><ul>
<li><em>석진욱</em></li><li><em>윤봉우</em></li></ul>
<div class="title02">야구 해설위원</div><ul><li><em>장성호</em></li><li><em>박용택</em></li></ul></div>`;

test("KBS N 파서: 섹션이 아니라 머리 단위로 나눈다(배구에 야구가 섞이면 안 된다)", () => {
  const g = parseKbsnRoster(KBSN_HTML);
  assert.deepEqual(
    g.map((x) => [x.label, x.sport, x.names]),
    [
      ["아나운서", null, ["조은지", "양세원"]],
      ["배구 해설위원", "배구", ["석진욱", "윤봉우"]],
      ["야구 해설위원", "야구", ["장성호", "박용택"]],
    ],
  );
});

const DATA: CommentatorsData = {
  checkedAt: "2026-10-23T02:00:00.000Z",
  sources: [
    {
      platform: "KBS N SPORTS",
      sourceUrl: "https://www.kbsn.co.kr/section/index7.html",
      groups: [
        { label: "아나운서", sport: null, names: ["조은지"] },
        { label: "야구 해설위원", sport: "야구", names: ["장성호", "박용택"] },
      ],
    },
  ],
};

test("리그 페이지는 그 종목만, 중계사가 아닌 방송사는 안 붙인다", () => {
  const kbo = commentatorsFor(["티빙", "KBS N SPORTS"], "2026-10-23", "야구", DATA);
  assert.deepEqual(kbo?.sources[0].groups.map((g) => g.label), ["야구 해설위원"]);
  assert.equal(commentatorsFor(["tvN SPORTS", "티빙"], "2026-10-23", "농구", DATA), null);
  assert.equal(commentatorsFor(["KBS N SPORTS"], "2026-10-23", "배구", DATA), null);
});

test(`확인일이 ${COMMENTATOR_STALE_DAYS}일 넘게 낡으면 명단을 숨긴다`, () => {
  assert.ok(commentatorsFor(["KBS N SPORTS"], "2026-11-06", undefined, DATA));
  assert.equal(commentatorsFor(["KBS N SPORTS"], "2026-11-07", undefined, DATA), null);
  assert.equal(commentatorsFor(["KBS N SPORTS"], "2026-10-23", undefined, { checkedAt: "", sources: [] }), null);
});

test("직답 문장: 기준일·방송사·명단을 한 문장에, 조사는 받침에 맞춰", () => {
  const s = commentatorSentence(DATA.sources[0], "2026-10-23");
  assert.equal(s, "2026-10-23 KBS N SPORTS 공식 홈페이지 기준 아나운서는 조은지, 야구 해설위원은 장성호·박용택입니다.");
});

test("명단을 코드에 적지 않는다 — 데이터 파일과 크롤러만 이름을 안다", () => {
  for (const f of ["src/lib/commentators.ts", "src/app/_components/CommentatorSection.tsx", "src/lib/league-guides.ts", "src/lib/platform-guides.ts"]) {
    const src = readFileSync(f, "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
    for (const name of ["장성호", "박용택", "석진욱", "김태균"]) {
      assert.ok(!src.includes(name), `${f} 에 해설위원 이름 "${name}" 이 하드코딩돼 있다`);
    }
  }
});

test("실데이터: 명단이 비어 있지 않고 플랫폼 표기가 편성 표기와 같다", () => {
  const d = JSON.parse(readFileSync("src/data/commentators.json", "utf8")) as CommentatorsData;
  assert.ok(d.sources.length > 0, "commentators.json 이 비었다 — npm run crawl:commentators");
  const platforms = new Set(
    (JSON.parse(readFileSync("src/data/schedule-archive.json", "utf8")) as { schedules: { platform: string }[] }).schedules.map(
      (s) => s.platform,
    ),
  );
  for (const s of d.sources) assert.ok(platforms.has(s.platform), `편성에 없는 플랫폼 표기: ${s.platform}`);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanText,
  toKstDate,
  scoreArticle,
  dedupe,
  toArticles,
  rankArticles,
  type NaverNewsItem,
} from "./naver-news";

function item(over: Partial<NaverNewsItem>): NaverNewsItem {
  return {
    title: "제목",
    originallink: "https://news.example.com/1",
    link: "https://n.news.naver.com/1",
    description: "요약",
    pubDate: "Sat, 18 Jul 2026 20:00:00 +0900",
    ...over,
  };
}

test("cleanText: <b> 하이라이트와 HTML 엔티티를 걷어낸다", () => {
  assert.equal(
    cleanText("<b>이정후</b>, 트레이드 &quot;임박&quot;"),
    '이정후, 트레이드 "임박"',
  );
  assert.equal(cleanText("공백   정리\n필요"), "공백 정리 필요");
});

test("toKstDate: KST 날짜로 바꾸고, 파싱 실패는 null", () => {
  // 07-18 20:00 KST → 그대로 07-18
  assert.equal(toKstDate("Sat, 18 Jul 2026 20:00:00 +0900"), "2026-07-18");
  // UTC 자정 직후는 KST로 하루 넘어간다
  assert.equal(toKstDate("Sat, 18 Jul 2026 23:00:00 +0000"), "2026-07-19");
  assert.equal(toKstDate("어제쯤"), null);
});

test("scoreArticle: 중계처가 바뀌는 사건에 점수가 붙는다", () => {
  const rights = scoreArticle("EPL 중계권 쿠팡플레이로", "독점 중계 확정");
  const gossip = scoreArticle("손흥민 복귀전 앞두고 훈련", "선수단 합류");
  assert.ok(rights > gossip);
  assert.ok(gossip >= 0);
});

test("scoreArticle: 방송사 산업 기사와 비스포츠 기사는 버린다", () => {
  // 실제로 상위권을 차지했던 기사들(2026-07-20 첫 실행)
  assert.equal(scoreArticle("중앙일보 그룹 도산, 한국언론의 대위기", "벌벌 떠는 이유"), -1);
  assert.equal(
    scoreArticle("메리츠증권 'CJ ENM, 하반기 티빙·콘텐츠 회복세'", "실적 전망"),
    -1,
  );
  assert.equal(scoreArticle("[OTT 추천작 7월 3주] 동궁, 오싹한 연애", "드라마 소개"), -1);
  // 스포츠 신호가 아예 없으면 버린다
  assert.equal(scoreArticle("페이커, 사우디 글로벌 앰배서더 위촉", ""), -1);
});

test("rankArticles: 한 키워드가 상위 목록을 독식하지 못한다", () => {
  const since = Date.parse("Fri, 17 Jul 2026 00:00:00 +0900");
  // 같은 사건을 매체별로 쓴 기사 3건 + 다른 키워드 1건
  const articles = [
    ...toArticles(
      "MLB 중계",
      [
        item({ title: "홈런더비 중계 시청자 최저 A매체" }),
        item({ title: "홈런더비 중계 시청자 최저 B매체" }),
        item({ title: "홈런더비 중계 시청자 최저 C매체" }),
      ],
      since,
    ),
    ...toArticles("이강인", [item({ title: "이강인 이적 확정, 중계는 어디서" })], since),
  ];

  const top = rankArticles(articles, 15, 2);
  assert.equal(top.filter((a) => a.keyword === "MLB 중계").length, 2);
  assert.ok(top.some((a) => a.keyword === "이강인"));
});

test("rankArticles: 감점된 기사는 목록에서 빠진다", () => {
  const since = Date.parse("Fri, 17 Jul 2026 00:00:00 +0900");
  const articles = toArticles(
    "티빙 야구 중계",
    [
      item({ title: "KBO 후반기 개막, 티빙 중계 일정" }),
      item({ title: "CJ ENM 실적 발표, 티빙 적자 축소" }),
    ],
    since,
  );
  const ranked = rankArticles(articles, 10);
  assert.equal(ranked.length, 1);
  assert.ok(ranked[0].title.startsWith("KBO 후반기"));
});

test("toArticles: 기간 밖 기사는 버리고 원문 링크를 우선한다", () => {
  const since = Date.parse("Fri, 17 Jul 2026 00:00:00 +0900");
  const got = toArticles(
    "이정후",
    [
      item({ title: "<b>이정후</b> 트레이드 임박" }),
      item({ pubDate: "Mon, 01 Jun 2026 09:00:00 +0900", title: "오래된 기사" }),
      item({ pubDate: "깨진 날짜" }),
    ],
    since,
  );

  assert.equal(got.length, 1);
  assert.equal(got[0].title, "이정후 트레이드 임박");
  assert.equal(got[0].url, "https://news.example.com/1");
  assert.equal(got[0].keyword, "이정후");
});

test("toArticles: 원문 링크가 비면 네이버 링크로 떨어진다", () => {
  const since = Date.parse("Fri, 17 Jul 2026 00:00:00 +0900");
  const got = toArticles("손흥민", [item({ originallink: "" })], since);
  assert.equal(got[0].url, "https://n.news.naver.com/1");
});

test("dedupe: 같은 기사가 여러 키워드로 와도 점수 높은 쪽만 남는다", () => {
  const since = Date.parse("Fri, 17 Jul 2026 00:00:00 +0900");
  const a = toArticles("이강인", [item({ title: "이강인 아틀레티코 이적 합의" })], since);
  const b = toArticles(
    "쿠팡플레이 중계",
    [item({ title: "이강인 아틀레티코 이적 합의", description: "쿠팡플레이 중계 예정" })],
    since,
  );
  const merged = dedupe([...a, ...b]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].keyword, "쿠팡플레이 중계");
});

test("rankArticles: 각도 점수 우선, 같으면 최신순", () => {
  const since = Date.parse("Fri, 17 Jul 2026 00:00:00 +0900");
  // 각도 점수 0점(스포츠 기사이긴 하나 중계처와 무관)끼리는 최신순
  const articles = [
    ...toArticles("A", [item({ title: "구단 훈련 공개", pubDate: "Sat, 18 Jul 2026 22:00:00 +0900" })], since),
    ...toArticles("B", [item({ title: "EPL 중계권 이적 확정" })], since),
    ...toArticles("C", [item({ title: "선수단 소집", pubDate: "Sat, 18 Jul 2026 23:00:00 +0900" })], since),
  ];
  const ranked = rankArticles(articles, 3);

  assert.equal(ranked[0].title, "EPL 중계권 이적 확정");
  assert.equal(ranked[1].title, "선수단 소집");
  assert.equal(rankArticles(articles, 1).length, 1);
});

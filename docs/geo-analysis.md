# GEO / AEO 분석 — haeseol.com

작성 2026-07-28. `claude-seo` v2.2.4 `seo-geo` 스킬 기준으로 실측. 수치는 로컬 프로덕션 빌드(수정 반영본)와 라이브 `robots.txt`/`llms.txt`에서 직접 측정.

## 먼저 짚을 것: Google은 llms.txt를 무시한다

Google의 AI optimization guide(2026-06-29 갱신)는 명시적으로 이렇게 말한다 — `llms.txt` 같은 AI 전용 텍스트 파일은 **Google Search(생성형 AI 기능 포함)에 필요하지 않고, 두어도 순위·노출에 도움도 해도 되지 않는다**(Search가 무시한다). Mueller는 llms.txt의 발견 용례를 "dead end"라고 했다.

우리 `llms.txt`는 **유지한다.** 단 근거를 바꿔서: Google 레버가 아니라 **비-Google AI 크롤러용 보조 자료**로 본다. 이걸 SEO 개선 항목으로 재투자하지 않는다.

같은 문서에서 Google은 "AEO/GEO는 SEO의 리브랜딩"이라고 정리한다. 그래서 아래 항목은 별개 분야가 아니라 **AI 검색 표면에 적용한 SEO 기본기**로 취급한다.

## GEO 준비도

| 항목 | 가중치 | 상태 | 근거 |
|---|---|---|---|
| 기술적 접근성 | 20% | **강함** | SSR 확인. AI 크롤러는 JS를 실행하지 않는데, 우리는 전 페이지가 서버 렌더 HTML에 본문을 담고 있다(홈 5,935자, 매치 1,800~2,900자, 팀 1,300~1,800자) |
| 구조적 가독성 | 20% | **강함** | H1 1개/페이지(31/31), 질문형 H2, 표·리스트 사용, match/team FAQPage 신규 적용(12/12) |
| 인용 가능성 | 25% | **개선됨** | 팀 페이지 직답이 본문 10% 지점. `/commentary` 첫 문단을 수치 포함 직답으로 교체(이전엔 인용 가능한 문장이 없었음) |
| 권위·브랜드 신호 | 20% | **약함** | ↓ 아래 |
| 멀티모달 | 15% | **중간** | 팀 엠블럼·동적 OG·유튜브 하이라이트 임베드 있음. 차트·인포그래픽 없음 |

## AI 크롤러 접근 — 전면 허용 (확인됨)

라이브 `robots.txt`에 20종이 명시 허용돼 있고 `Disallow`는 UTM 라우팅(`/ig`·`/yt`·`/tt`)과 `/admin`뿐이다.

GPTBot · OAI-SearchBot · ChatGPT-User · ClaudeBot · Claude-SearchBot · Claude-User · Google-Extended · PerplexityBot · Perplexity-User · Applebot · Applebot-Extended · Meta-ExternalAgent · Meta-ExternalFetcher · Bytespider · Amazonbot · cohere-ai · cohere-training-data-crawler · MistralAI-User · YouBot · Diffbot · DuckAssistBot

빠진 것: **CCBot(Common Crawl)** — 명시 규칙이 없어 `User-agent: *`의 Allow를 따른다. 즉 이미 허용 상태이므로 조치 불필요.

## 가장 큰 약점: 브랜드 멘션 (권위 신호 20%)

Ahrefs 75,000 브랜드 연구에서 **브랜드 멘션이 백링크보다 AI 인용과 3배 강하게 상관**한다(유튜브 멘션 0.737 vs 도메인 레이팅 0.266). 그리고 ChatGPT 인용의 47.9%가 Wikipedia, Perplexity 인용의 46.7%가 Reddit에서 온다.

우리 현황:
- **Wikipedia 없음** — ChatGPT 인용 경로의 절반이 막힌 상태
- **Reddit 없음** — Perplexity 인용 경로의 절반이 막힌 상태
- 유튜브: 채널 있음(누적 4.8만 조회) 그러나 구독 10명, 사이트 언급이 영상 설명 위주
- 저자 바이라인·Person 스키마 없음 — 편성표는 무저자가 자연스럽지만 `/guide` 27편은 사람이 쓴 글인데 저자 정보가 없다

**여기가 코드로 안 되는 영역이고, 남은 GEO 레버 중 가장 크다.**

## 신선도 — 구조적 강점

SE Ranking 130만 인용 연구: 3개월 미만 콘텐츠가 AI 답변에 인용될 확률이 약 3배, 6개월 이상 방치되면 인용 자격을 잃는다.

우리는 매시간 크롤이 편성·결과를 갱신하므로 **신선도는 자동으로 확보된다.** 이건 이 사이트 구조의 드문 이점이다. 다만 `/guide` 27편은 발행 후 갱신되지 않아 오래된 글이 인용 자격을 잃어간다 — 정기 갱신 프로그램이 필요하다.

## 이번에 적용한 것

1. **robots·googlebot 메타 복구** — 매치 페이지 1,571개에서 `max-image-preview:large`·`max-snippet:-1`이 누락돼 있었다. Google의 AI 기능 노출은 별도 opt-out 파일이 아니라 **표준 preview/snippet 지시자**로 제어되므로, 이 누락은 AI Overviews·AI Mode 노출 자격에 직접 영향을 준다.
2. **match/team FAQPage** — 질문형 구조화 데이터를 사이트의 91%에 확장.
3. **`/commentary` 직답 문단** — 첫 30% 구간에 수치 포함 자기완결 문장.
4. **팀 정식명** — 엔티티 명확화(`시카고W` → `시카고 화이트삭스`). AI 답변 엔진은 엔티티 단위로 정보를 묶으므로 내부 표기 불일치는 엔티티를 갈라놓는다.
5. **llms.txt에 팀/해설 허브 섹션 추가** — 비-Google AI 크롤러용.

## 남은 우선순위

| 순위 | 항목 | 성격 |
|---|---|---|
| 1 | Reddit·나무위키 등 커뮤니티에 실제 유용한 형태로 존재하기 | 사람 몫, 코드 불가 |
| 2 | `/guide` 저자 정보 + Person 스키마 | 코드 (S) |
| 3 | `/guide` 정기 갱신 프로그램(6개월 방치 방지) | 운영 |
| 4 | 원본 데이터 발표 — 예: "플랫폼별 한국어 해설 비율" 월간 집계 | 우리만 가진 데이터, 인용 유발력 높음 |
| 5 | 비교표 확대(플랫폼 × 리그 매트릭스) | 코드 (M) |

4번이 특히 우리 강점이다. 10개 플랫폼의 한국어 해설 여부를 매일 수집하는 곳은 우리뿐이고, 그 집계는 다른 데 없는 원본 데이터다.

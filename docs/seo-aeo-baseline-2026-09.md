# AEO 작업 기준선 — 2026-09-07

`fire-your-seo-agency` 5레인 절차(SEO·AEO·GEO·LLMO·NEO)로 haeseol.com 을 훑고 나온
❌ 하나(AEO)를 고쳤다. **이 문서의 존재 이유는 재측정이다** — "고쳤다"로 끝나는 보고는
효과를 영원히 증명하지 못한다.

## 진단 점수표 (2026-09-07)

| 레인 | 상태 | 근거 |
|---|---|---|
| SEO | ✅ | SSR 본문·h1 1개·JSON-LD 전 페이지, `index, follow`, 사이트맵 257 URL, `X-Vercel-Mitigated` 없음 |
| AEO | ❌ | 리그·플랫폼·종목 30여 페이지 첫 문단이 자기소개("…편성표입니다"). 수치·기준일을 갖춘 문장이 `/commentary` 에만 있었다 |
| GEO | ⚠️ | `llms.txt` ✅ · AI 봇 24종 명시 허용 ✅ · `llms-full.txt` 404 · Organization 을 5곳에서 새로 선언 |
| LLMO | ✅ | `alternateName` 5종 + `sameAs` 3채널 + `#organization` @id |
| NEO | ✅ | Yeti 허용 · 서치어드바이저 등록 · IndexNow 파이프라인 |

## 바꾼 것

1. **직답 리드 문단** (`src/lib/answer-lead.ts`, `src/lib/standings-lead.ts`)
   리그·플랫폼·종목·순위 페이지 h1 바로 아래에 [주어 + 수치 + 기준일] 문장.
   before: `KBO 리그(한국 프로야구) 중계 편성표입니다.`
   after: `오늘(9월 7일) KBO 중계는 5경기이고, 그중 5경기를 한국어 해설로 볼 수 있습니다.
   오늘 중계 채널은 티빙·SPOTV·KBS N SPORTS입니다. 2026-09-07 기준 앞으로 7일간 …`
2. **Organization 엔티티 통합** — guide 의 author·publisher, `/commentary/stats` 의 creator 를
   `{"@id": "https://haeseol.com/#organization"}` 참조로. 정본은 `layout.tsx` 하나다.
3. **`/llms-full.txt`** — 7일치 편성 전문을 표로 서빙하는 라우트(정적 파일 아님).

## 기준선 (재측정 때 이 숫자와 비교할 것)

- 네이버 서치어드바이저 최근 30일: 노출 **119만** · 클릭 **3.1천** · CTR **0.26%**
- 구글 색인: **54** 페이지
- 빙: 세션 **171** (구글의 2.6배)
- AI 인용: **미측정**. 아래 질문 6개를 Perplexity·ChatGPT(검색)·네이버 AI 브리핑에
  던져 출처에 haeseol.com 이 뜨는지 O/X 로 기록해야 한다. 지금까지 한 번도 안 했다.
  1. 오늘 KBO 중계 어디서 하나
  2. 쿠팡플레이 한국어 해설 되나
  3. EPL 한국어 중계 채널
  4. KBO 순위 1위
  5. 라리가 순위 2025
  6. 티빙 스포츠 중계 편성표
- AI 크롤러 방문: Vercel 대시보드 봇 트래픽 분류에서 GPTBot·PerplexityBot·ClaudeBot 추이.
  **인용보다 먼저 움직이는 선행 지표다.**

## 재측정 예정일 — 2026-09-21

집계 지연을 감안해 최근 2~3일은 빼고 비교한다.
읽는 순서: ①AI 크롤러 방문 ②노출 ③클릭·CTR ④AI 인용 O/X.
노출만 늘고 CTR 이 그대로면 다음 작업은 메타(제목·설명)다.

## 하지 않은 것

- 백링크·품앗이 류: 요청 없었고 앞으로도 안 한다. 네이버가 유입의 81%라 그 채널을 걸고 하는 도박이다.
- 매치 페이지 LD 정리: `robots.txt` 에서 `/match/` 를 막아 뒀으므로 인용 경로가 없다.
- HTML 페이로드(`/league/kbo` 491KB) 감축: 크롤은 되고 있어 이번 ❌ 보다 뒤 순위다.

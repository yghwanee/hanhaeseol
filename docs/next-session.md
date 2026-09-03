# 다음 세션에서 바로 시작할 것 (2026-09-03 저장)

> 다른 PC 로 옮겨서 이어할 때 **이 파일부터 읽는다.**

## 첫 할 일 — 시안 고르기 (그 외 아무것도 시작하지 말 것)

⭐찜 UI 11안 · 푸시 알림 11안을 시안첩으로 만들어 뒀다. **사용자가 번호를 고르는 것부터** 시작한다.

**시안첩**: https://claude.ai/code/artifact/e50451ee-1333-44e9-b91f-e397235b6a7b

- 찜에서 하나, 알림에서 하나. 섞어도 된다(예: `찜 06 + 알림 02`).
- 알림은 종류별로 달라도 된다(예: 예고 02 · 득점 05 · 종료 09).
- `00` 번이 **지금 라이브에 나가 있는 것**이다. 00 을 고르면 손댈 게 없다.

**고르기 전에 반드시 알려야 하는 제약 셋** (시안첩에도 적혀 있다)

| 시안 | 제약 |
|---|---|
| 찜 04 (엠블럼 배지) | 엠블럼이 **월드컵 국가대표 경기에만** 채워져 있다. 순위표 로고를 끌어오는 작업이 선행돼야 한다 |
| 찜 07 (상단 칩 바) | 찜을 **시작하는** 경로가 없다. 다른 안과 짝을 지어야 성립한다 |
| 알림 08 (카운트다운) | 🔴 푸시 텍스트는 보낸 순간에 굳는다. **숫자가 안 흐른다.** 흐르는 카운트다운은 사이트 안 "내 팀" 섹션에 이미 있다 |

---

## 지금 상태 — 전부 라이브

`⭐찜한 팀 + 경기 알림 푸시` 가 2026-09-03 에 배포 완료됐다. 커밋 `be06b685` → `4d7db65c` → `434f2797`.

**화면 (푸시 없이도 동작)**
- 홈 카드 팀명 양옆 ⭐ (라이브 별 92개 확인)
- **내 팀 다음 경기** 섹션 — 날짜 탭과 무관하게 7일 편성에서 찾고 카운트다운을 단다
- **내 팀만 (N)** 필터 칩 — 찜이 있을 때만 나온다
- `localStorage` 라 인앱 웹뷰(네이버 앱 경유)에서도 작동한다

**푸시** — 하루 전 예고 / 킥오프 60분 전 / 득점 / 종료
- 발송 = Vercel 라우트 `/api/push/dispatch`, GH Actions 는 깨우기만 한다
- 깨우는 곳 둘: `push-notify.yml`(매시 27분) + `crawl-results.yml` 마지막 스텝(결과 갱신 직후)
- 발송 기록 = Blob `push-log/log.json`. **보내기 전에** 저장하고, 저장 직전 다시 읽어 병합한다

**셋업 완료된 것** — Vercel Blob 스토어 `hanhaeseol-push`(Private, ICN1) · Vercel 환경변수 4개 · GitHub Secret `PUSH_TEST_KEY`

---

## 🔴 다른 PC 로 옮기기 전에 반드시 할 것

### `.env.local` 을 백업해라

`.env.local` 은 git 에 안 올라가고 OneDrive 동기화도 안 된다. 그리고 **Vercel 은 Secret 값을 저장 후 다시 보여주지 않는다.**

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY   ← 공개값. 아래에 적어 뒀으니 잃어도 된다
VAPID_SUBJECT                  ← mailto:yghwanee@gmail.com
VAPID_PRIVATE_KEY              ← 🔴 잃으면 못 되찾는다
PUSH_TEST_KEY                  ← 🔴 잃으면 못 되찾는다
```

공개키(공개해도 되는 값):
```
BMxBgBrP0oW-iSdprp33vEXLsEfmMkAs1w39UR808kz2kgei22vEwWHgdGSKO03f85fK_o3MmwUtQrViFowksG4
```

**잃었을 때**: 지금은 구독자가 0명이라 `npx web-push generate-vapid-keys` 로 다시 만들고 Vercel 값 두 개를 갈아끼우면 끝이다. **구독자가 생긴 뒤에 잃으면 그 구독이 전부 죽는다.**

**옮기지 않아도 되는가**: 프로덕션은 Vercel·GitHub 에 값이 있어서 그대로 돈다. `.env.local` 이 없으면 **로컬 dry-run 만** 못 한다.

### 다른 PC 에서 dry-run 하고 싶으면

```bash
# 워크플로로 돌리면 로컬 키가 필요 없다 (GitHub Secret 을 쓴다)
gh workflow run push-notify.yml -f dry=true
gh run list --workflow=push-notify.yml --limit 1
gh run view <id> --log | grep '{"ok"'
```

### 전역 지침도 같이 옮겨야 한다

`~/.claude/CLAUDE.md` 는 PC 로컬이라 동기화가 안 된다. 스킬 자동 발동 규칙·세션 종료 자동정리가 거기 있으므로 새 PC 의 같은 경로에 같은 내용을 넣어야 한다.

---

## 관측할 것 (시안 고르기와 별개)

1. **첫 구독자가 생기는지.** 지금 0명이라 알림 경로가 실전에서 한 번도 안 돌았다.
   확인: `gh workflow run push-notify.yml` 로그의 `subscribers` 값.
2. **찜을 실제로 누르는 사람이 있는지.** GA4 에서 재방문율이 움직이는지.
3. 🔴 **아직 안 본 것 넷** — 이건 `docs/growth-plan-2026-09.md` 의 1주차 항목이다.
   - 네이버 서치어드바이저에서 **119만 노출의 순위 분포**
   - 네이버에서 쿼리 5개 직접 검색해 **우리가 어느 블록에 뜨는지**
   - GA4 에서 **소셜 경유 세션 30일** (`utm_source=instagram/youtube/tiktok`)
   - 빙 웹마스터 잉여 사이트맵 3개 삭제

---

## 참고 문서

- `docs/growth-plan-2026-09.md` — 유입 2차 플랜 (진단·베팅 셋·90일 순서)
  - 웹판: https://claude.ai/code/artifact/e327b247-2eee-4e51-ab24-5b1effdc4475
- `docs/growth-plan.md` — 1차 플랜(2026-07-20). 결산은 2차 플랜 §0 에 있다
- `docs/worklog.md` — 완료 작업 1~109

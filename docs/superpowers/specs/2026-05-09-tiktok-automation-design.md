# TikTok 자동 게시 추가 — 설계 문서

작성일: 2026-05-09
상태: 설계안 (사용자 검토 대기)

## 배경

`.github/workflows/instagram.yml`이 매일 KST 18:18에 실행되어 인스타(피드 캐러셀 + 릴스 + 스토리)와 유튜브 쇼츠에 자동 게시 중이다. 동일한 9:16 릴스 영상을 TikTok에도 추가 게시한다.

## 목표

- 기존에 만들어지는 `generated/instagram/reel.mp4`를 그대로 TikTok 계정에 자동 업로드.
- 기존 워크플로우의 한 단계로 추가, 다른 채널 실패와 독립 실행.
- 사용자 개입 0회 (cron 자동 실행).
- 캡션은 인스타와 동일 + TikTok 알고리즘용 해시태그(`#fyp #포유`)만 마지막 줄에 추가.

## 비목표 (out of scope)

- TikTok 전용 콘텐츠 제작 (예: 따로 만든 짧은 영상)
- 댓글 자동 작성 — TikTok Content Posting API에는 없음.
- TikTok 이미지/슬라이드 게시.
- TikTok 인사이트/조회수 수집.

## 핵심 제약 (TikTok 정책)

1. **심사 통과 전까지 API로 올린 영상은 모두 `private` 가시성으로 강제됨** — 본인만 볼 수 있음. 사용자가 이 사실을 인지하고 "심사 전에도 자동 게시 시작"을 선택함. 일종의 dry-run 검증 + 토큰 마모 조기 발견 효과.
2. 심사 신청은 작동하는 앱이 있어야 가능 (데모 영상 + 개인정보처리방침 URL + 이용약관 URL 첨부). → 코드부터 만든 뒤 신청.
3. `video.publish` 스코프 필요.
4. 업로드는 `FILE_UPLOAD`(청크) 또는 `PULL_FROM_URL` 두 방식. **본 설계는 FILE_UPLOAD 채택** (현재 영상 호스팅에 쓰는 raw.githubusercontent.com은 도메인 소유 검증이 불가).

## 아키텍처

### 새 파일

| 경로 | 역할 |
|------|------|
| `src/lib/tiktok-api.ts` | OAuth 토큰 갱신, 영상 청크 업로드, 게시 상태 폴링 |
| `src/scripts/post-tiktok.ts` | 게시 진입점 (`generated/instagram/reel.mp4` 읽어서 업로드) |
| `src/scripts/get-tiktok-token.ts` | 1회용 OAuth 인증 헬퍼 (브라우저 로그인 → refresh_token 추출) |
| `src/scripts/check-tiktok-token.ts` | 토큰 헬스체크 (워크플로우에서 호출, 만료 임박 시 텔레그램 알림) |

### 수정되는 파일

| 경로 | 변경 |
|------|------|
| `package.json` | scripts에 `tiktok:setup`, `tiktok:check`, `post:tiktok` 추가 |
| `.github/workflows/instagram.yml` | "토큰 헬스체크"에 tiktok:check 추가, 유튜브 단계 다음에 "틱톡 업로드" 단계 추가, 텔레그램 성공 메시지에 "틱톡" 추가, 시크릿 env 3개 추가 |

### 데이터 흐름

```
generated/instagram/reel.mp4  (기존 reel:make 산출물)
        │
        ▼
post-tiktok.ts
        │
        ├─ tiktok-api.ts: getAccessToken()  ←  refresh_token으로 access_token 발급
        │
        ├─ POST /v2/post/publish/video/init/   (FILE_UPLOAD, 메타데이터 + 청크 정보)
        │     ↓ upload_url, publish_id 반환
        │
        ├─ PUT upload_url  (청크 단위로 영상 바이너리 전송)
        │
        └─ POST /v2/post/publish/status/fetch/  (publish_id 폴링, "PUBLISH_COMPLETE" 또는 "FAILED")
```

## 구성 요소 상세

### `src/lib/tiktok-api.ts`

`youtube-api.ts` 패턴 재사용. 외부 노출 함수:

```ts
export const TIKTOK_SCOPES = ["video.publish", "video.upload"];

export function tiktokEnv(): {
  clientKey: string;
  clientSecret: string;
  refreshToken: string;
};

export async function getAccessToken(): Promise<string>;

export interface PostTikTokParams {
  filePath: string;
  caption: string;
  privacyLevel: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
  disableDuet?: boolean;
  disableComment?: boolean;
  disableStitch?: boolean;
}

export async function postVideoFileUpload(p: PostTikTokParams): Promise<string>;
// 반환값: publish_id (또는 비공개 모드에서 게시된 video_id 형태)
```

내부 구현:
- `getAccessToken`: `https://open.tiktokapis.com/v2/oauth/token/` POST, `grant_type=refresh_token`. 응답으로 access_token + 새 refresh_token 받음.

**⚠ refresh_token 회전 처리 (중요):**
TikTok은 `refresh_token` 사용 시 새 refresh_token을 발급하고 기존 토큰을 무효화함 (rotation). GitHub Actions 시크릿에 저장된 값은 1회 실행 후 무효가 되므로 **자동 시크릿 업데이트가 필요**.

해결책: `post-tiktok.ts`에서 access_token 발급 후 응답의 새 `refresh_token`을 받으면, GitHub REST API (`PATCH /repos/{owner}/{repo}/actions/secrets/TIKTOK_REFRESH_TOKEN`)로 시크릿을 갱신. 이를 위해 추가 시크릿 `GH_PAT_SECRETS_WRITE`(repo `secrets:write` 권한 가진 fine-grained PAT) 필요.

대안: 회전이 정말 매번 발생하는지 실제 호출로 검증해보고, 회전 안 되면 이 메커니즘 생략. 구현 시 `tiktok:check` 단계에서 1회 호출 → 응답의 refresh_token이 입력과 같은지 비교 → 다르면 자동 갱신 로직 활성화 결정.
- `postVideoFileUpload`:
  1. `creator_info/query/`로 게시 가능 여부 확인 (선택, but TikTok 권장)
  2. `video/init/` 호출, body에 `post_info`(caption, privacy_level, 댓글/듀엣/스티치 설정) + `source_info`(`source: "FILE_UPLOAD"`, `video_size`, `chunk_size`, `total_chunk_count`) 포함
  3. 응답의 `upload_url`로 `Content-Range`/`Content-Type: video/mp4` 헤더와 함께 청크 PUT 업로드 (파일 전체가 청크 1개에 들어가는 경우 단일 PUT)
  4. `status/fetch/`를 일정 간격으로 폴링 (최대 ~3분)

청크 사이즈: TikTok이 권장하는 5MB~64MB 사이로 결정 (현재 reel.mp4 크기 확인 후 단일 청크 가능하면 단일 처리, 64MB 초과 시 분할).

### `src/scripts/post-tiktok.ts`

```
1. readManifest() → manifest.reel 확인
2. getKstToday() → mm, dd, today
3. caption = buildCaption(mm, dd, today) + "\n#fyp #포유"
4. privacyLevel = process.env.TIKTOK_PRIVACY_LEVEL ?? "SELF_ONLY"
   (심사 통과 후 시크릿/env로 "PUBLIC_TO_EVERYONE"으로 변경)
5. postVideoFileUpload(...) → publish_id 로깅
```

기존 `post-instagram-reel.ts`와 동일한 에러 패턴 (`process.exit(1)`).

### `src/scripts/get-tiktok-token.ts`

1회용 로컬 스크립트. 사용자가 `npm run tiktok:setup` 실행하면:
1. 콘솔에 OAuth authorize URL 출력 (state 파라미터 포함, redirect_uri는 `http://localhost:8080/callback`)
2. 로컬 HTTP 서버 띄워서 callback 수신
3. authorization code 받으면 `oauth/token/` POST해서 refresh_token 받음
4. 콘솔에 `TIKTOK_REFRESH_TOKEN=<token>` 형태로 출력 → 사용자가 수동으로 GitHub Secrets에 등록

`get-youtube-token.ts`와 같은 패턴.

### `src/scripts/check-tiktok-token.ts`

워크플로우 시작에서 실행, refresh_token으로 access_token 1회 발급해보고 실패 시 알림. `check-ig-token.ts` / `check-youtube-token.ts`와 같은 패턴.

## 워크플로우 변경

`.github/workflows/instagram.yml`:

```yaml
env:
  # ... 기존 ...
  TIKTOK_CLIENT_KEY: ${{ secrets.TIKTOK_CLIENT_KEY }}
  TIKTOK_CLIENT_SECRET: ${{ secrets.TIKTOK_CLIENT_SECRET }}
  TIKTOK_REFRESH_TOKEN: ${{ secrets.TIKTOK_REFRESH_TOKEN }}
  TIKTOK_PRIVACY_LEVEL: ${{ vars.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY' }}

steps:
  # ... 기존 ...
  - name: 토큰 헬스체크
    run: npm run ig:check && npm run yt:check && npm run tiktok:check

  # 유튜브 쇼츠 업로드 다음에 추가
  - name: 틱톡 업로드
    if: always()
    run: npm run post:tiktok

  - name: Telegram 성공 알림
    if: success()
    run: |
      curl ... -d text="✅ 인스타(피드+릴스+스토리), 유튜브(쇼츠), 틱톡 업로드 완료"
```

심사 통과 후 → GitHub Actions Variable에서 `TIKTOK_PRIVACY_LEVEL`을 `PUBLIC_TO_EVERYONE`으로 변경하면 끝 (코드 수정 불필요).

## 시크릿 / 변수

| 키 | 종류 | 설명 |
|----|------|------|
| `TIKTOK_CLIENT_KEY` | Secret | TikTok 개발자 포털에서 발급 |
| `TIKTOK_CLIENT_SECRET` | Secret | TikTok 개발자 포털에서 발급 |
| `TIKTOK_REFRESH_TOKEN` | Secret | `tiktok:setup` 1회 실행으로 추출, 365일 유효. **회전 시 워크플로우가 자동 갱신** (아래 PAT 필요) |
| `GH_PAT_SECRETS_WRITE` | Secret | (조건부) refresh_token 회전이 확인된 경우만. fine-grained PAT, 본 repo `secrets:write` 권한 |
| `TIKTOK_PRIVACY_LEVEL` | Variable | `SELF_ONLY` (기본) / `PUBLIC_TO_EVERYONE` (심사 후) |

## 실패 처리

- `if: always()` 덕분에 틱톡 단계 실패해도 다른 채널은 영향 없음.
- 단계 실패 시 기존 `telegram-failure.ts`가 동작 (워크플로우 전체 실패 알림). 추가 작업 없음.
- 토큰 만료 시: `check-tiktok-token.ts`가 첫 단계에서 잡고 텔레그램 알림. 사용자가 `tiktok:setup` 재실행으로 수동 갱신.

## 작업 단계 (구현 순서)

1. **사용자**: TikTok 계정 확보 + TikTok for Developers 가입 + 앱 생성 + redirect URI 설정 + `video.publish` 스코프 신청.
2. **사용자**: `client_key` / `client_secret` 발급받아 GitHub Secrets에 등록.
3. **Claude**: `tiktok-api.ts` + `post-tiktok.ts` + 토큰 헬퍼 2종 작성, 로컬 빌드/타입체크.
4. **사용자**: 로컬에서 `npm run tiktok:setup` → refresh_token 발급 → GitHub Secrets에 `TIKTOK_REFRESH_TOKEN`으로 등록.
5. **Claude**: 워크플로우 yml 수정, `package.json` scripts 추가.
6. **Claude+사용자**: `workflow_dispatch`로 1회 수동 실행 → 비공개 모드로 게시 성공 확인 (TikTok 앱에서 본인 계정의 비공개 영상 확인).
7. **자동 운영 시작**: cron이 매일 KST 18:18에 비공개 게시.
8. (이후) 한해설 사이트에 개인정보처리방침/이용약관 페이지가 없다면 추가.
9. (이후) **사용자**: TikTok 개발자 포털에서 심사 신청 (데모 영상 = 6번에서 찍힌 게시 결과 영상 / 정책 URL 첨부).
10. (이후) **사용자**: 심사 통과 시 `TIKTOK_PRIVACY_LEVEL` Variable을 `PUBLIC_TO_EVERYONE`으로 변경 → 다음 cron부터 공개 게시.

## 테스트 / 검증

- 타입체크: `tsc --noEmit` 통과 (CLAUDE.md `feedback_build_check` 규칙).
- 로컬 dry-run: `tiktok:check` 단독 실행으로 토큰 발급 성공 확인.
- 워크플로우 실배포 검증: `workflow_dispatch` 1회 실행 후 TikTok 앱 본인 계정 → 프로필 → "나만 볼 수 있는 동영상"에 영상 표시 확인.

## 미해결 / 의존 사항

- 한해설 사이트의 개인정보처리방침 / 이용약관 URL 존재 여부 미확인. **심사 신청 단계에서 필요** (자동 게시 시작은 이것 없이 가능). 별도 작업으로 분리.
- TikTok 심사 통과 시점은 외부 의존 (TikTok 본사). 본 설계 범위 밖.

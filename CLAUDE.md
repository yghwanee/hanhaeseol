# 한해설 (HanHaesul) - 스포츠 중계 편성표 서비스

## 프로젝트 개요

여러 스포츠 중계 플랫폼(SPOTV, 쿠팡플레이, 티빙 등)의 편성표를 한곳에 모아 보여주는 웹 서비스.
**핵심 기능**: 각 경기의 [한국어해설] 여부를 명확하게 표시하여, 사용자가 한국어 해설이 있는 중계를 쉽게 찾을 수 있도록 한다.

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Directory**: `src/` 디렉토리 구조 사용

## 주요 도메인 개념

- **플랫폼(Platform)**: 중계를 제공하는 서비스 (SPOTV, 쿠팡플레이, 티빙 등)
- **경기(Match)**: 스포츠 경기 정보 (종목, 팀, 시간 등)
- **편성(Schedule)**: 특정 플랫폼에서 특정 경기를 중계하는 일정
- **한국어해설(Korean Commentary)**: 해당 중계에 한국어 해설이 포함되는지 여부

## 개발 명령어

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버
npm run lint     # ESLint 검사
```

# 토스 상품 가격 매일 재확인 — Windows 작업 스케줄러가 부른다.
#
# 🔴 왜 PC 에서 도는가: 토스는 등록된 출발지 IP 에서만 API 를 받는데, Vercel 함수도
# GitHub Actions 도 나가는 IP 가 고정이 아니다. 그래서 이 PC 가 "고정 IP 서버" 역할을 한다.
# 화면에 나가는 가격은 빌드 시점 스냅샷이라, 이 스크립트가 안 돌면 값이 늙는다.
# (늙으면 화면이 알아서 가격을 숨긴다 — checkedAt 14일 룰. 그래도 숫자가 있는 쪽이 낫다.)
#
# 하는 일: toss:refresh → toss-picks.json 이 바뀌었으면 그 파일만 커밋·푸시.
# 🔴 가격이 그대로여도 대개 매일 커밋된다 — `checkedAt`(신선도 시계)이 갱신되기 때문이고
# 그게 목적이다. 그 값이 배포에 실려야 화면이 가격을 계속 보여준다(14일 지나면 숨김).
# `src/data/**` 는 test.yml 의 paths 필터에서 빠져 있어 이 커밋으로 CI 가 돌지는 않는다.
# 배포는 따로 부르지 않는다. deploy.yml 이 하루 4번(00:10·06:10·12:10·18:10 KST) 도므로
# 다음 배포가 알아서 실어 나른다.
#
# 등록/해제:
#   schtasks /query /tn "한해설 토스 가격 갱신"
#   schtasks /delete /tn "한해설 토스 가격 갱신" /f

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$logDir = Join-Path $repo "generated"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir "toss-refresh.log"

function Write-Log($msg) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $log -Value $line -Encoding UTF8
  Write-Host $line
}

try {
  Write-Log "시작"

  # 🔴 남의 작업 중인 변경까지 휩쓸어 커밋하지 않도록, 건드릴 파일 하나만 본다.
  $target = "src/data/toss-picks.json"

  # 원격이 앞서 있으면 먼저 맞춘다(다른 PC 에서 상품을 바꿨을 수 있다).
  git fetch --quiet origin main
  $behind = git rev-list --count HEAD..origin/main
  if ([int]$behind -gt 0) {
    $dirty = git status --porcelain
    if ($dirty) {
      Write-Log "원격이 $behind 커밋 앞서는데 작업 중인 변경이 있다 → 갱신만 하고 커밋은 건너뛴다"
      npm run toss:refresh 2>&1 | ForEach-Object { Write-Log $_ }
      exit 0
    }
    git pull --quiet --ff-only origin main
    Write-Log "원격 $behind 커밋 따라잡음"
  }

  npm run toss:refresh 2>&1 | ForEach-Object { Write-Log $_ }
  if ($LASTEXITCODE -ne 0) { throw "toss:refresh 실패 (exit $LASTEXITCODE)" }

  $changed = git status --porcelain -- $target
  if (-not $changed) {
    Write-Log "바뀐 게 없음 — 커밋 안 함(같은 날 두 번 돌면 여기로 온다)"
    exit 0
  }

  git add -- $target
  git commit --quiet -m "chore(toss): 상품 가격 재확인 (자동)"
  git push --quiet origin main
  Write-Log "커밋·푸시 완료"
} catch {
  Write-Log ("실패: " + $_.Exception.Message)
  exit 1
}

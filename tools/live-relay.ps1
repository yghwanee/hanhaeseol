# 라이브 스코어 중계기 실행 — 작업 스케줄러가 5분마다 부른다(이미 돌고 있으면 스케줄러가 새로 안 띄운다).
# 코드는 naver-crawl-hourly.ps1 이 최신으로 맞추는 전용 복제본의 것을 쓴다.

$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
$work = Join-Path $env:LOCALAPPDATA "hanhaeseol-crawl"
$log = Join-Path $repo "generated\live-relay.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
if (-not (Test-Path (Join-Path $work "node_modules"))) { exit 0 }

Set-Location $work
$env:DOTENV_CONFIG_PATH = Join-Path $repo ".env.local"
cmd /c "npm run -s live:relay >> `"$log`" 2>&1"

# 로그가 끝없이 자라지 않게 뒤쪽만 남긴다
if ((Get-Item $log).Length -gt 2MB) {
  $tail = Get-Content $log -Tail 2000
  Set-Content -Path $log -Value $tail -Encoding UTF8
}

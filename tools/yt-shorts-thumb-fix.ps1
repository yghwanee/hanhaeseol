# 유튜브 쇼츠 세로 썸네일 자동 교정 — Windows 작업 스케줄러가 30분마다 부른다.
#
# 🔴 왜 PC 에서 도는가: 세로 쇼츠 썸네일은 API 로 못 바꾸고(thumbnails.set 은 가로에만 붙는다)
# Studio 데스크톱 「파일 업로드」로만 된다. 유튜브에 로그인된 브라우저가 필요하고, 그게 이 PC 의
# Aside 브라우저다. 상세는 src/lib/shorts-thumb.ts · src/scripts/yt-shorts-thumb-fix.ts (작업131).
#
# 하는 일: 가장 최근 게시 슬롯의 쇼츠 썸네일이 커버와 다르면 Studio 에 커버를 올린다.
# 이미 같으면 아무것도 안 한다 — 그래서 자주 돌아도 된다. 커밋·푸시는 없다.
# 🔴 PC 가 꺼져 있거나 Aside 가 꺼져 있으면 못 고친다 → thumb-check.yml(KST 09:15·19:15)이
#    「미반영」으로 텔레그램을 보낸다. 그게 이 작업이 안 돈 신호다.
#
# 등록/해제:
#   schtasks /query /tn "한해설 쇼츠 썸네일 교정"
#   schtasks /delete /tn "한해설 쇼츠 썸네일 교정" /f

$ErrorActionPreference = "Stop"
# node 출력(UTF-8)을 코드페이지로 읽으면 로그 한글이 깨진다
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$logDir = Join-Path $repo "generated"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir "yt-shorts-thumb-fix.log"

function Write-Log($msg) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $log -Value $line -Encoding UTF8
  Write-Host $line
}

try {
  npx tsx src/scripts/yt-shorts-thumb-fix.ts 2>&1 | ForEach-Object { Write-Log $_ }
  $code = $LASTEXITCODE
  if ($code -ne 0) { Write-Log "종료코드 $code" }
  exit $code
} catch {
  Write-Log "오류: $_"
  exit 1
}

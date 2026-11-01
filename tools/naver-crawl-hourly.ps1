# 네이버 데이터 수집 — 작업 스케줄러가 매시 13분에 부른다.
#
# 왜 PC 에서 도는가: 2026-10-26 부터 네이버 스포츠 API 가 GH·Vercel 요청에 응답하지 않는다.
# 전용 복제본에서 돌아 작업 폴더의 미커밋 변경을 건드리지 않는다.
#
# 등록/해제: tools/register-naver-tasks.ps1 / schtasks /delete /tn "한해설 네이버 수집" /f

$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
$work = Join-Path $env:LOCALAPPDATA "hanhaeseol-crawl"
$log = Join-Path $repo "generated\naver-crawl.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null

function Write-Log($msg) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $log -Value $line -Encoding UTF8
  Write-Host $line
}
function Invoke-Step($name) {
  $out = cmd /c "npm run -s $name 2>&1"
  $code = $LASTEXITCODE
  Write-Log ("{0} exit={1} {2}" -f $name, $code, (($out | Select-Object -Last 1) -join ""))
  return $code
}

Write-Log "시작"
if (-not (Test-Path (Join-Path $work ".git"))) {
  git clone --quiet --depth 1 --branch main "https://github.com/yghwanee/hanhaeseol.git" $work
}
Set-Location $work
git fetch --quiet --depth 1 origin main
git reset --quiet --hard origin/main

# package-lock 이 바뀌었을 때만 npm ci
$lockHash = (Get-FileHash package-lock.json).Hash
$stamp = Join-Path $work ".lock-hash"
if (-not (Test-Path node_modules) -or -not (Test-Path $stamp) -or (Get-Content $stamp) -ne $lockHash) {
  cmd /c "npm ci --silent 2>&1" | Out-Null
  Set-Content -Path $stamp -Value $lockHash
  Write-Log "npm ci exit=$LASTEXITCODE"
}

# 비밀값은 작업 폴더의 .env.local 을 그대로 읽는다
$env:DOTENV_CONFIG_PATH = Join-Path $repo ".env.local"

$hour = (Get-Date).Hour
if ((Invoke-Step "crawl:results") -eq 0) { Invoke-Step "crawl:records" | Out-Null }
if (@(1, 9, 13) -contains $hour) { Invoke-Step "crawl:standings" | Out-Null }
if (@(3, 10, 21) -contains $hour) { Invoke-Step "crawl:starters" | Out-Null }
if ($hour -eq 4) { Invoke-Step "crawl:korean-players" | Out-Null }
Invoke-Step "prune:kbo-phantoms" | Out-Null

git add src/data/results.json public/results.json src/data/results-archive.json public/results-archive.json src/data/team-records.json public/team-records.json src/data/standings.json src/data/starters.json src/data/korean-players.json src/data/commentators.json src/data/schedule.json public/schedule.json
git diff --staged --quiet
if ($LASTEXITCODE -eq 0) { Write-Log "변경 없음"; exit 0 }

git -c user.name="hanhaeseol-home" -c user.email="hanhaeseol-home@users.noreply.github.com" commit --quiet -m "chore: update results & team records (home PC)"
$pushed = $false
foreach ($i in 1..5) {
  git pull --quiet --rebase origin main
  git push --quiet origin HEAD:main
  if ($LASTEXITCODE -eq 0) { $pushed = $true; break }
  git rebase --abort 2>$null
  Start-Sleep -Seconds 5
}
if ($pushed) { Write-Log "푸시 완료" } else { Write-Log "푸시 실패"; exit 1 }

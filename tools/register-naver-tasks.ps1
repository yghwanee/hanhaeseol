# 네이버 수집 작업 2개를 이 PC 작업 스케줄러에 등록한다. 다시 돌려도 안전하다.

$tools = $PSScriptRoot
$vbs = Join-Path $tools "run-hidden.vbs"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1)

$hourly = New-ScheduledTaskTrigger -Once -At ((Get-Date).Date.AddMinutes(13)) -RepetitionInterval (New-TimeSpan -Hours 1)
$every5 = New-ScheduledTaskTrigger -Once -At ((Get-Date).Date) -RepetitionInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName "한해설 네이버 수집" -Force -Trigger $hourly -Settings $settings `
  -Action (New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`" `"$(Join-Path $tools 'naver-crawl-hourly.ps1')`"") | Out-Null
Register-ScheduledTask -TaskName "한해설 라이브 중계" -Force -Trigger $every5 -Settings $settings `
  -Action (New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`" `"$(Join-Path $tools 'live-relay.ps1')`"") | Out-Null
Write-Host "등록 완료"

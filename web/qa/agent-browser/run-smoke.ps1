#Requires -Version 5.1
<#
  run-smoke.ps1 — replay every smoke/*.json agent-browser batch against the
  local BootCamp stack and print a PASS/FAIL table. Exits non-zero if any fail.

  Usage:
    .\run-smoke.ps1                 # all smoke flows
    .\run-smoke.ps1 -Only auth-login,student-dashboard
    .\run-smoke.ps1 -WebPort 3001 -ApiPort 3002

  Notes:
    - Helper batches whose filename starts with "_" are skipped (building
      blocks, not assertions).
    - agent-browser reads the batch JSON from stdin. PowerShell 5.1 cannot
      pipe stdin into the npm .cmd shim reliably (it hangs), so the JSON is
      fed via cmd.exe input redirection: cmd /c "<shim> batch --bail < file".
    - PASS/FAIL is driven by the exit code of `agent-browser batch --bail`.
#>
param(
  [string[]] $Only,
  [int] $WebPort = 3001,
  [int] $ApiPort = 3002
)
$ErrorActionPreference = 'Stop'
$root   = $PSScriptRoot
$smoke  = Join-Path $root 'smoke'
$output = Join-Path $root 'output'

# --- locate the agent-browser .cmd shim (needed for cmd /c redirection) ---
$abCmd = Join-Path $env:APPDATA 'npm\agent-browser.cmd'
if (-not (Test-Path $abCmd)) {
  $found = Get-Command agent-browser -ErrorAction SilentlyContinue
  if ($found -and $found.Source -like '*.cmd') { $abCmd = $found.Source }
  else { Write-Error "agent-browser.cmd not found. Install: npm i -g agent-browser; agent-browser install"; exit 2 }
}

# --- preconditions: stack must be up ---
function Test-Port([int]$p) { (Test-NetConnection 127.0.0.1 -Port $p -WarningAction SilentlyContinue).TcpTestSucceeded }
if (-not (Test-Port $WebPort)) { Write-Error "Web not listening on :$WebPort. Start the stack (dev.ps1) first."; exit 2 }
if (-not (Test-Port $ApiPort)) { Write-Error "API not listening on :$ApiPort. Start the stack (dev.ps1) first."; exit 2 }

# --- select batch files (exclude helpers starting with _) ---
$files = Get-ChildItem -Path $smoke -Filter '*.json' | Where-Object { $_.Name -notlike '_*' } | Sort-Object Name
if ($Only) { $files = $files | Where-Object { $Only -contains $_.BaseName } }
if (-not $files) { Write-Error "No smoke batch files matched."; exit 2 }

$results = @()
foreach ($f in $files) {
  $name    = $f.BaseName
  $session = "bc-smoke-$name"
  Write-Host "> $name" -ForegroundColor Cyan
  # Feed JSON via cmd.exe stdin redirection (see header note). All agent-browser
  # calls go through `cmd /c`; calling the .cmd shim via PowerShell's `&` can
  # hang waiting on an inherited stdin handle.
  cmd /c "`"$abCmd`" --session $session batch --bail < `"$($f.FullName)`"" | Out-Host
  $code = $LASTEXITCODE
  $shot = Join-Path $output "$name.png"
  cmd /c "`"$abCmd`" --session $session screenshot `"$shot`"" 2>$null | Out-Null
  cmd /c "`"$abCmd`" --session $session close" 2>$null | Out-Null
  $status = if ($code -eq 0) { 'PASS' } else { 'FAIL' }
  $results += [pscustomobject]@{ Flow = $name; Status = $status; Exit = $code }
}

Write-Host "`n==== SMOKE RESULTS ====" -ForegroundColor White
$results | Format-Table -AutoSize | Out-Host
$failed = @($results | Where-Object { $_.Status -ne 'PASS' })
Write-Host ("{0}/{1} passed" -f ($results.Count - $failed.Count), $results.Count)
if ($failed.Count -gt 0) { exit 1 } else { exit 0 }

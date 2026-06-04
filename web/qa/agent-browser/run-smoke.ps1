#Requires -Version 5.1
<#
  run-smoke.ps1 — replay every smoke/*.json agent-browser batch against the
  local BootCamp stack and print a PASS/FAIL table. Exits non-zero if any fail.

  Usage:
    .\run-smoke.ps1                 # all smoke flows
    .\run-smoke.ps1 -Only auth-login,student-dashboard
    .\run-smoke.ps1 -WebPort 3001 -ApiPort 3002

  Notes:
    - Helper batches whose filename starts with "_" are skipped (they are
      building blocks, not assertions).
    - agent-browser reads the batch JSON from stdin (auto-detected). PowerShell
      5.1 has no "<" input redirection, so the JSON is piped via Get-Content.
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

# --- locate agent-browser ---
$ab = 'agent-browser'
if (-not (Get-Command $ab -ErrorAction SilentlyContinue)) {
  $cmd = Join-Path $env:APPDATA 'npm\agent-browser.cmd'
  if (Test-Path $cmd) { $ab = $cmd }
  else { Write-Error "agent-browser not found on PATH. Install: npm i -g agent-browser; agent-browser install"; exit 2 }
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
  $json = Get-Content -Raw -LiteralPath $f.FullName
  $json | & $ab --session $session batch --bail | Out-Host
  $code = $LASTEXITCODE
  & $ab --session $session screenshot (Join-Path $output "$name.png") 2>$null | Out-Null
  & $ab --session $session close 2>$null | Out-Null
  $status = if ($code -eq 0) { 'PASS' } else { 'FAIL' }
  $results += [pscustomobject]@{ Flow = $name; Status = $status; Exit = $code }
}

Write-Host "`n==== SMOKE RESULTS ====" -ForegroundColor White
$results | Format-Table -AutoSize | Out-Host
$failed = @($results | Where-Object { $_.Status -ne 'PASS' })
Write-Host ("{0}/{1} passed" -f ($results.Count - $failed.Count), $results.Count)
if ($failed.Count -gt 0) { exit 1 } else { exit 0 }

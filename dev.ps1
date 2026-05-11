# dev.ps1 — single-command BootCamp dev stack
#
# Starts Postgres in Docker, seeds the DB, then launches the Nest API
# and the Next.js web app each in their own PowerShell window.
#
# Usage:   .\dev.ps1              — web on :3001, API on :3002
#          .\dev.ps1 -WebPort 700 — web on :700,  API on :3002
#
# API defaults to :3002 (not :3000) because TileWebApp's server.js squats
# on :3000 in this user's dev environment. Override with -ApiPort if you
# know :3000 is free.
# Stop:    close the two spawned windows (Ctrl-C each), then `docker compose down`
#          in platform/ if you also want to shut Postgres down.

param(
    [int]$WebPort = 3001,
    [int]$ApiPort = 3002
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Step($msg) { Write-Host ">> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "   $msg" -ForegroundColor DarkGray }
function Done($msg) { Write-Host ">> $msg" -ForegroundColor Green }

# 1. Docker
Step "Ensuring Docker Desktop is running"
try { docker info 2>&1 | Out-Null }
catch {
    Write-Host "   Docker is not running. Start Docker Desktop and re-run this script." -ForegroundColor Red
    exit 1
}
Ok "docker daemon reachable"

# 2. Postgres
Step "Bringing Postgres up (port 5433)"
Set-Location "$root\platform"
docker compose up -d | Out-Null

Step "Waiting for Postgres to accept connections"
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    $out = docker exec bootcamp-postgres pg_isready -U bootcamp 2>$null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    Write-Host "   Postgres did not become ready within 30s." -ForegroundColor Red
    exit 1
}
Ok "postgres ready"

# 3. Seed
Step "Seeding Hello BootCamp lesson"
npm run seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 3b. Publish Week 1 Swift Fundamentals curriculum (idempotent — content-hash skips unchanged)
Step "Publishing Swift Fundamentals curriculum (12 lessons, 125 exercises)"
Set-Location "$root\curriculum"
$env:DATABASE_URL = "postgresql://bootcamp:bootcamp@127.0.0.1:5433/bootcamp?schema=public"
npx tsx compile.ts --publish swift-fundamentals
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Set-Location "$root\platform"

# 4. Nest in its own window
Step "Launching Nest API on http://localhost:$ApiPort (new window)"
$nestEnv = "`$env:PORT='$ApiPort'; `$env:WEB_ORIGIN='http://localhost:$WebPort'"
Start-Process -FilePath 'powershell.exe' `
    -WorkingDirectory "$root\platform" `
    -ArgumentList '-NoExit', '-Command', "$nestEnv; `$host.UI.RawUI.WindowTitle = 'BootCamp :: Nest API (:$ApiPort)'; npm run start" `
    | Out-Null

# 5. Next in its own window
Step "Launching Next.js web on http://localhost:$WebPort (new window)"
$nextEnv = "`$env:NEXT_PUBLIC_API_BASE='http://localhost:$ApiPort'"
Start-Process -FilePath 'powershell.exe' `
    -WorkingDirectory "$root\web" `
    -ArgumentList '-NoExit', '-Command', "$nextEnv; `$host.UI.RawUI.WindowTitle = 'BootCamp :: Next Web (:$WebPort)'; npx next dev -p $WebPort" `
    | Out-Null

# 6. Done
Set-Location $root
Write-Host ""
Done "Stack is starting. Give both windows a few seconds to boot."
Write-Host ""
Write-Host "   Web:  http://localhost:$WebPort" -ForegroundColor Yellow
Write-Host "   API:  http://localhost:$ApiPort" -ForegroundColor Yellow
Write-Host ""
Write-Host "   To stop: close the two spawned windows. Postgres stays up until you run" -ForegroundColor DarkGray
Write-Host "   'docker compose down' in platform\." -ForegroundColor DarkGray
